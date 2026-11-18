import { Booking } from '../types';
import { DEMO_TODAY } from '../data/mockData';
import { daysBetween } from './format';

/** The rental workflow, in order. Each step maps to a screen in the app. */
export const RENTAL_STEPS = [
  { key: 'quote', label: 'Quote' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'agreement', label: 'Agreement' },
  { key: 'pickup', label: 'Pickup inspection' },
  { key: 'active', label: 'On rent' },
  { key: 'return', label: 'Return inspection' },
  { key: 'completed', label: 'Completed' },
] as const;

export type RentalStepKey = (typeof RENTAL_STEPS)[number]['key'];

/**
 * Index of the step currently in progress; earlier steps are done.
 * Returns RENTAL_STEPS.length once the rental is completed.
 */
export function currentStepIndex(b: Booking): number {
  if (b.status === 'Completed') return RENTAL_STEPS.length;
  if (b.status === 'Quoted' || b.status === 'Pending' || b.status === 'Cancelled') return 0;
  if (!b.agreementId) return 2;
  if (!b.pickupInspectionId) return 3;
  if (!b.returnInspectionId) return 4; // on rent
  return 6; // returned, awaiting settlement
}

/** What the operator should do next, with the route that does it. */
export function nextAction(b: Booking): { label: string; href: string } | null {
  if (b.status === 'Cancelled') return null;
  const id = encodeURIComponent(b.id);
  switch (currentStepIndex(b)) {
    case 0:
      return { label: 'Confirm booking', href: `/rental/${id}` };
    case 2:
      return { label: 'Sign agreement', href: `/rental/${id}/agreement` };
    case 3:
      return { label: 'Pickup inspection', href: `/rental/${id}/inspection?type=Pickup` };
    case 4:
      return { label: 'Return inspection', href: `/rental/${id}/inspection?type=Return` };
    case 6:
      return { label: 'Settle & complete', href: `/rental/${id}` };
    default:
      return null;
  }
}

/** True when an active rental is past its return date. */
export function isOverdue(b: Booking, today = DEMO_TODAY) {
  return b.status === 'Active' && daysBetween(b.returnDate, today) > 0;
}

/** Days of the rental elapsed so far (for active rentals). */
export function elapsedDays(b: Booking, today = DEMO_TODAY) {
  return Math.max(0, Math.min(b.days + 30, daysBetween(b.pickupDate, today)));
}

/** Whether the T-2 pickup reminder is scheduled/sent for a booking. */
export function reminderState(b: Booking, today = DEMO_TODAY): 'sent' | 'scheduled' | 'none' {
  if (!b.reminderScheduledFor || b.status === 'Cancelled' || b.status === 'Completed') {
    return b.reminderSent ? 'sent' : 'none';
  }
  if (b.reminderSent) return 'sent';
  return daysBetween(today, b.reminderScheduledFor) >= 0 ? 'scheduled' : 'none';
}
