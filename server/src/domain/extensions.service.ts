import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { clockLabel, dateTime, isoDate } from '../common/dates';
import { AuditService, type Actor } from '../identity/audit.service';
import { BookingsService } from './bookings.service';
import { bookingToApi, type Json } from './mappers';
import { StoreService } from './store.service';

export type ExtensionUnit = 'hours' | 'days';
export const MAX_EXTENSION = { hours: 23, days: 60 } as const;
const HOUR_MS = 3_600_000;

/** One extension of a rental, kept on the booking (details.extensions). */
export interface Extension {
  id: string;
  unit: ExtensionUnit;
  amount: number;
  fromReturnDate: string;
  fromReturnTime: string;
  toReturnDate: string;
  toReturnTime: string;
  extraRent: number;
  extraDriver: number;
  extraSubtotal: number;
  extraTax: number;
  extraTotal: number;
  status: 'Requested' | 'Approved' | 'Declined';
  requestedBy: string;
  requestedByRole?: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  declineReason?: string;
}

export interface ExtensionQuote {
  unit: ExtensionUnit;
  amount: number;
  newReturnDate: string;
  newReturnTime: string;
  extraRent: number;
  extraDriver: number;
  extraSubtotal: number;
  extraTax: number;
  extraTotal: number;
  /** How each part was worked out, for showing to people. */
  explain: string;
  /** False when another booking starts in the extra time. */
  available: boolean;
  /** When the next booking of this car starts (the latest the rental can be extended to). */
  latestReturn?: { date: string; time: string };
  problem?: string;
}

const extensionsOf = (b: Json) => (Array.isArray(b.extensions) ? (b.extensions as Extension[]) : []);
/** Stored return date and time → timestamp (they are always valid on a saved booking). */
const at = (date: string, time: string) => dateTime(date, time) as Date;
const label = (d: Date) => `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} ${clockLabel(d)}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * Extending a confirmed or active rental, by hours or by days (24-hour blocks).
 * - Extra day: the car's daily price (plus the driver's daily charge when the booking has a driver).
 * - Extra hour: a tenth of the daily price, never more than one day in total (same for the driver charge).
 * - Tax at the usual rate on top.
 * The car (and driver) must be free for the extra time. Customers ask, staff approve; staff extend directly.
 * A customer's request holds the car straight away; declining it gives the time back.
 */
@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger('Extensions');

  constructor(
    private readonly bookings: BookingsService,
    private readonly store: StoreService,
    private readonly audit: AuditService,
  ) {}

  private check(unit: unknown, amount: unknown): { unit: ExtensionUnit; amount: number } {
    if (unit !== 'hours' && unit !== 'days') throw new BadRequestException('Choose to extend by hours or by days.');
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1 || n > MAX_EXTENSION[unit]) {
      throw new BadRequestException(unit === 'hours' ? 'Extend by 1 to 23 hours (24 hours or more: extend by days).' : 'Extend by 1 to 60 days.');
    }
    return { unit, amount: n };
  }

  private async booking(id: string) {
    const row = await this.bookings.getBooking(id);
    return { row, api: bookingToApi(row) };
  }

  /** Price and availability of an extension, without changing anything. */
  async quote(bookingId: string, unitIn: unknown, amountIn: unknown): Promise<ExtensionQuote> {
    const { unit, amount } = this.check(unitIn, amountIn);
    const { row, api } = await this.booking(bookingId);
    if (row.status !== 'CONFIRMED' && row.status !== 'ACTIVE') throw new BadRequestException('Only an upcoming or active rental can be extended.');
    const vehicle = await this.bookings.vehicleWithRates(row.vehicleId);
    const rules = await this.bookings.pricing();
    const rates = this.bookings.ratesFor(vehicle, rules);
    if (!rates) throw new BadRequestException('This car has no price yet. Add its daily price first.');
    const withDriver = !!api.driverId || api.withDriver === true;

    const daily = Math.round(rates.daily);
    const driverDaily = withDriver ? Math.round(rates.driverPerDay) : 0;
    const perHour = (perDay: number) => Math.min(Math.round(perDay / 10) * amount, perDay);
    const extraRent = unit === 'days' ? daily * amount : perHour(daily);
    const extraDriver = unit === 'days' ? driverDaily * amount : perHour(driverDaily);
    const extraSubtotal = extraRent + extraDriver;
    const extraTax = Math.round(extraSubtotal * rules.taxRate);

    const from = row.returnAt;
    const to = new Date(from.getTime() + amount * (unit === 'days' ? 24 : 1) * HOUR_MS);
    const next = await this.bookings.nextBookingOfVehicle(row.vehicleId, row.id, from);
    const available = !next || next.pickupAt >= to;
    const hourCapped = unit === 'hours' && Math.round(daily / 10) * amount > daily;
    const explain =
      unit === 'days'
        ? `${plural(amount, 'day')} × ₹${daily.toLocaleString('en-IN')}${driverDaily ? ` + driver ${plural(amount, 'day')} × ₹${driverDaily.toLocaleString('en-IN')}` : ''}`
        : hourCapped
          ? `${plural(amount, 'hour')}, charged as one day (₹${daily.toLocaleString('en-IN')}) because hours cost more than a day${driverDaily ? ' (driver the same)' : ''}`
          : `${plural(amount, 'hour')} × ₹${Math.round(daily / 10).toLocaleString('en-IN')} (a tenth of the daily price)${driverDaily ? ` + driver ${plural(amount, 'hour')} × ₹${Math.round(driverDaily / 10).toLocaleString('en-IN')}` : ''}`;
    return {
      unit,
      amount,
      newReturnDate: isoDate(to),
      newReturnTime: clockLabel(to),
      extraRent,
      extraDriver,
      extraSubtotal,
      extraTax,
      extraTotal: extraSubtotal + extraTax,
      explain,
      available,
      latestReturn: next ? { date: isoDate(next.pickupAt), time: clockLabel(next.pickupAt) } : undefined,
      problem: available ? undefined : `This car is booked again from ${label(next!.pickupAt)}. You can extend until then at most.`,
    };
  }

  /** Moves the return time; the database refuses it if another booking of the car overlaps. */
  private async moveReturn(bookingId: string, patch: Json) {
    return this.bookings.patchBooking(bookingId, patch);
  }

  private pending(api: Json) {
    return extensionsOf(api).find((e) => e.status === 'Requested');
  }

  /** A customer asks for more time. The car is held at once; staff approve or decline. */
  async request(bookingId: string, unitIn: unknown, amountIn: unknown, actor: Actor) {
    const { api } = await this.booking(bookingId);
    if (this.pending(api)) throw new ConflictException('You already asked for an extension of this rental. Please wait for KeyGo to answer it.');
    const q = await this.quote(bookingId, unitIn, amountIn);
    if (!q.available) throw new ConflictException(q.problem);
    const ext = this.newExtension(api, q, 'Requested', actor);
    const saved = await this.moveReturn(bookingId, { returnDate: q.newReturnDate, returnTime: q.newReturnTime, extensions: [...extensionsOf(api), ext] });
    await this.quietly(() => this.store.notify({
      type: 'return',
      title: 'Extension requested',
      message: `${api.customerName} asks to extend ${bookingId} by ${plural(q.amount, q.unit === 'days' ? 'day' : 'hour')} to ${label(at(q.newReturnDate, q.newReturnTime))} (+₹${q.extraTotal.toLocaleString('en-IN')}). Approve or decline it on the booking.`,
    }));
    await this.quietly(() => this.audit.log(actor, 'booking.extension_requested', { type: 'booking', id: bookingId, name: String(api.customerName) }, { unit: q.unit, amount: q.amount, to: `${q.newReturnDate} ${q.newReturnTime}`, extraTotal: q.extraTotal }));
    return saved;
  }

  /** Staff extend directly: priced, checked and applied at once. */
  async extendNow(bookingId: string, unitIn: unknown, amountIn: unknown, actor: Actor) {
    const { api } = await this.booking(bookingId);
    if (this.pending(api)) throw new ConflictException('The customer has asked for an extension of this rental. Approve or decline it first.');
    const q = await this.quote(bookingId, unitIn, amountIn);
    if (!q.available) throw new ConflictException(q.problem);
    const ext = { ...this.newExtension(api, q, 'Approved', actor), decidedBy: actor.name, decidedAt: new Date().toISOString() };
    const saved = await this.moveReturn(bookingId, { returnDate: q.newReturnDate, returnTime: q.newReturnTime, ...this.withCharges(api, ext), extensions: [...extensionsOf(api), ext] });
    await this.tellCustomer(api, `Your rental ${bookingId} was extended to ${label(at(q.newReturnDate, q.newReturnTime))}. Extra charge ₹${q.extraTotal.toLocaleString('en-IN')}.`, 'Rental extended');
    await this.quietly(() => this.audit.log(actor, 'booking.extended', { type: 'booking', id: bookingId, name: String(api.customerName) }, { unit: q.unit, amount: q.amount, to: `${q.newReturnDate} ${q.newReturnTime}`, extraTotal: q.extraTotal }));
    return saved;
  }

  async approve(bookingId: string, extensionId: string, actor: Actor) {
    const { api } = await this.booking(bookingId);
    const ext = extensionsOf(api).find((e) => e.id === extensionId);
    if (!ext) throw new NotFoundException('Extension not found.');
    if (ext.status !== 'Requested') throw new ConflictException(`This extension was already ${ext.status.toLowerCase()}.`);
    const done: Extension = { ...ext, status: 'Approved', decidedBy: actor.name, decidedAt: new Date().toISOString() };
    const saved = await this.bookings.patchBooking(bookingId, { ...this.withCharges(api, done), extensions: extensionsOf(api).map((e) => (e.id === ext.id ? done : e)) });
    await this.tellCustomer(api, `KeyGo approved your extension of ${bookingId}. New return: ${label(at(ext.toReturnDate, ext.toReturnTime))}. Extra charge ₹${ext.extraTotal.toLocaleString('en-IN')}.`, 'Extension approved');
    await this.quietly(() => this.audit.log(actor, 'booking.extension_approved', { type: 'booking', id: bookingId, name: String(api.customerName) }, { unit: ext.unit, amount: ext.amount, extraTotal: ext.extraTotal }));
    return saved;
  }

  async decline(bookingId: string, extensionId: string, reason: unknown, actor: Actor) {
    const { api } = await this.booking(bookingId);
    const ext = extensionsOf(api).find((e) => e.id === extensionId);
    if (!ext) throw new NotFoundException('Extension not found.');
    if (ext.status !== 'Requested') throw new ConflictException(`This extension was already ${ext.status.toLowerCase()}.`);
    const why = typeof reason === 'string' ? reason.trim().slice(0, 200) : '';
    if (!why) throw new BadRequestException('Give a reason so the customer knows why.');
    const done: Extension = { ...ext, status: 'Declined', decidedBy: actor.name, decidedAt: new Date().toISOString(), declineReason: why };
    // Give the held time back
    const saved = await this.moveReturn(bookingId, { returnDate: ext.fromReturnDate, returnTime: ext.fromReturnTime, extensions: extensionsOf(api).map((e) => (e.id === ext.id ? done : e)) });
    await this.tellCustomer(api, `KeyGo could not extend ${bookingId}: ${why}. Please return the car on ${label(at(ext.fromReturnDate, ext.fromReturnTime))}.`, 'Extension declined');
    await this.quietly(() => this.audit.log(actor, 'booking.extension_declined', { type: 'booking', id: bookingId, name: String(api.customerName) }, { unit: ext.unit, amount: ext.amount, reason: why }));
    return saved;
  }

  private newExtension(api: Json, q: ExtensionQuote, status: Extension['status'], actor: Actor): Extension {
    return {
      id: `EXT-${randomUUID().slice(0, 8).toUpperCase()}`,
      unit: q.unit,
      amount: q.amount,
      fromReturnDate: String(api.returnDate),
      fromReturnTime: String(api.returnTime),
      toReturnDate: q.newReturnDate,
      toReturnTime: q.newReturnTime,
      extraRent: q.extraRent,
      extraDriver: q.extraDriver,
      extraSubtotal: q.extraSubtotal,
      extraTax: q.extraTax,
      extraTotal: q.extraTotal,
      status,
      requestedBy: actor.name,
      requestedByRole: actor.role,
      requestedAt: new Date().toISOString(),
    };
  }

  /** The booking's money and length after adding an approved extension. */
  private withCharges(api: Json, ext: Extension): Json {
    const num = (v: unknown) => Number(v) || 0;
    return {
      subtotal: num(api.subtotal) + ext.extraSubtotal,
      tax: num(api.tax) + ext.extraTax,
      totalAmount: num(api.totalAmount) + ext.extraTotal,
      days: num(api.days) + (ext.unit === 'days' ? ext.amount : 0),
      extraHours: num(api.extraHours) + (ext.unit === 'hours' ? ext.amount : 0),
      extensionCharges: num(api.extensionCharges) + ext.extraTotal,
    };
  }

  /** Notifications and log entries must never undo or fail the extension itself. */
  private async quietly(task: () => Promise<unknown>) {
    try {
      await task();
    } catch (e) {
      this.logger.error(`Could not record a notification or log entry: ${(e as Error).message}`);
    }
  }

  private async tellCustomer(api: Json, message: string, title: string) {
    if (api.customerId) await this.quietly(() => this.store.notify({ type: 'booking', title, message, customerId: String(api.customerId) }));
  }
}
