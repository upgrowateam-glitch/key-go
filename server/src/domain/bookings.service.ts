import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { rethrowDbError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { pricingRules, SETTING_PRICING, type PricingRules } from './catalog';
import { bookingFromApi, bookingToApi, currentRate, ratesToApi, vehicleFromApi, vehicleToApi, type Json } from './mappers';

/** Booking and vehicle writes shared by the admin and customer APIs. */
@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

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
    try {
      const saved = await this.prisma.booking.upsert({ where: { id }, create: { ...data, id }, update: data });
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
