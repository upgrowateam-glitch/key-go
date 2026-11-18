import type { Booking, BookingStatus } from '../types';
import { parseISODate } from './format';

/** A quote does not reserve the vehicle; only these statuses hold it. */
export const HOLDING_STATUSES: readonly BookingStatus[] = ['Confirmed', 'Active'];

export interface RentalWindow {
  vehicleId: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
}

/** Minutes after midnight for "10:00 AM" or "18:30". Null when the text is not a time. */
export function parseTimeMinutes(time: string): number | null {
  const m = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const period = m[3]?.toUpperCase();
  if (period ? hours < 1 || hours > 12 : hours > 23) return null;
  const h24 = period ? (hours % 12) + (period === 'PM' ? 12 : 0) : hours;
  return h24 * 60 + Number(m[2]);
}

const END_OF_DAY = 23 * 60 + 59;

function instant(date: string, minutes: number) {
  const d = parseISODate(date);
  return d ? d.getTime() + minutes * 60000 : null;
}

/** An unreadable time widens the window to the whole day, so it can never hide a clash. */
function bounds(w: Omit<RentalWindow, 'vehicleId'>) {
  const start = instant(w.pickupDate, parseTimeMinutes(w.pickupTime) ?? 0);
  const end = instant(w.returnDate, parseTimeMinutes(w.returnTime) ?? END_OF_DAY);
  return start === null || end === null ? null : { start, end };
}

/**
 * Bookings that hold the vehicle during the window. Both ends are inclusive, so a pickup at the exact
 * minute of another booking's return is a clash.
 *
 * This only guards the UI against bookings this client can see. The backend must enforce the same rule
 * atomically (e.g. an exclusion constraint per vehicle), otherwise two operators can still double-book.
 */
export function findConflicts(
  bookings: readonly Booking[],
  window: RentalWindow,
  options: { excludeBookingId?: string; today?: string } = {}
): Booking[] {
  const wanted = bounds(window);
  if (!wanted) return [];
  return bookings.filter((b) => {
    if (b.vehicleId !== window.vehicleId || b.id === options.excludeBookingId || !HOLDING_STATUSES.includes(b.status)) return false;
    const held = bounds(b);
    if (!held) return false;
    // An active rental past its return date still has the car until it comes back
    const stillOut = b.status === 'Active' && options.today ? instant(options.today, END_OF_DAY) : null;
    const end = stillOut !== null ? Math.max(held.end, stillOut) : held.end;
    return wanted.start <= end && held.start <= wanted.end;
  });
}
