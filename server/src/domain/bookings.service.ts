import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { rethrowDbError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { isIsoDate, isoDate, todayIst } from '../common/dates';
import { pricingRules, SETTING_PRICING, type PricingRules } from './catalog';
import { codeNumber, normaliseRegistration, vehicleCode } from './vehicle-rules';
import { bookingFromApi, bookingToApi, currentRate, ratesToApi, vehicleFromApi, vehicleToApi, type Json } from './mappers';
import { bookingIdPrefix, bookingRules, nextBookingId, quoteValidUntil, reminderDueAt, SETTING_BOOKING_RULES, wallNow, type BookingRules } from './booking-rules';

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
/** Details only the server writes (the apps send back older copies of a booking, which must not undo them). */
const SERVER_DETAILS = ['reminderLog', 'quoteValidUntil', 'quoteSentAt', 'quoteSentBy', 'quoteRenewedAt'] as const;
/** Lock that makes the day's booking numbers be given out one at a time. */
const BOOKING_ID_LOCK = 51_302_611;
/** "26 Nov 10:00 AM" */
const shortWhen = (date: unknown, time: unknown) => {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : null;
  const day = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : String(date);
  return `${day} ${String(time ?? '').replace(/^0/, '')}`.trim();
};

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

  /** The Owner's booking rules (Settings → Bookings): quote validity and the pickup reminder. */
  async bookingRules(): Promise<BookingRules> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: SETTING_BOOKING_RULES } });
    return bookingRules(row?.value);
  }

  /**
   * Creates a quotation with the next booking ID of the day (KG26112301, KG26112302, …). The IDs are given out one
   * at a time under a database lock, so two staff (or a customer and staff) never get the same number.
   */
  async createBooking(body: Json) {
    const rules = await this.bookingRules();
    const now = new Date();
    const data = bookingFromApi({ ...body, status: body.status ?? 'Quoted' });
    if (data.status !== 'QUOTED' && data.status !== 'PENDING') throw new BadRequestException('A new booking starts as a quotation. Confirm it next.');
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: data.vehicleId }, select: { status: true } });
    if (!vehicle) throw new NotFoundException('Vehicle not found.');
    if (vehicle.status === 'SOLD' || vehicle.status === 'MAINTENANCE') throw new BadRequestException('This car is not available for booking.');
    const details = { ...obj(data.details), quoteValidUntil: quoteValidUntil(now, rules).toISOString() };
    const prefix = bookingIdPrefix(now);
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BOOKING_ID_LOCK}::bigint)::text AS locked`;
      const used = await tx.booking.findMany({ where: { id: { startsWith: prefix } }, select: { id: true } });
      const id = nextBookingId(prefix, used.map((u) => u.id));
      return tx.booking.create({
        data: { ...data, id, details: details as Prisma.InputJsonValue, reminderAt: reminderDueAt(data.pickupAt as Date, rules), reminderSent: false },
      });
    });
    return bookingToApi(saved);
  }

  /**
   * Confirmed or active bookings of a car that overlap the given pickup and return times (date and time). A rental
   * still out after its return time keeps the car until it comes back.
   */
  async findClashes(vehicleId: string, pickupAt: Date, returnAt: Date, exceptBookingId?: string) {
    const rows = await this.prisma.booking.findMany({
      where: { vehicleId, ...(exceptBookingId ? { id: { not: exceptBookingId } } : {}), status: { in: ['CONFIRMED', 'ACTIVE'] }, pickupAt: { lt: returnAt } },
      orderBy: { pickupAt: 'asc' },
    });
    const now = wallNow();
    return rows.filter((b) => {
      const end = b.status === 'ACTIVE' && b.returnAt < now ? new Date(now.getTime() + 60_000) : b.returnAt;
      return end > pickupAt;
    });
  }

  /** Refuses a booking that would hold a car already booked at those times, naming the booking in the way. */
  private async checkClashes(id: string, vehicleId: string, pickupAt: Date, returnAt: Date) {
    const [clash] = await this.findClashes(vehicleId, pickupAt, returnAt, id);
    if (!clash) return;
    const c = bookingToApi(clash);
    throw new ConflictException(
      `This car is already booked at that time: ${c.id} (${c.customerName}) from ${shortWhen(c.pickupDate, c.pickupTime)} to ${shortWhen(c.returnDate, c.returnTime)}. Choose other dates or times, or another car.`
    );
  }

  /** Confirms a quotation (the clash check runs in saveBooking). An expired quotation must be renewed first. */
  async confirmQuote(id: string) {
    const b = await this.getBooking(id);
    if (b.status !== 'QUOTED' && b.status !== 'PENDING') throw new BadRequestException('Only a quotation can be confirmed.');
    const until = obj(b.details).quoteValidUntil;
    if (typeof until === 'string' && new Date(until) < new Date()) {
      const when = new Date(until).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      throw new BadRequestException(`Quotation ${id} expired on ${when}. Renew it to confirm.`);
    }
    return this.patchBooking(id, { status: 'Confirmed', ...(b.paymentStatus === 'UNPAID' ? { paymentStatus: 'Deposit paid' } : {}) });
  }

  /** Gives a quotation a fresh validity period (same price). */
  async renewQuote(id: string) {
    const b = await this.getBooking(id);
    if (b.status !== 'QUOTED' && b.status !== 'PENDING') throw new BadRequestException('Only a quotation can be renewed.');
    const rules = await this.bookingRules();
    const now = new Date();
    return this.setServerDetails(id, { quoteValidUntil: quoteValidUntil(now, rules).toISOString(), quoteRenewedAt: now.toISOString() });
  }

  /** Writes details only the server keeps (quote sent, reminder log) without touching the rest of the booking. */
  async setServerDetails(id: string, patch: Json, extra: Prisma.BookingUpdateInput = {}) {
    const b = await this.getBooking(id);
    const saved = await this.prisma.booking.update({ where: { id }, data: { ...extra, details: { ...obj(b.details), ...patch } as Prisma.InputJsonValue } });
    return bookingToApi(saved);
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
  async saveBooking(id: string, bodyIn: Json) {
    const body = await this.keepExtensions(id, bodyIn);
    const data = bookingFromApi(body);
    await this.checkDriver(id, data);
    const previous = await this.prisma.booking.findUnique({
      where: { id },
      select: { vehicleId: true, status: true, pickupAt: true, returnAt: true, reminderSent: true, details: true },
    });
    const pickupAt = data.pickupAt as Date;
    const returnAt = data.returnAt as Date;
    // Date and time clash check before a booking starts holding the car (or moves while holding it)
    const holds = (st: unknown) => st === 'CONFIRMED' || st === 'ACTIVE';
    const moved =
      !previous ||
      !holds(previous.status) ||
      previous.vehicleId !== data.vehicleId ||
      previous.pickupAt.getTime() !== pickupAt.getTime() ||
      previous.returnAt.getTime() !== returnAt.getTime();
    if (holds(data.status) && moved) await this.checkClashes(id, data.vehicleId, pickupAt, returnAt);
    // The reminder belongs to the server: when it is due follows the pickup time, and "sent" resets if pickup moves
    const rules = await this.bookingRules();
    const pickupMoved = !previous || previous.pickupAt.getTime() !== pickupAt.getTime();
    data.reminderAt = reminderDueAt(pickupAt, rules);
    data.reminderSent = previous && !pickupMoved ? previous.reminderSent : false;
    const prevDetails = obj(previous?.details);
    const details = { ...obj(data.details) };
    for (const k of SERVER_DETAILS) {
      if (k in prevDetails) details[k] = prevDetails[k];
      else if (previous) delete details[k];
    }
    if (pickupMoved && previous) delete details.reminderLog;
    data.details = details as Prisma.InputJsonValue;
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

  /**
   * A driver on a confirmed or active booking must be free for those dates, not on leave, and hold a licence
   * valid until the trip ends. Checked when the driver, the dates or the status change.
   */
  private async checkDriver(id: string, input: { pickupAt: Date | string; returnAt: Date | string; status?: unknown; details?: unknown }) {
    const data = { ...input, pickupAt: new Date(input.pickupAt), returnAt: new Date(input.returnAt) };
    const holds = (st: unknown) => st === 'CONFIRMED' || st === 'ACTIVE';
    const driverOf = (details: unknown) => (details && typeof details === 'object' ? ((details as Json).driverId as string | undefined) : undefined);
    const driverId = driverOf(data.details);
    if (!driverId || !holds(data.status)) return;
    const prev = await this.prisma.booking.findUnique({ where: { id }, select: { pickupAt: true, returnAt: true, status: true, details: true } });
    if (prev && holds(prev.status) && driverOf(prev.details) === driverId && prev.pickupAt.getTime() === data.pickupAt.getTime() && prev.returnAt.getTime() === data.returnAt.getTime()) return;

    const rec = await this.prisma.appRecord.findUnique({ where: { collection_id: { collection: 'drivers', id: driverId } } });
    if (!rec) throw new BadRequestException('The chosen driver does not exist.');
    const d = rec.data as Json;
    const name = String(d.name ?? 'This driver');
    const from = isoDate(data.pickupAt);
    const to = isoDate(data.returnAt);
    const expiry = d.licenseExpiry;
    if (isIsoDate(expiry) && expiry < to) throw new ConflictException(`${name}'s driving licence ${expiry < todayIst() ? 'has expired' : `expires on ${expiry}, before this trip ends`}. Choose another driver.`);
    const leave = (Array.isArray(d.leaves) ? (d.leaves as Json[]) : []).find((l) => isIsoDate(l.from) && isIsoDate(l.to) && (l.from as string) <= to && (l.to as string) >= from);
    if (leave) throw new ConflictException(`${name} is on leave from ${leave.from} to ${leave.to}. Choose another driver.`);
    const clash = await this.prisma.booking.findFirst({
      where: { id: { not: id }, status: { in: ['CONFIRMED', 'ACTIVE'] }, pickupAt: { lt: data.returnAt }, returnAt: { gt: data.pickupAt }, details: { path: ['driverId'], equals: driverId } },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`${name} is already driving booking ${clash.id} at that time. Choose another driver.`);
  }

  /**
   * Extensions are changed only through their own routes. A screen saving an older copy of the booking (made
   * before an extension) must not undo it: keep the stored return time, money and extensions.
   */
  private async keepExtensions(id: string, body: Json): Promise<Json> {
    const prev = await this.prisma.booking.findUnique({ where: { id } });
    if (!prev) return body;
    const stored = bookingToApi(prev);
    const count = (b: Json) => (Array.isArray(b.extensions) ? b.extensions.length : 0);
    if (count(stored) <= count(body)) return body;
    const keep = ['returnDate', 'returnTime', 'days', 'subtotal', 'tax', 'totalAmount', 'extensions', 'extraHours', 'extensionCharges'];
    return { ...body, ...Object.fromEntries(keep.filter((k) => k in stored).map((k) => [k, stored[k]])) };
  }

  /** The next confirmed or active booking of a car that is still running or starts after the given time. */
  nextBookingOfVehicle(vehicleId: string, exceptBookingId: string, from: Date) {
    return this.prisma.booking.findFirst({
      where: { vehicleId, id: { not: exceptBookingId }, status: { in: ['CONFIRMED', 'ACTIVE'] }, returnAt: { gt: from } },
      orderBy: { pickupAt: 'asc' },
      select: { id: true, pickupAt: true },
    });
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
