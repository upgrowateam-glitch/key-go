import { Booking } from '../types';

/** Statuses that hold a vehicle. Quotes do not block it; the backend must enforce this atomically at confirmation. */
const HOLDING: Booking['status'][] = ['Confirmed', 'Active'];

function toMinutes(time: string) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(time.trim());
  if (!m) return 0;
  const hour = parseInt(m[1], 10) % (m[3] ? 12 : 24);
  return (m[3]?.toUpperCase() === 'PM' ? hour + 12 : hour) * 60 + parseInt(m[2], 10);
}

const stamp = (date: string, time: string) => new Date(`${date}T00:00:00Z`).getTime() / 60000 + toMinutes(time);

/** Bookings on this vehicle that overlap the requested date and time range. */
export function findConflicts(
  bookings: Booking[],
  vehicleId: string,
  range: { pickupDate: string; pickupTime: string; returnDate: string; returnTime: string }
) {
  const from = stamp(range.pickupDate, range.pickupTime);
  const to = stamp(range.returnDate, range.returnTime);
  return bookings.filter(
    (b) =>
      b.vehicleId === vehicleId &&
      HOLDING.includes(b.status) &&
      stamp(b.pickupDate, b.pickupTime) < to &&
      from < stamp(b.returnDate, b.returnTime)
  );
}

/** Upcoming periods the vehicle is held, without any customer details. */
export function heldPeriods(bookings: Booking[], vehicleId: string, today: string) {
  return bookings
    .filter((b) => b.vehicleId === vehicleId && HOLDING.includes(b.status) && b.returnDate >= today)
    .map((b) => ({ from: b.pickupDate, to: b.returnDate }))
    .sort((a, b) => a.from.localeCompare(b.from));
}
