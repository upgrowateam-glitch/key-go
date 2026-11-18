import { Booking } from '../types';

/** What the next payment step asks for: the deposit first, then the rental balance. */
export function amountDue(b: Booking) {
  if (b.status === 'Cancelled' || b.status === 'Completed') return 0;
  if (b.paymentStatus === 'Unpaid') return b.depositAmount;
  if (b.paymentStatus === 'Deposit paid') return b.totalAmount;
  return 0;
}
