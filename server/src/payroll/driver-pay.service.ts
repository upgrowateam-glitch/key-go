import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { todayIst } from '../common/dates';
import { BookingsService } from '../domain/bookings.service';
import type { Json } from '../domain/mappers';
import { StoreService } from '../domain/store.service';
import { AuditService, type Actor } from '../identity/audit.service';

export const ENTRY_TYPES = ['advance', 'deduction', 'bonus'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];
const ENTRY_LABEL: Record<EntryType, string> = { advance: 'Advance', deduction: 'Deduction', bonus: 'Bonus' };
const MAX_AMOUNT = 10_00_000;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** One completed trip and the commission it earns. */
interface Trip {
  bookingId: string;
  customerName: string;
  vehicleNumber: string;
  completedOn: string;
  /** Trip amount before tax (₹). */
  amount: number;
  commission: number;
}

export interface DriverPay {
  driverId: string;
  name: string;
  month: string;
  salary: number;
  /** Where the salary comes from: a salary record from that month or earlier, or the driver's profile. */
  salaryFrom: string;
  commissionPercent: number;
  trips: Trip[];
  commission: number;
  entries: Json[];
  advances: number;
  deductions: number;
  bonuses: number;
  /** salary + commission + bonuses − advances − deductions */
  payable: number;
  status: 'Open' | 'Finalised' | 'Paid';
  payslip?: Json;
}

const money = (v: unknown) => Math.round(Number(v) || 0);
const sum = (rows: Json[], type: EntryType) => rows.filter((e) => e.type === type).reduce((s, e) => s + money(e.amount), 0);
const payslipId = (driverId: string, month: string) => `${driverId}_${month}`;

/**
 * Driver pay, month by month, kept as separate records:
 * - salary records (driverSalaries): the monthly salary from a given month on;
 * - commission: worked out from the driver's completed trips (commission % × trip amount before tax);
 * - advances, deductions and bonuses (driverPayEntries), each with who added it and why;
 * - payslips (driverPayslips): the month's figures frozen when it is finalised, then marked paid.
 * Payable = salary + commission + bonuses − advances − deductions. Every change goes into the audit log.
 */
@Injectable()
export class DriverPayService {
  constructor(
    private readonly store: StoreService,
    private readonly bookings: BookingsService,
    private readonly audit: AuditService,
  ) {}

  private checkMonth(month: unknown): string {
    if (typeof month !== 'string' || !MONTH.test(month)) throw new BadRequestException('Month must look like 2026-11.');
    return month;
  }

  private async driver(driverId: string) {
    const d = await this.store.get('drivers', driverId);
    if (!d) throw new NotFoundException('Driver not found.');
    return d;
  }

  /** The salary in force for a month: the latest salary record from that month or earlier, else the profile. */
  private salaryFor(driver: Json, salaries: Json[], month: string) {
    const rec = salaries
      .filter((s) => s.driverId === driver.id && typeof s.from === 'string' && s.from <= month)
      .sort((a, b) => String(b.from).localeCompare(String(a.from)) || String(b.setAt).localeCompare(String(a.setAt)))[0];
    return rec ? { amount: money(rec.amount), from: `Salary from ${rec.from}` } : { amount: money(driver.monthlySalary), from: 'Driver profile' };
  }

  async month(monthInput: unknown, onlyDriver?: string): Promise<DriverPay[]> {
    const month = this.checkMonth(monthInput);
    const [drivers, salaries, entries, payslips, completed] = await Promise.all([
      this.store.list('drivers'),
      this.store.list('driverSalaries'),
      this.store.listWhere('driverPayEntries', (e) => e.month === month),
      this.store.listWhere('driverPayslips', (p) => p.month === month),
      this.bookings.listBookings({ status: 'COMPLETED' }),
    ]);
    return drivers
      .filter((d) => !onlyDriver || d.id === onlyDriver)
      .map((d) => {
        const payslip = payslips.find((p) => p.driverId === d.id);
        if (payslip) return { ...(payslip.figures as DriverPay), entries: entries.filter((e) => e.driverId === d.id), status: payslip.paidAt ? 'Paid' : 'Finalised', payslip } as DriverPay;
        const pct = Number(d.commissionPercent) || 0;
        const trips: Trip[] = completed
          .filter((b) => b.driverId === d.id && String(b.completedAt || b.returnDate || '').slice(0, 7) === month)
          .map((b) => {
            const amount = money(b.subtotal);
            return {
              bookingId: String(b.id),
              customerName: String(b.customerName ?? ''),
              vehicleNumber: String(b.vehicleNumber ?? ''),
              completedOn: String(b.completedAt || b.returnDate),
              amount,
              commission: Math.round((amount * pct) / 100),
            };
          });
        const own = entries.filter((e) => e.driverId === d.id);
        const salary = this.salaryFor(d, salaries, month);
        const commission = trips.reduce((s, t) => s + t.commission, 0);
        const advances = sum(own, 'advance');
        const deductions = sum(own, 'deduction');
        const bonuses = sum(own, 'bonus');
        return {
          driverId: String(d.id),
          name: String(d.name ?? d.id),
          month,
          salary: salary.amount,
          salaryFrom: salary.from,
          commissionPercent: pct,
          trips,
          commission,
          entries: own,
          advances,
          deductions,
          bonuses,
          payable: salary.amount + commission + bonuses - advances - deductions,
          status: 'Open' as const,
        };
      });
  }

  private async open(driverId: string, month: string) {
    if (await this.store.get('driverPayslips', payslipId(driverId, month))) {
      throw new ConflictException(`${month} is already finalised for this driver. Reopen it first to make changes.`);
    }
  }

  async addEntry(driverId: string, body: Json, actor: Actor) {
    const month = this.checkMonth(body.month);
    const type = body.type as EntryType;
    if (!ENTRY_TYPES.includes(type)) throw new BadRequestException('Type must be advance, deduction or bonus.');
    const amount = money(body.amount);
    if (amount <= 0 || amount > MAX_AMOUNT) throw new BadRequestException('Enter an amount between ₹1 and ₹10,00,000.');
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
    if (!note) throw new BadRequestException(`Say what the ${ENTRY_LABEL[type].toLowerCase()} is for.`);
    const d = await this.driver(driverId);
    await this.open(driverId, month);
    const id = randomUUID();
    const entry = { driverId, month, type, amount, note, date: typeof body.date === 'string' && body.date ? body.date : todayIst(), createdBy: actor.name, createdAt: new Date().toISOString() };
    await this.store.put('driverPayEntries', id, entry);
    await this.audit.log(actor, `pay.${type}_added`, { type: 'driver', id: driverId, name: String(d.name) }, { month, amount, note });
    return { ...entry, id };
  }

  async removeEntry(driverId: string, entryId: string, actor: Actor) {
    const e = await this.store.get('driverPayEntries', entryId);
    if (!e || e.driverId !== driverId) throw new NotFoundException('Entry not found.');
    await this.open(driverId, String(e.month));
    const d = await this.driver(driverId);
    await this.store.remove('driverPayEntries', entryId);
    await this.audit.log(actor, `pay.${String(e.type)}_removed`, { type: 'driver', id: driverId, name: String(d.name) }, { month: e.month, amount: e.amount, note: e.note });
  }

  async setSalary(driverId: string, body: Json, actor: Actor) {
    const from = this.checkMonth(body.from);
    const amount = money(body.amount);
    if (amount < 0 || amount > MAX_AMOUNT) throw new BadRequestException('Enter a monthly salary up to ₹10,00,000.');
    const d = await this.driver(driverId);
    await this.open(driverId, from);
    const id = randomUUID();
    const rec = { driverId, from, amount, note: typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '', setBy: actor.name, setAt: new Date().toISOString() };
    await this.store.put('driverSalaries', id, rec);
    // The profile shows the salary in force now
    if (from <= todayIst().slice(0, 7)) await this.store.patch('drivers', driverId, { monthlySalary: amount });
    await this.audit.log(actor, 'pay.salary_set', { type: 'driver', id: driverId, name: String(d.name) }, { from, amount, previous: d.monthlySalary });
    return { ...rec, id };
  }

  async salaryHistory(driverId: string) {
    return (await this.store.listWhere('driverSalaries', (s) => s.driverId === driverId)).sort((a, b) => String(b.from).localeCompare(String(a.from)));
  }

  async finalise(driverId: string, monthInput: unknown, actor: Actor) {
    const month = this.checkMonth(monthInput);
    await this.open(driverId, month);
    const [row] = await this.month(month, driverId);
    if (!row) throw new NotFoundException('Driver not found.');
    const { entries: _entries, status: _status, payslip: _p, ...figures } = row;
    const payslip = { driverId, month, figures, finalisedBy: actor.name, finalisedAt: new Date().toISOString() };
    await this.store.put('driverPayslips', payslipId(driverId, month), payslip);
    await this.audit.log(actor, 'pay.finalised', { type: 'driver', id: driverId, name: row.name }, { month, salary: row.salary, commission: row.commission, advances: row.advances, deductions: row.deductions, bonuses: row.bonuses, payable: row.payable });
    return (await this.month(month, driverId))[0];
  }

  async reopen(driverId: string, monthInput: unknown, actor: Actor) {
    const month = this.checkMonth(monthInput);
    const slip = await this.store.get('driverPayslips', payslipId(driverId, month));
    if (!slip) throw new BadRequestException('This month is not finalised.');
    if (slip.paidAt) throw new ConflictException('This month is already paid and cannot be reopened.');
    await this.store.remove('driverPayslips', payslipId(driverId, month));
    const d = await this.driver(driverId);
    await this.audit.log(actor, 'pay.reopened', { type: 'driver', id: driverId, name: String(d.name) }, { month });
    return (await this.month(month, driverId))[0];
  }

  async markPaid(driverId: string, body: Json, actor: Actor) {
    const month = this.checkMonth(body.month);
    const slip = await this.store.get('driverPayslips', payslipId(driverId, month));
    if (!slip) throw new BadRequestException('Finalise the month before marking it paid.');
    if (slip.paidAt) throw new ConflictException('Already marked paid.');
    const method = typeof body.method === 'string' && body.method.trim() ? body.method.trim().slice(0, 40) : 'Bank transfer';
    const reference = typeof body.reference === 'string' ? body.reference.trim().slice(0, 80) : '';
    const paid = { ...slip, paidAt: new Date().toISOString(), paidBy: actor.name, method, reference };
    await this.store.put('driverPayslips', payslipId(driverId, month), paid);
    const figures = slip.figures as DriverPay;
    await this.audit.log(actor, 'pay.paid', { type: 'driver', id: driverId, name: figures.name }, { month, amount: figures.payable, method, reference });
    return (await this.month(month, driverId))[0];
  }
}
