import type { Rates, Term } from './pricing';

/**
 * Master data the Owner manages in the admin portal, read by the server and both apps:
 * pricing rules (Settings → Rental pricing) and the car type, category and fuel lists (Settings → Master data).
 */

export const SETTING_PRICING = 'settings.pricing';
export const SETTING_MASTER = 'master.lists';

export interface PricingRules {
  /** Discount for the term compared with paying the daily price, as a fraction (0.1 = 10%). */
  termDiscount: Record<Term, number>;
  /** GST on the rental amount, as a fraction (0.18 = 18%). */
  taxRate: number;
  /** Refundable deposit by car type (₹); types not listed use the first value or ₹5,000. */
  depositByCategory: Record<string, number>;
  /** Shortest rental, in days, for each term. */
  minDays: Record<Term, number>;
}

export const DEFAULT_PRICING: PricingRules = {
  termDiscount: { Daily: 0, Weekly: 0.1, Monthly: 0.25 },
  taxRate: 0.18,
  depositByCategory: { Hatchback: 5000, SUV: 5000, MUV: 5000, Sedan: 5000, Electric: 5000, Luxury: 15000 },
  minDays: { Daily: 1, Weekly: 7, Monthly: 30 },
};

const TERMS: Term[] = ['Daily', 'Weekly', 'Monthly'];
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** The saved rules, checked and completed with the defaults. */
export function pricingRules(saved: unknown): PricingRules {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof PricingRules, Record<string, unknown> | unknown>>;
  const td = (s.termDiscount ?? {}) as Record<string, unknown>;
  const md = (s.minDays ?? {}) as Record<string, unknown>;
  const dep = (s.depositByCategory ?? {}) as Record<string, unknown>;
  return {
    termDiscount: Object.fromEntries(TERMS.map((t) => [t, num(td[t], 0, 0.9, DEFAULT_PRICING.termDiscount[t])])) as Record<Term, number>,
    taxRate: num(s.taxRate, 0, 0.5, DEFAULT_PRICING.taxRate),
    depositByCategory: {
      ...DEFAULT_PRICING.depositByCategory,
      ...Object.fromEntries(Object.entries(dep).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) >= 0).map(([k, v]) => [k, Number(v)])),
    },
    minDays: Object.fromEntries(TERMS.map((t) => [t, Math.round(num(md[t], 1, 365, DEFAULT_PRICING.minDays[t]))])) as Record<Term, number>,
  };
}

/** A car's own prices that replace the automatic ones (set per car in Rental pricing). */
export interface CustomRates {
  weekly?: number;
  monthly?: number;
  deposit?: number;
}

export function customRatesOf(details: Record<string, unknown>): CustomRates {
  const c = (details.customRates ?? {}) as Record<string, unknown>;
  const pick = (k: keyof CustomRates) => (Number(c[k]) > 0 ? Math.round(Number(c[k])) : undefined);
  return { weekly: pick('weekly'), monthly: pick('monthly'), deposit: pick('deposit') };
}

/**
 * The prices a car is offered at: its daily price, then the weekly (7 days) and monthly (30 days) price — the
 * car's own price if set, otherwise the daily price less the term discount — and the deposit for its type.
 */
export function effectiveRates(daily: number, driverPerDay: number, type: string, custom: CustomRates, rules: PricingRules): Rates {
  return {
    daily,
    weekly: custom.weekly ?? Math.round(daily * 7 * (1 - rules.termDiscount.Weekly)),
    monthly: custom.monthly ?? Math.round(daily * 30 * (1 - rules.termDiscount.Monthly)),
    deposit: custom.deposit ?? rules.depositByCategory[type] ?? 5000,
    driverPerDay,
  };
}

// ---------------------------------------------------------------- editable lists

export interface MasterItem {
  name: string;
  /** Switched-off items stay on existing cars but are not offered for new ones. */
  active: boolean;
}

export interface MasterLists {
  vehicleTypes: MasterItem[];
  categories: MasterItem[];
  fuelTypes: MasterItem[];
}

const items = (...names: string[]) => names.map((name) => ({ name, active: true }));

export const DEFAULT_LISTS: MasterLists = {
  vehicleTypes: items('Hatchback', 'Sedan', 'SUV', 'MUV', 'Electric', 'Luxury'),
  categories: items('Economy', 'Standard', 'Premium', 'Luxury'),
  fuelTypes: items('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'),
};

export function masterLists(saved: unknown): MasterLists {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const list = (key: keyof MasterLists) => {
    const raw = Array.isArray(s[key]) ? (s[key] as unknown[]) : null;
    if (!raw) return DEFAULT_LISTS[key];
    const seen = new Set<string>();
    return raw
      .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
      .map((x) => ({ name: String(x.name ?? '').trim().slice(0, 40), active: x.active !== false }))
      .filter((x) => x.name && !seen.has(x.name.toLowerCase()) && seen.add(x.name.toLowerCase()));
  };
  return { vehicleTypes: list('vehicleTypes'), categories: list('categories'), fuelTypes: list('fuelTypes') };
}
