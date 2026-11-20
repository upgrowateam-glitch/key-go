import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { rethrowDbError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { todayIst } from '../common/dates';
import { pricingRules, SETTING_PRICING, type PricingRules } from './catalog';
import { codeNumber, normaliseRegistration, vehicleCode } from './vehicle-rules';
import { bookingFromApi, bookingToApi, currentRate, ratesToApi, vehicleFromApi, vehicleToApi, type Json } from './mappers';

/**
 * Booking and vehicle writes shared by the admin and customer APIs.
 *
 * Vehicle status follows the rental lifecycle and is worked out here, never trusted from an app:
 * On Rent while a rental is active, Reserved on the days of a confirmed booking, otherwise Available.
 * Maintenance and Sold are set by staff (Sold only through the sale, and never with open bookings).
 * Overlapping confirmed or active bookings are refused by the database (bookings_no_overlap).
 */
@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Vehicles');
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Give older cars a fleet code, then keep statuses right as days pass (a booking's pickup day arriving). */
  async onModuleInit() {
    try {
      await this.assignMissingCodes();
      await this.refreshAllStatuses();
    } catch (e) {
      this.log.warn(`Start-up vehicle check failed: ${(e as Error).message}`);
    }
    this.timer = setInterval(() => void this.refreshAllStatuses().catch(() => undefined), 15 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Status from the bookings, unless staff set Maintenance or Sold. */
  async refreshVehicleStatus(vehicleId: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { status: true } });
    if (!v || v.status === 'SOLD' || v.status === 'MAINTENANCE') return;
    const open = (await this.listBookings({ vehicleId, status: { in: ['CONFIRMED', 'ACTIVE'] } })) as Json[];
    const today = todayIst();
    const status = open.some((b) => b.status === 'Active')
      ? 'ON_RENT'
      : open.some((b) => b.status === 'Confirmed' && String(b.pickupDate) <= today && String(b.returnDate) >= today)
        ? 'RESERVED'
        : 'AVAILABLE';
    if (status !== v.status) await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { status } });
  }

  async refreshAllStatuses() {
    const ids = await this.prisma.vehicle.findMany({ where: { status: { notIn: ['SOLD', 'MAINTENANCE'] } }, select: { id: true } });
    for (const { id } of ids) await this.refreshVehicleStatus(id);
  }

  /** Bookings that still need the car: active, or confirmed and not yet returned. */
  async openBookings(vehicleId: string) {
    const today = todayIst();
    return ((await this.listBookings({ vehicleId, status: { in: ['CONFIRMED', 'ACTIVE'] } })) as Json[]).filter((b) => b.status === 'Active' || String(b.returnDate) >= today);
  }

  private async nextCodeNumber() {
    const rows = await this.prisma.vehicle.findMany({ select: { details: true } });
    return rows.reduce((m, r) => Math.max(m, codeNumber((r.details as Json | null)?.code)), 0) + 1;
  }

  private async assignMissingCodes() {
    const rows = await this.prisma.vehicle.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, details: true } });
    let next = rows.reduce((m, r) => Math.max(m, codeNumber((r.details as Json | null)?.code)), 0) + 1;
    for (const r of rows) {
      const details = (r.details && typeof r.details === 'object' ? r.details : {}) as Json;
      if (codeNumber(details.code)) continue;
      await this.prisma.vehicle.update({ where: { id: r.id }, data: { details: { ...details, code: vehicleCode(next++) } as Prisma.InputJsonValue } });
    }
  }

  /** The Owner's pricing rules (Settings → Rental pricing), with defaults for anything not set. */
  async pricing(): Promise<PricingRules> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: SETTING_PRICING } });
    return pricingRules(row?.value);
  }

  /** The prices a car is offered at under the given rules. */
  ratesFor(v: Awaited<ReturnType<BookingsService['vehicleWithRates']>>, rules: PricingRules) {
    return vehicleToApi(v, rules).rates as import('./pricing').Rates | undefined;
  }

  async vehicleWithRates(id: string) {
    const v = await this.prisma.vehicle.findUnique({ where: { id }, include: { rates: true } });
    if (!v) throw new NotFoundException('Vehicle not found.');
    return v;
  }

  async listVehicles(where: Prisma.VehicleWhereInput = {}) {
    const rows = await this.prisma.vehicle.findMany({ where, include: { rates: true }, orderBy: { createdAt: 'asc' } });
    const rules = await this.pricing();
    return rows.map((v) => vehicleToApi(v, rules));
  }

  /** Creates or replaces a vehicle; a changed price is stored as a new rate row dated today. */
  async saveVehicle(id: string, body: Json) {
    const existing = await this.prisma.vehicle.findUnique({ where: { id }, include: { rates: true } });
    const before = existing ? (vehicleToApi(existing) as Json) : null;

    // Number plate: checked and written in the standard form when it is new or changed
    if (!before || String(body.vehicleNumber ?? '').replace(/\s+/g, '').toUpperCase() !== String(before.vehicleNumber).replace(/\s+/g, '').toUpperCase()) {
      body = { ...body, vehicleNumber: normaliseRegistration(body.vehicleNumber) };
    }
    // The odometer only goes up
    if (before && Number(body.odometerKm ?? before.odometerKm) < Number(before.odometerKm)) {
      throw new BadRequestException(`The odometer cannot go down: it already reads ${Number(before.odometerKm).toLocaleString('en-IN')} km.`);
    }
    // Staff may set Maintenance or Sold; every other status follows the bookings
    const wanted = String(body.status ?? before?.status ?? 'Available');
    const open = existing ? await this.openBookings(id) : [];
    if (wanted === 'Sold' && before?.status !== 'Sold' && open.length) {
      throw new ConflictException(`This car has ${open.length} upcoming or active booking(s). Cancel or move them before selling it.`);
    }
    if (wanted === 'Maintenance' && before?.status !== 'Maintenance' && open.some((b) => b.status === 'Active')) {
      throw new ConflictException('This car is out on rent. Put it in maintenance after it is returned.');
    }
    body = { ...body, status: wanted === 'Sold' || wanted === 'Maintenance' ? wanted : (before && before.status !== 'Sold' && before.status !== 'Maintenance' ? before.status : 'Available') };
    // The fleet code is given by the server and never changes
    body = { ...body, code: before?.code ?? vehicleCode(await this.nextCodeNumber()) };

    const { data, rates } = vehicleFromApi(body, ratesToApi(existing ? currentRate(existing.rates) : undefined));
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.vehicle.upsert({ where: { id }, create: { ...data, id }, update: data });
        if (rates) {
          const validFrom = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
          const row = {
            dailyPaise: Math.round(rates.daily * 100),
            weeklyPaise: Math.round(rates.weekly * 100),
            monthlyPaise: Math.round(rates.monthly * 100),
            depositPaise: Math.round(rates.deposit * 100),
            driverPerDayPaise: Math.round(rates.driverPerDay * 100),
          };
          await tx.vehicleRate.upsert({
            where: { vehicleId_validFrom: { vehicleId: id, validFrom } },
            create: { ...row, vehicleId: id, validFrom },
            update: row,
          });
        }
      });
    } catch (e) {
      rethrowDbError(e, { registration_no: 'vehicle number' });
    }
    await this.refreshVehicleStatus(id);
    return vehicleToApi(await this.vehicleWithRates(id), await this.pricing());
  }

  async listBookings(where: Prisma.BookingWhereInput = {}) {
    const rows = await this.prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' } });
    return rows.map(bookingToApi);
  }

  async getBooking(id: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Booking not found.');
    return b;
  }

  /** Creates or replaces a booking. Overlapping confirmed/active bookings are rejected with 409. */
  async saveBooking(id: string, body: Json) {
    const data = bookingFromApi(body);
    const previous = await this.prisma.booking.findUnique({ where: { id }, select: { vehicleId: true } });
    try {
      const saved = await this.prisma.booking.upsert({ where: { id }, create: { ...data, id }, update: data });
      // The car (and the previous car, if the booking moved) follows the booking
      await this.refreshVehicleStatus(saved.vehicleId);
      if (previous && previous.vehicleId !== saved.vehicleId) await this.refreshVehicleStatus(previous.vehicleId);
      return bookingToApi(saved);
    } catch (e) {
      rethrowDbError(e);
    }
  }

  /** Applies changes to a stored booking (columns and display fields) and saves it through the same rules. */
  async patchBooking(id: string, patch: Json) {
    const current = bookingToApi(await this.getBooking(id));
    return this.saveBooking(id, { ...current, ...patch });
  }

  async setVehicleStatus(vehicleId: string, status: Prisma.VehicleUpdateInput['status']) {
    await this.prisma.vehicle.update({ where: { id: vehicleId }, data: { status } });
  }

  /** True when another confirmed or active booking still holds the vehicle. */
  async vehicleHeldElsewhere(vehicleId: string, exceptBookingId: string) {
    return (await this.prisma.booking.count({ where: { vehicleId, id: { not: exceptBookingId }, status: { in: ['CONFIRMED', 'ACTIVE'] } } })) > 0;
  }
}
