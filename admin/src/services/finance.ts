import { DEMO_TODAY } from '../data/mockData';
import { daysBetween } from '../lib/format';
import type { Booking, FinanceCategory, FinanceEntry } from '../types';
import { mockRequest } from './mockClient';

/**
 * Finance records that AppContext does not hold. Everything lives in this module, so changes survive tab switches
 * but reset on reload. Replace the bodies with NestJS calls when the backend exists.
 */

export type LedgerCategory = FinanceCategory | 'Other';

export interface LedgerEntry extends Omit<FinanceEntry, 'category'> {
  category: LedgerCategory;
  /** Added in this browser session, so it can still be removed. */
  session?: boolean;
}

export const INCOME_CATEGORIES: LedgerCategory[] = ['Rental income', 'Fine collection'];
export const EXPENSE_CATEGORIES: LedgerCategory[] = ['Maintenance', 'Loan EMI', 'Fuel', 'Toll', 'Salary', 'Commission', 'Other'];

let ledgerExtras: LedgerEntry[] = [
  { id: 'OTH-101', date: '2026-09-03', category: 'Other', direction: 'out', amount: 18000, reference: 'Hebbal yard rent (Sep)' },
  { id: 'OTH-102', date: '2026-09-11', category: 'Other', direction: 'out', amount: 4200, reference: 'Fleet wash contract' },
  { id: 'OTH-103', date: '2026-09-19', category: 'Other', direction: 'out', amount: 2600, vehicleId: 'car-3', reference: 'Airport parking permit' },
  { id: 'OTH-104', date: '2026-08-03', category: 'Other', direction: 'out', amount: 18000, reference: 'Hebbal yard rent (Aug)' },
  { id: 'OTH-105', date: '2026-08-14', category: 'Other', direction: 'out', amount: 3900, reference: 'Fleet wash contract' },
  { id: 'OTH-106', date: '2026-07-03', category: 'Other', direction: 'out', amount: 18000, reference: 'Hebbal yard rent (Jul)' },
];

let sequence = 1000;
const nextId = (prefix: string) => `${prefix}-${++sequence}`;

export const fetchLedgerExtras = () => mockRequest(() => ledgerExtras);

function pushLedger(entry: Omit<LedgerEntry, 'id' | 'session'>): LedgerEntry {
  const created: LedgerEntry = { ...entry, id: nextId('LED'), session: true };
  ledgerExtras = [created, ...ledgerExtras];
  return created;
}

export interface ExpenseInput {
  date: string;
  category: LedgerCategory;
  amount: number;
  vehicleId?: string;
  reference: string;
}

export const addExpense = (input: ExpenseInput) => mockRequest(() => pushLedger({ ...input, direction: 'out' }));

export const addLedgerEntry = (entry: Omit<LedgerEntry, 'id' | 'session'>) => mockRequest(() => pushLedger(entry));

export const removeLedgerEntry = (id: string) =>
  mockRequest(() => {
    ledgerExtras = ledgerExtras.filter((e) => e.id !== id);
  });

// ---------------------------------------------------------------- payments & refunds

export const PAYMENT_METHODS = ['UPI', 'Card', 'Bank transfer', 'Cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface PaymentRecord {
  id: string;
  txnRef: string;
  bookingId: string;
  customerName: string;
  method: PaymentMethod;
  amount: number;
  date: string;
  status: 'Received' | 'Voided';
  /** Ledger entry this payment posted to. */
  ledgerRef: string;
  session?: boolean;
}

export interface RefundRecord {
  id: string;
  txnRef?: string;
  bookingId: string;
  customerName: string;
  amount: number;
  /** Deposit retained for damage, fines or fuel at the time of refund. */
  withheld: number;
  reason: string;
  date: string;
  status: 'Pending' | 'Processed';
}

let payments: PaymentRecord[] = [
  { id: 'PAY-1005', txnRef: 'UPI/626711420981', bookingId: 'KG-8492', customerName: 'Ananya Sharma', method: 'UPI', amount: 12386, date: '2026-09-24', status: 'Received', ledgerRef: 'FIN-1' },
  { id: 'PAY-1004', txnRef: 'CARD/HDFC/881204', bookingId: 'KG-7104', customerName: 'Rahul Kapoor', method: 'Card', amount: 31856, date: '2026-09-22', status: 'Received', ledgerRef: 'FIN-2' },
  { id: 'PAY-1003', txnRef: 'NEFT/N264261045512', bookingId: 'KG-6299', customerName: 'Suresh Nambiar', method: 'Bank transfer', amount: 5000, date: '2026-09-21', status: 'Received', ledgerRef: 'FIN-3' },
  { id: 'PAY-1002', txnRef: 'UPI/625810337745', bookingId: 'KG-4102', customerName: 'Priya Iyer', method: 'UPI', amount: 17694, date: '2026-09-15', status: 'Received', ledgerRef: 'FIN-4' },
  { id: 'PAY-1001', txnRef: 'CARD/ICIC/640077', bookingId: 'KG-3987', customerName: 'Ananya Sharma', method: 'Card', amount: 21826, date: '2026-08-17', status: 'Received', ledgerRef: 'FIN-19' },
];

let refunds: RefundRecord[] = [
  { id: 'RFD-303', bookingId: 'KG-3310', customerName: 'Rahul Kapoor', amount: 15000, withheld: 0, reason: 'Booking cancelled, deposit returned', date: '2026-09-25', status: 'Pending' },
  { id: 'RFD-302', txnRef: 'NEFT/N259260071123', bookingId: 'KG-4102', customerName: 'Priya Iyer', amount: 5000, withheld: 0, reason: 'Deposit returned after rental', date: '2026-09-16', status: 'Processed' },
  { id: 'RFD-301', txnRef: 'NEFT/N229260018840', bookingId: 'KG-3987', customerName: 'Ananya Sharma', amount: 8500, withheld: 1500, reason: 'Deposit returned, damage charge retained', date: '2026-08-18', status: 'Processed' },
];

export const fetchPayments = () => mockRequest(() => payments);
export const fetchRefunds = () => mockRequest(() => refunds);

const normaliseRef = (ref: string) => ref.trim().toUpperCase();

/** A live payment that already uses this transaction reference. */
export const findPaymentByRef = (list: PaymentRecord[], ref: string) =>
  list.find((p) => p.status === 'Received' && normaliseRef(p.txnRef) === normaliseRef(ref));

/** A live payment for the same booking and amount within a week, the usual shape of a double entry. */
export const findLikelyDuplicate = (list: PaymentRecord[], bookingId: string, amount: number, date: string) =>
  list.find((p) => p.status === 'Received' && p.bookingId === bookingId && p.amount === amount && Math.abs(daysBetween(p.date, date)) <= 7);

export interface PaymentInput {
  booking: Pick<Booking, 'id' | 'customerName' | 'vehicleId'>;
  method: PaymentMethod;
  amount: number;
  date: string;
  /** Optional for cash, where a receipt reference is generated. */
  txnRef: string;
}

export const recordPayment = (input: PaymentInput) =>
  mockRequest(() => {
    const generated = `CASH-${input.date.replace(/-/g, '')}-${sequence + 1}`;
    const txnRef = input.txnRef.trim() || generated;
    if (findPaymentByRef(payments, txnRef)) throw new Error(`Transaction reference ${txnRef} is already recorded.`);
    const ledger = pushLedger({
      date: input.date,
      category: 'Rental income',
      direction: 'in',
      amount: input.amount,
      vehicleId: input.booking.vehicleId,
      reference: `${input.booking.id} · ${txnRef}`,
    });
    const created: PaymentRecord = {
      id: nextId('PAY'),
      txnRef,
      bookingId: input.booking.id,
      customerName: input.booking.customerName,
      method: input.method,
      amount: input.amount,
      date: input.date,
      status: 'Received',
      ledgerRef: ledger.id,
      session: true,
    };
    payments = [created, ...payments];
    return created;
  });

/** Only payments recorded in this session can be voided; their ledger entry is reversed with them. */
export const voidPayment = (id: string) =>
  mockRequest(() => {
    const p = payments.find((x) => x.id === id);
    if (!p?.session) throw new Error('Only payments recorded in this session can be voided.');
    ledgerExtras = ledgerExtras.filter((e) => e.id !== p.ledgerRef);
    payments = payments.map((x) => (x.id === id ? { ...x, status: 'Voided' } : x));
  });

export interface RefundInput {
  bookingId: string;
  customerName: string;
  amount: number;
  withheld: number;
  reason: string;
}

export const createRefund = (input: RefundInput) =>
  mockRequest(() => {
    const created: RefundRecord = { ...input, id: nextId('RFD'), date: DEMO_TODAY, status: 'Pending' };
    refunds = [created, ...refunds];
    return created;
  });

export const processRefund = (id: string, txnRef: string) =>
  mockRequest(() => {
    const ref = txnRef.trim();
    if (refunds.some((r) => r.txnRef && normaliseRef(r.txnRef) === normaliseRef(ref))) throw new Error(`Transaction reference ${ref} is already recorded.`);
    refunds = refunds.map((r) => (r.id === id ? { ...r, status: 'Processed', txnRef: ref, date: DEMO_TODAY } : r));
  });

/** Bookings that owe money once a rental is agreed; quotes and cancellations do not. */
export const isBillable = (b: Booking) => b.status === 'Confirmed' || b.status === 'Active' || b.status === 'Completed';

/** Paid according to the booking, plus payments recorded in this session. */
export function amountReceived(b: Booking, list: PaymentRecord[]) {
  const base = b.paymentStatus === 'Paid' || b.paymentStatus === 'Refunded' ? b.totalAmount : b.paymentStatus === 'Deposit paid' ? Math.min(b.depositAmount, b.totalAmount) : 0;
  const session = list.filter((p) => p.session && p.status === 'Received' && p.bookingId === b.id).reduce((s, p) => s + p.amount, 0);
  return base + session;
}

export const outstandingFor = (b: Booking, list: PaymentRecord[]) => (isBillable(b) ? Math.max(0, b.totalAmount - amountReceived(b, list)) : 0);

// ---------------------------------------------------------------- fines

export const FINE_TYPES = ['Late return', 'Damage', 'Traffic challan', 'Fuel shortfall', 'Other'] as const;
export type FineType = (typeof FINE_TYPES)[number];

export interface FineRecord {
  id: string;
  bookingId?: string;
  customerName: string;
  vehicleId?: string;
  type: FineType;
  amount: number;
  date: string;
  status: 'Due' | 'Collected' | 'Waived';
  txnRef?: string;
  ledgerRef?: string;
  note?: string;
}

let fines: FineRecord[] = [
  { id: 'FINE-207', bookingId: 'KG-7104', customerName: 'Rahul Kapoor', vehicleId: 'car-3', type: 'Late return', amount: 1500, date: '2026-09-26', status: 'Due', note: 'Return due 25 Sep, vehicle still out' },
  { id: 'FINE-206', bookingId: 'KG-8492', customerName: 'Ananya Sharma', vehicleId: 'car-1', type: 'Traffic challan', amount: 1000, date: '2026-09-25', status: 'Due', note: 'Red light, Hebbal flyover' },
  { id: 'FINE-205', bookingId: 'KG-7104', customerName: 'Rahul Kapoor', vehicleId: 'car-3', type: 'Traffic challan', amount: 2000, date: '2026-09-24', status: 'Due', note: 'Over speeding, Western Express Highway' },
  { id: 'FINE-204', bookingId: 'KG-4102', customerName: 'Priya Iyer', vehicleId: 'car-2', type: 'Late return', amount: 1200, date: '2026-09-15', status: 'Collected', txnRef: 'UPI/625810337790', ledgerRef: 'FIN-5' },
  { id: 'FINE-203', bookingId: 'KG-3987', customerName: 'Ananya Sharma', vehicleId: 'car-6', type: 'Damage', amount: 1500, date: '2026-08-17', status: 'Collected', txnRef: 'DEPOSIT/KG-3987', ledgerRef: 'FIN-23' },
  { id: 'FINE-202', customerName: 'Various customers', type: 'Other', amount: 2400, date: '2026-07-25', status: 'Collected', txnRef: 'SUMMARY/JUL-2026', ledgerRef: 'FIN-31', note: 'July fines posted as one summary' },
  { id: 'FINE-201', bookingId: 'KG-3310', customerName: 'Rahul Kapoor', vehicleId: 'car-3', type: 'Other', amount: 500, date: '2026-07-19', status: 'Waived', note: 'Cancellation fee waived' },
];

export const fetchFines = () => mockRequest(() => fines);

export const addFine = (input: Omit<FineRecord, 'id' | 'status'>) =>
  mockRequest(() => {
    const created: FineRecord = { ...input, id: nextId('FINE'), status: 'Due' };
    fines = [created, ...fines];
    return created;
  });

export const collectFine = (id: string, txnRef: string) =>
  mockRequest(() => {
    const fine = fines.find((f) => f.id === id);
    if (!fine) throw new Error('This fine no longer exists.');
    const ledger = pushLedger({
      date: DEMO_TODAY,
      category: 'Fine collection',
      direction: 'in',
      amount: fine.amount,
      vehicleId: fine.vehicleId,
      reference: `${fine.id} · ${txnRef.trim()}`,
    });
    fines = fines.map((f) => (f.id === id ? { ...f, status: 'Collected', txnRef: txnRef.trim(), ledgerRef: ledger.id } : f));
  });

export const waiveFine = (id: string) =>
  mockRequest(() => {
    fines = fines.map((f) => (f.id === id ? { ...f, status: 'Waived' } : f));
  });

// ---------------------------------------------------------------- loan EMI

export interface LoanTerms {
  vehicleId: string;
  ratePercent?: number;
  nextDue: string;
}

export interface EmiPayment {
  id: string;
  vehicleId: string;
  date: string;
  amount: number;
  txnRef: string;
}

const seedEmi = (vehicleId: string, bank: string, amount: number): EmiPayment[] =>
  ['2026-09-01', '2026-08-01', '2026-07-01'].map((date) => ({
    id: `EMI-${vehicleId}-${date.slice(5, 7)}`,
    vehicleId,
    date,
    amount,
    txnRef: `NACH/${bank}/${date.replace(/-/g, '').slice(2)}`,
  }));

let loanTerms: LoanTerms[] = [
  { vehicleId: 'car-1', ratePercent: 9.25, nextDue: '2026-10-01' },
  { vehicleId: 'car-2', ratePercent: 8.4, nextDue: '2026-10-01' },
  { vehicleId: 'car-3', ratePercent: 10.1, nextDue: '2026-10-01' },
  { vehicleId: 'car-4', ratePercent: 8.9, nextDue: '2026-10-01' },
];

let emiPayments: EmiPayment[] = [
  ...seedEmi('car-1', 'HDFC', 24500),
  ...seedEmi('car-2', 'ICICI', 28900),
  ...seedEmi('car-3', 'AXIS', 85000),
  ...seedEmi('car-4', 'SBI', 16200),
];

export const fetchLoans = () => mockRequest(() => ({ terms: loanTerms, payments: emiPayments }));

/** Same day next month; loans here all fall on the first, so month length never shifts the date. */
const nextMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  const month = m === 12 ? 1 : m + 1;
  return `${m === 12 ? y + 1 : y}-${String(month).padStart(2, '0')}-${iso.slice(8)}`;
};

/** Loans with no recorded terms (added from Fleet in this session) fall due at the start of next month. */
export const defaultNextDue = () => `${nextMonth(DEMO_TODAY).slice(0, 7)}-01`;

export const payEmi = (input: { vehicleId: string; bankName: string; amount: number; txnRef: string }) =>
  mockRequest(() => {
    const ref = input.txnRef.trim();
    if (emiPayments.some((p) => normaliseRef(p.txnRef) === normaliseRef(ref))) throw new Error(`Transaction reference ${ref} is already recorded.`);
    const current = loanTerms.find((t) => t.vehicleId === input.vehicleId);
    const due = current?.nextDue ?? defaultNextDue();
    loanTerms = current
      ? loanTerms.map((t) => (t.vehicleId === input.vehicleId ? { ...t, nextDue: nextMonth(due) } : t))
      : [...loanTerms, { vehicleId: input.vehicleId, nextDue: nextMonth(due) }];
    emiPayments = [{ id: nextId('EMI'), vehicleId: input.vehicleId, date: DEMO_TODAY, amount: input.amount, txnRef: ref }, ...emiPayments];
    pushLedger({ date: DEMO_TODAY, category: 'Loan EMI', direction: 'out', amount: input.amount, vehicleId: input.vehicleId, reference: `${input.bankName} · ${ref}` });
  });

/** Not in the future and a real calendar date; expenses and payments are recorded after the fact. */
export function dateError(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) || Number.isNaN(Date.parse(value))) return 'Use the format YYYY-MM-DD';
  if (value > DEMO_TODAY) return 'Cannot be after today';
  return undefined;
}
