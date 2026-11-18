import { RentalTerm, Vehicle } from '../types';

/**
 * Pricing rules for quotes. Each vehicle's price list (daily, weekly, monthly, deposit) comes from the server,
 * the same list the customer app and the server use. The values below are only used for a vehicle that has
 * no price list yet, and as the editable defaults in Settings → Rental pricing.
 */
export const PRICING_RULES = {
  termDiscount: { Daily: 0, Weekly: 0.1, Monthly: 0.25 } as Record<RentalTerm, number>,
  taxRate: 0.18,
  depositByCategory: { Hatchback: 5000, SUV: 5000, MUV: 5000, Sedan: 5000, Electric: 5000, Luxury: 15000 } as Record<Vehicle['type'], number>,
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

/**
 * The weekly rate covers 7 days and the monthly rate 30, prorated beyond that; the saving against the daily
 * rate shows as the term discount. Matches the server's calculation for bookings made in the customer app.
 */
export function computeQuote(vehicle: Pick<Vehicle, 'pricePerDay' | 'type' | 'rates'>, days: number, term: RentalTerm, manualDiscount = 0): Quote {
  const d = Math.max(1, Math.round(days));
  const daily = vehicle.rates?.daily ?? vehicle.pricePerDay;
  const base = daily * d;
  const termAmount = vehicle.rates
    ? term === 'Weekly'
      ? Math.round((vehicle.rates.weekly / 7) * d)
      : term === 'Monthly'
        ? Math.round((vehicle.rates.monthly / 30) * d)
        : base
    : Math.round(base * (1 - PRICING_RULES.termDiscount[term]));
  const termDiscount = Math.max(0, base - termAmount);
  const discount = Math.min(Math.max(0, manualDiscount), base - termDiscount);
  const subtotal = base - termDiscount - discount;
  const tax = Math.round(subtotal * PRICING_RULES.taxRate);
  return {
    days: d,
    ratePerDay: daily,
    base,
    termDiscount,
    manualDiscount: discount,
    subtotal,
    tax,
    total: subtotal + tax,
    deposit: vehicle.rates?.deposit ?? PRICING_RULES.depositByCategory[vehicle.type] ?? 5000,
  };
}

/** Suggests the rental term that matches a trip length. */
export function termForDays(days: number): RentalTerm {
  if (days >= PRICING_RULES.minDays.Monthly) return 'Monthly';
  if (days >= PRICING_RULES.minDays.Weekly) return 'Weekly';
  return 'Daily';
}
