import { newId } from '../config/defaults';
import { daysBetween } from '../lib/format';
import { serverDoc } from '../lib/serverState';
import { TODAY } from '../lib/today';
import type { Booking, FinanceCategory, FinanceEntry } from '../types';

/**
 * Finance records recorded in the portal: extra ledger entries, payments, refunds, fines and loan EMIs.
 * They are stored on the server as one document; rental income and maintenance costs come from the
 * finance entries in the portal state.
 */

export type LedgerCategory = FinanceCategory | 'Other';

export interface LedgerEntry extends Omit<FinanceEntry, 'category'> {
  category: LedgerCategory;
  /** Entered by hand in the portal, so it can be removed again. */
  session?: boolean;
}

export const INCOME_CATEGORIES: LedgerCategory[] = ['Rental income', 'Fine collection'];
export const EXPENSE_CATEGORIES: LedgerCategory[] = ['Maintenance', 'Loan EMI', 'Fuel', 'Toll', 'Salary', 'Commission', 'Other'];

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
  /** Recorded in the portal (rather than taken from the booking's payment status), so it can be voided. */
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

interface FinanceBook {
  ledgerExtras: LedgerEntry[];
  payments: PaymentRecord[];
  refunds: RefundRecord[];
  fines: FineRecord[];
  loanTerms: LoanTerms[];
  emiPayments: EmiPayment[];
}

const book = serverDoc<FinanceBook>('finance.book', { ledgerExtras: [], payments: [], refunds: [], fines: [], loanTerms: [], emiPayments: [] });
const current = () => book.get();
const save = (patch: Partial<FinanceBook>) => book.set({ ...current(), ...patch });

const ledgerEntry = (entry: Omit<LedgerEntry, 'id' | 'session'>): LedgerEntry => ({ ...entry, id: newId('LED'), session: true });

// ---------------------------------------------------------------- ledger

export const fetchLedgerExtras = async () => current().ledgerExtras;

export interface ExpenseInput {
  date: string;
  category: LedgerCategory;
  amount: number;
  vehicleId?: string;
  reference: string;
}

export const addExpense = async (input: ExpenseInput) => {
  const created = ledgerEntry({ ...input, direction: 'out' });
  await save({ ledgerExtras: [created, ...current().ledgerExtras] });
  return created;
};

export const addLedgerEntry = async (entry: Omit<LedgerEntry, 'id' | 'session'>) => {
  const created = ledgerEntry(entry);
  await save({ ledgerExtras: [created, ...current().ledgerExtras] });
  return created;
};

export const removeLedgerEntry = async (id: string) => {
  await save({ ledgerExtras: current().ledgerExtras.filter((e) => e.id !== id) });
};

// ---------------------------------------------------------------- payments & refunds

export const fetchPayments = async () => current().payments;
export const fetchRefunds = async () => current().refunds;

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

export const recordPayment = async (input: PaymentInput) => {
  const txnRef = input.txnRef.trim() || `CASH-${input.date.replace(/-/g, '')}-${newId('R').slice(2)}`;
  const { payments, ledgerExtras } = current();
  if (findPaymentByRef(payments, txnRef)) throw new Error(`Transaction reference ${txnRef} is already recorded.`);
  const ledger = ledgerEntry({
    date: input.date,
    category: 'Rental income',
    direction: 'in',
    amount: input.amount,
    vehicleId: input.booking.vehicleId,
    reference: `${input.booking.id} · ${txnRef}`,
  });
  const created: PaymentRecord = {
    id: newId('PAY'),
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
  await save({ payments: [created, ...payments], ledgerExtras: [ledger, ...ledgerExtras] });
  return created;
};

/** Voids a payment recorded in the portal and reverses its ledger entry. */
export const voidPayment = async (id: string) => {
  const { payments, ledgerExtras } = current();
  const p = payments.find((x) => x.id === id);
  if (!p?.session) throw new Error('Only payments recorded in the portal can be voided.');
  await save({
    ledgerExtras: ledgerExtras.filter((e) => e.id !== p.ledgerRef),
    payments: payments.map((x) => (x.id === id ? { ...x, status: 'Voided' } : x)),
  });
};

export interface RefundInput {
  bookingId: string;
  customerName: string;
  amount: number;
  withheld: number;
  reason: string;
}

export const createRefund = async (input: RefundInput) => {
  const created: RefundRecord = { ...input, id: newId('RFD'), date: TODAY, status: 'Pending' };
  await save({ refunds: [created, ...current().refunds] });
  return created;
};

export const processRefund = async (id: string, txnRef: string) => {
  const ref = txnRef.trim();
  const { refunds } = current();
  if (refunds.some((r) => r.txnRef && normaliseRef(r.txnRef) === normaliseRef(ref))) throw new Error(`Transaction reference ${ref} is already recorded.`);
  await save({ refunds: refunds.map((r) => (r.id === id ? { ...r, status: 'Processed', txnRef: ref, date: TODAY } : r)) });
};

/** Bookings that owe money once a rental is agreed; quotes and cancellations do not. */
export const isBillable = (b: Booking) => b.status === 'Confirmed' || b.status === 'Active' || b.status === 'Completed';

/** Paid according to the booking's payment status, plus payments recorded in the portal. */
export function amountReceived(b: Booking, list: PaymentRecord[]) {
  const base = b.paymentStatus === 'Paid' || b.paymentStatus === 'Refunded' ? b.totalAmount : b.paymentStatus === 'Deposit paid' ? Math.min(b.depositAmount, b.totalAmount) : 0;
  const recorded = list.filter((p) => p.session && p.status === 'Received' && p.bookingId === b.id).reduce((s, p) => s + p.amount, 0);
  return base + recorded;
}

export const outstandingFor = (b: Booking, list: PaymentRecord[]) => (isBillable(b) ? Math.max(0, b.totalAmount - amountReceived(b, list)) : 0);

// ---------------------------------------------------------------- fines

export const fetchFines = async () => current().fines;

export const addFine = async (input: Omit<FineRecord, 'id' | 'status'>) => {
  const created: FineRecord = { ...input, id: newId('FINE'), status: 'Due' };
  await save({ fines: [created, ...current().fines] });
  return created;
};

export const collectFine = async (id: string, txnRef: string) => {
  const { fines, ledgerExtras } = current();
  const fine = fines.find((f) => f.id === id);
  if (!fine) throw new Error('This fine no longer exists.');
  const ledger = ledgerEntry({
    date: TODAY,
    category: 'Fine collection',
    direction: 'in',
    amount: fine.amount,
    vehicleId: fine.vehicleId,
    reference: `${fine.id} · ${txnRef.trim()}`,
  });
  await save({
    ledgerExtras: [ledger, ...ledgerExtras],
    fines: fines.map((f) => (f.id === id ? { ...f, status: 'Collected', txnRef: txnRef.trim(), ledgerRef: ledger.id } : f)),
  });
};

export const waiveFine = async (id: string) => {
  await save({ fines: current().fines.map((f) => (f.id === id ? { ...f, status: 'Waived' } : f)) });
};

// ---------------------------------------------------------------- loan EMI

export const fetchLoans = async () => ({ terms: current().loanTerms, payments: current().emiPayments });

/** Same day next month. */
const nextMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  const month = m === 12 ? 1 : m + 1;
  return `${m === 12 ? y + 1 : y}-${String(month).padStart(2, '0')}-${iso.slice(8)}`;
};

/** Loans with no recorded terms fall due at the start of next month. */
export const defaultNextDue = () => `${nextMonth(TODAY).slice(0, 7)}-01`;

export const payEmi = async (input: { vehicleId: string; bankName: string; amount: number; txnRef: string }) => {
  const ref = input.txnRef.trim();
  const { emiPayments, loanTerms, ledgerExtras } = current();
  if (emiPayments.some((p) => normaliseRef(p.txnRef) === normaliseRef(ref))) throw new Error(`Transaction reference ${ref} is already recorded.`);
  const terms = loanTerms.find((t) => t.vehicleId === input.vehicleId);
  const due = terms?.nextDue ?? defaultNextDue();
  await save({
    loanTerms: terms
      ? loanTerms.map((t) => (t.vehicleId === input.vehicleId ? { ...t, nextDue: nextMonth(due) } : t))
      : [...loanTerms, { vehicleId: input.vehicleId, nextDue: nextMonth(due) }],
    emiPayments: [{ id: newId('EMI'), vehicleId: input.vehicleId, date: TODAY, amount: input.amount, txnRef: ref }, ...emiPayments],
    ledgerExtras: [
      ledgerEntry({ date: TODAY, category: 'Loan EMI', direction: 'out', amount: input.amount, vehicleId: input.vehicleId, reference: `${input.bankName} · ${ref}` }),
      ...ledgerExtras,
    ],
  });
};

/** Not in the future and a real calendar date; expenses and payments are recorded after the fact. */
export function dateError(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) || Number.isNaN(Date.parse(value))) return 'Use the format YYYY-MM-DD';
  if (value > TODAY) return 'Cannot be after today';
  return undefined;
}
