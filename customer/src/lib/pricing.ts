import { RentalTerm, Vehicle } from '../types';
import { ratesFor, TAX_RATE } from '../data/pricing';

/** Rules that turn the rates in data/pricing.ts into quotes. */
export const PRICING_RULES = {
  taxRate: TAX_RATE,
  minDays: { Daily: 1, Weekly: 7, Monthly: 30 } as Record<RentalTerm, number>,
};

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
export function computeQuote(vehicle: Pick<Vehicle, 'id' | 'pricePerDay'>, days: number, term: RentalTerm, manualDiscount = 0): Quote {
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
