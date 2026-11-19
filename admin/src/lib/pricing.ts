import { RentalTerm, Vehicle } from '../types';

import { effectiveRates, pricingRules } from './catalog';

/**
 * Pricing rules for quotes come from Settings → Rental pricing (see lib/catalog.ts); each car's daily price,
 * and its own weekly/monthly/deposit prices if set, come from the server. The server prices bookings the same way.
 */
export { pricingRules } from './catalog';

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

/**
 * The weekly rate covers 7 days and the monthly rate 30, prorated beyond that; the saving against the daily
 * rate shows as the term discount. Matches the server's calculation for bookings made in the customer app.
 */
export function computeQuote(vehicle: Pick<Vehicle, 'pricePerDay' | 'type' | 'rates' | 'customRates'>, days: number, term: RentalTerm, manualDiscount = 0): Quote {
  const rules = pricingRules();
  const rates = effectiveRates(vehicle, rules);
  const d = Math.max(1, Math.round(days));
  const base = rates.daily * d;
  const termAmount = term === 'Weekly' ? Math.round((rates.weekly / 7) * d) : term === 'Monthly' ? Math.round((rates.monthly / 30) * d) : base;
  const termDiscount = Math.max(0, base - termAmount);
  const discount = Math.min(Math.max(0, manualDiscount), base - termDiscount);
  const subtotal = base - termDiscount - discount;
  const tax = Math.round(subtotal * rules.taxRate);
  return { days: d, ratePerDay: rates.daily, base, termDiscount, manualDiscount: discount, subtotal, tax, total: subtotal + tax, deposit: rates.deposit };
}

/** Suggests the rental term that matches a trip length. */
export function termForDays(days: number): RentalTerm {
  const { minDays } = pricingRules();
  if (days >= minDays.Monthly) return 'Monthly';
  if (days >= minDays.Weekly) return 'Weekly';
  return 'Daily';
}
