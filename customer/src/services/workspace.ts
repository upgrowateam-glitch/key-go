import {
  INITIAL_AGREEMENTS,
  INITIAL_BOOKINGS,
  INITIAL_CUSTOMERS,
  INITIAL_FASTAG_LOGS,
  INITIAL_INSPECTIONS,
  INITIAL_LOYALTY_TIERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_VEHICLES,
} from '../data/mockData';
import { AgreementFine, Booking } from '../types';
import { computeQuote } from '../lib/pricing';
import { mockRequest } from './mockClient';

export const STANDARD_FINES: AgreementFine[] = [
  { id: 'f1', label: 'Late return (per hour)', amount: 500 },
  { id: 'f2', label: 'Smoking / deep cleaning', amount: 2000 },
  { id: 'f3', label: 'Lost key or key fob', amount: 5000 },
  { id: 'f4', label: 'Traffic challan admin fee (plus actual fine)', amount: 250 },
];

// Sample bookings take their amounts from data/pricing.ts, so a vehicle shows the same price on every screen
const priceBooking = (b: Booking): Booking => {
  const vehicle = INITIAL_VEHICLES.find((v) => v.id === b.vehicleId);
  if (!vehicle) return b;
  const q = computeQuote(vehicle, b.days, b.term);
  return { ...b, baseRatePerDay: q.ratePerDay, subtotal: q.subtotal, discount: q.termDiscount, tax: q.tax, totalAmount: q.total, depositAmount: q.deposit };
};

/** What the customer app loads on start. Replace with NestJS endpoints when the backend exists. */
export const loadWorkspace = () =>
  mockRequest(() => {
    const bookings = INITIAL_BOOKINGS.map(priceBooking);
    const agreements = INITIAL_AGREEMENTS.map((a) => {
      const b = bookings.find((x) => x.id === a.bookingId);
      return b ? { ...a, rentalAmount: b.totalAmount, securityDeposit: b.depositAmount } : a;
    });
    return {
    vehicles: INITIAL_VEHICLES,
    bookings,
    customers: INITIAL_CUSTOMERS,
    agreements,
    inspections: INITIAL_INSPECTIONS,
    fastagLogs: INITIAL_FASTAG_LOGS,
    notifications: INITIAL_NOTIFICATIONS,
    loyaltyTiers: INITIAL_LOYALTY_TIERS,
    standardFines: STANDARD_FINES,
    };
  });

export type Workspace = Awaited<ReturnType<typeof loadWorkspace>>;
