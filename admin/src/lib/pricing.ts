import { RentalTerm, Vehicle } from '../types';

/**
 * Sample pricing rules used to generate quotes in the UI.
 * These are placeholders — final rates, discounts and tax rules must come from the business/backend.
 */
export const PRICING_RULES = {
  termDiscount: { Daily: 0, Weekly: 0.1, Monthly: 0.25 } as Record<RentalTerm, number>,
  taxRate: 0.18,
  depositByCategory: { SUV: 5000, Sedan: 5000, Electric: 5000, Luxury: 15000 } as Record<Vehicle['type'], number>,
  minDays: { Daily: 1, Weekly: 7, Monthly: 30 } as Record<RentalTerm, number>,
};

export interface Quote {
  days: number;
  ratePerDay: number;
  base: number;
  termDiscount: number;
  manualDiscount: number;
  subtotal: number;
  tax: number;
  total: number;
  deposit: number;
}

export function computeQuote(
  vehicle: Pick<Vehicle, 'pricePerDay' | 'type'>,
  days: number,
  term: RentalTerm,
  manualDiscount = 0
): Quote {
  const d = Math.max(1, Math.round(days));
  const base = vehicle.pricePerDay * d;
  const termDiscount = Math.round(base * PRICING_RULES.termDiscount[term]);
  const discount = Math.min(Math.max(0, manualDiscount), base - termDiscount);
  const subtotal = base - termDiscount - discount;
  const tax = Math.round(subtotal * PRICING_RULES.taxRate);
  return {
    days: d,
    ratePerDay: vehicle.pricePerDay,
    base,
    termDiscount,
    manualDiscount: discount,
    subtotal,
    tax,
    total: subtotal + tax,
    deposit: PRICING_RULES.depositByCategory[vehicle.type],
  };
}

/** Suggests the rental term that matches a trip length. */
export function termForDays(days: number): RentalTerm {
  if (days >= PRICING_RULES.minDays.Monthly) return 'Monthly';
  if (days >= PRICING_RULES.minDays.Weekly) return 'Weekly';
  return 'Daily';
}
