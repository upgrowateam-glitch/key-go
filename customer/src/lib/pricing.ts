import { RentalTerm, Vehicle } from '../types';
import { ratesFor, TAX_RATE } from '../data/pricing';

/**
 * Rules that turn a vehicle's price list into a quote, as set by KeyGo in the admin portal (Settings → Rental
 * pricing). They arrive with the workspace (applyPricingRules); the server applies the same rules to every booking.
 */
export const PRICING_RULES = {
  taxRate: TAX_RATE,
  termDiscount: { Daily: 0, Weekly: 0.1, Monthly: 0.25 } as Record<RentalTerm, number>,
  minDays: { Daily: 1, Weekly: 7, Monthly: 30 } as Record<RentalTerm, number>,
};

/** Uses KeyGo's current rules (sent by the server). Unknown or missing values keep the previous ones. */
export function applyPricingRules(rules: { taxRate?: number; termDiscount?: Partial<Record<RentalTerm, number>>; minDays?: Partial<Record<RentalTerm, number>> } | undefined) {
  if (!rules) return;
  if (typeof rules.taxRate === 'number') PRICING_RULES.taxRate = rules.taxRate;
  Object.assign(PRICING_RULES.termDiscount, rules.termDiscount ?? {});
  Object.assign(PRICING_RULES.minDays, rules.minDays ?? {});
}

export interface Quote {
  days: number;
  ratePerDay: number;
  base: number;
  /** Saving from the weekly or monthly rate compared with paying the daily rate. */
  termDiscount: number;
  manualDiscount: number;
  subtotal: number;
  tax: number;
  total: number;
  deposit: number;
}

/** Days charged at the term's rate: the weekly rate covers 7 days, the monthly rate 30, prorated beyond that. */
export function computeQuote(vehicle: Pick<Vehicle, 'pricePerDay' | 'rates'>, days: number, term: RentalTerm, manualDiscount = 0): Quote {
  const rates = ratesFor(vehicle);
  const d = Math.max(1, Math.round(days));
  const base = rates.daily * d;
  const termAmount = term === 'Weekly' ? Math.round((rates.weekly / 7) * d) : term === 'Monthly' ? Math.round((rates.monthly / 30) * d) : base;
  const termDiscount = Math.max(0, base - termAmount);
  const discount = Math.min(Math.max(0, manualDiscount), base - termDiscount);
  const subtotal = base - termDiscount - discount;
  const tax = Math.round(subtotal * PRICING_RULES.taxRate);
  return {
    days: d,
    ratePerDay: rates.daily,
    base,
    termDiscount,
    manualDiscount: discount,
    subtotal,
    tax,
    total: subtotal + tax,
    deposit: rates.deposit,
  };
}

/** Suggests the rental term that matches a trip length. */
export function termForDays(days: number): RentalTerm {
  if (days >= PRICING_RULES.minDays.Monthly) return 'Monthly';
  if (days >= PRICING_RULES.minDays.Weekly) return 'Weekly';
  return 'Daily';
}
