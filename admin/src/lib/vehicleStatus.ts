import type { Booking, VehicleStatus } from '../types';

/**
 * A car's status from its bookings — the same rule the server applies and enforces:
 * On Rent while a rental is active, Reserved on the days of a confirmed booking, otherwise Available.
 * Maintenance and Sold are set by staff and are kept.
 */
export function lifecycleStatus(current: VehicleStatus, vehicleId: string, bookings: Booking[], today: string): VehicleStatus {
  if (current === 'Sold' || current === 'Maintenance') return current;
  const mine = bookings.filter((b) => b.vehicleId === vehicleId);
  if (mine.some((b) => b.status === 'Active')) return 'On Rent';
  if (mine.some((b) => b.status === 'Confirmed' && b.pickupDate <= today && b.returnDate >= today)) return 'Reserved';
  return 'Available';
}
