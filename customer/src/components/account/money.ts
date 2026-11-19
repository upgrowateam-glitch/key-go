import type { Booking, FASTagLog } from '../../types';

/** The signed-in customer's bookings, newest pickup first. */
export const myBookings = (bookings: Booking[], customerId: string) =>
  bookings.filter((b) => b.customerId === customerId).sort((a, b) => b.pickupDate.localeCompare(a.pickupDate));

/** What the customer has paid on a booking, from its payment status. */
export function paidOn(b: Booking) {
  if (b.paymentStatus === 'Paid') return b.totalAmount + b.depositAmount;
  if (b.paymentStatus === 'Deposit paid') return b.depositAmount;
  return 0;
}

/** What is still owed on a booking that is going ahead. */
export function dueOn(b: Booking) {
  if (b.status === 'Cancelled' || b.paymentStatus === 'Refunded') return 0;
  if (b.paymentStatus === 'Unpaid') return b.totalAmount + b.depositAmount;
  if (b.paymentStatus === 'Deposit paid') return b.totalAmount;
  return 0;
}

export type DepositState = 'Not paid' | 'Held' | 'Refunded';
export function depositState(b: Booking): DepositState {
  if (b.paymentStatus === 'Refunded') return 'Refunded';
  if (b.paymentStatus === 'Unpaid') return 'Not paid';
  return 'Held';
}

export interface ExtraCharge {
  id: string;
  bookingId: string;
  label: string;
  amount: number;
  date: string;
}

/** Fuel, toll, fine and damage charges on the customer's bookings, plus FASTag tolls billed to them. */
export function additionalCharges(mine: Booking[], fastagLogs: FASTagLog[]): ExtraCharge[] {
  const out: ExtraCharge[] = [];
  const ids = new Set(mine.map((b) => b.id));
  for (const b of mine) {
    const date = b.completedAt ?? b.returnDate;
    const add = (kind: string, amount?: number) => {
      if (amount && amount > 0) out.push({ id: `${b.id}-${kind}`, bookingId: b.id, label: `${kind} · ${b.vehicleName}`, amount, date });
    };
    add('Damage', b.damageCharges);
    add('Fuel', b.fuelCharges);
    add('Tolls', b.tollCharges);
    add('Fines', b.fineCharges);
  }
  // FASTag tolls are listed one by one only when the booking has no toll total yet
  const tollTotals = new Set(mine.filter((b) => (b.tollCharges ?? 0) > 0).map((b) => b.id));
  for (const t of fastagLogs) {
    if (t.billedToCustomer && t.bookingId && ids.has(t.bookingId) && !tollTotals.has(t.bookingId)) {
      out.push({ id: t.id, bookingId: t.bookingId, label: `Toll · ${t.plazaName}`, amount: t.amount, date: t.dateTime.slice(0, 10) });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
