import type { Booking, Driver, DriverLeave } from '../../types';

export type Availability = 'On Trip' | 'On leave' | 'On Duty' | 'Off Duty';

/** The leave that covers a date, if any. */
export const leaveOn = (d: Driver, date: string): DriverLeave | undefined => (d.leaves ?? []).find((l) => l.from <= date && l.to >= date);

/** A leave that overlaps the dates of a trip, if any. */
export const leaveDuring = (d: Driver, from: string, to: string): DriverLeave | undefined => (d.leaves ?? []).find((l) => l.from <= to && l.to >= from);

/**
 * Where the driver is today: on a trip while a booking they drive is active, on leave on leave days, otherwise
 * the duty status staff set.
 */
export function availability(d: Driver, bookings: Booking[], today: string): Availability {
  if (bookings.some((b) => b.driverId === d.id && b.status === 'Active')) return 'On Trip';
  if (leaveOn(d, today)) return 'On leave';
  return d.dutyStatus === 'On Trip' ? 'On Duty' : d.dutyStatus;
}
