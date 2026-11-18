/** Vehicle price list in rupees (stored in paise in vehicle_rates). */
export interface Rates {
  daily: number;
  weekly: number;
  monthly: number;
  deposit: number;
  driverPerDay: number;
}

export type Term = 'Daily' | 'Weekly' | 'Monthly';

/** GST on the rental amount. */
export const TAX_RATE = 0.18;

/** Rates derived from a daily price, for vehicles that have no full price list yet. */
export const ratesFromDaily = (daily: number, deposit = 5000, driverPerDay = 800): Rates => ({
  daily,
  weekly: Math.round(daily * 7 * 0.9),
  monthly: Math.round(daily * 30 * 0.75),
  deposit,
  driverPerDay,
});

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
 * Same rules as the apps: the weekly rate covers 7 days and the monthly rate 30, prorated beyond that;
 * the saving against the daily rate shows as the term discount.
 */
export function computeQuote(rates: Rates, days: number, term: Term, manualDiscount = 0): Quote {
  const d = Math.max(1, Math.round(days));
  const base = rates.daily * d;
  const termAmount = term === 'Weekly' ? Math.round((rates.weekly / 7) * d) : term === 'Monthly' ? Math.round((rates.monthly / 30) * d) : base;
  const termDiscount = Math.max(0, base - termAmount);
  const discount = Math.min(Math.max(0, manualDiscount), base - termDiscount);
  const subtotal = base - termDiscount - discount;
  const tax = Math.round(subtotal * TAX_RATE);
  return { days: d, ratePerDay: rates.daily, base, termDiscount, manualDiscount: discount, subtotal, tax, total: subtotal + tax, deposit: rates.deposit };
}
