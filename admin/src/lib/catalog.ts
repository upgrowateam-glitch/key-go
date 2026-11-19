import { serverDoc } from './serverState';
import type { RentalTerm, Vehicle, VehicleRates } from '../types';

/**
 * Master data the Owner manages: pricing rules (Settings → Rental pricing) and the editable car type, category
 * and fuel lists (Settings → Master data). The server and the customer app use the same values.
 */

export interface PricingRules {
  /** Discount for the term compared with the daily price, as a fraction (0.1 = 10%). */
  termDiscount: Record<RentalTerm, number>;
  /** GST as a fraction (0.18 = 18%). */
  taxRate: number;
  /** Refundable deposit by car type (₹). */
  depositByCategory: Record<string, number>;
  /** Shortest rental, in days, for each term. */
  minDays: Record<RentalTerm, number>;
}

export const DEFAULT_PRICING: PricingRules = {
  termDiscount: { Daily: 0, Weekly: 0.1, Monthly: 0.25 },
  taxRate: 0.18,
  depositByCategory: { Hatchback: 5000, SUV: 5000, MUV: 5000, Sedan: 5000, Electric: 5000, Luxury: 15000 },
  minDays: { Daily: 1, Weekly: 7, Monthly: 30 },
};

const pricingDoc = serverDoc<Partial<PricingRules>>('settings.pricing', DEFAULT_PRICING);

/** The pricing rules in force (saved values completed with the defaults). */
export function pricingRules(): PricingRules {
  const s = pricingDoc.get() ?? {};
  return {
    termDiscount: { ...DEFAULT_PRICING.termDiscount, ...(s.termDiscount ?? {}) },
    taxRate: typeof s.taxRate === 'number' ? s.taxRate : DEFAULT_PRICING.taxRate,
    depositByCategory: { ...DEFAULT_PRICING.depositByCategory, ...(s.depositByCategory ?? {}) },
    minDays: { ...DEFAULT_PRICING.minDays, ...(s.minDays ?? {}) },
  };
}

/**
 * The prices a car is offered at: the daily price, then weekly (7 days) and monthly (30 days) — the car's own price
 * if it has one, otherwise the daily price less the term discount — and the deposit for its type.
 * The server works prices out the same way.
 */
export function effectiveRates(v: Pick<Vehicle, 'pricePerDay' | 'type' | 'rates' | 'customRates'>, rules = pricingRules()): VehicleRates {
  const daily = v.rates?.daily ?? v.pricePerDay;
  const c = v.customRates ?? {};
  return {
    daily,
    weekly: c.weekly ?? Math.round(daily * 7 * (1 - rules.termDiscount.Weekly)),
    monthly: c.monthly ?? Math.round(daily * 30 * (1 - rules.termDiscount.Monthly)),
    deposit: c.deposit ?? rules.depositByCategory[v.type] ?? 5000,
    driverPerDay: v.rates?.driverPerDay ?? 800,
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

export const MASTER_KEY = 'master.lists';
const listsDoc = serverDoc<Partial<MasterLists>>(MASTER_KEY, DEFAULT_LISTS);

export function masterLists(): MasterLists {
  const s = listsDoc.get() ?? {};
  return {
    vehicleTypes: s.vehicleTypes?.length ? s.vehicleTypes : DEFAULT_LISTS.vehicleTypes,
    categories: s.categories?.length ? s.categories : DEFAULT_LISTS.categories,
    fuelTypes: s.fuelTypes?.length ? s.fuelTypes : DEFAULT_LISTS.fuelTypes,
  };
}

/** Names that can be chosen now; `keep` stays in the list even when switched off (a car already uses it). */
export function activeNames(list: MasterItem[], keep?: string) {
  const names = list.filter((i) => i.active).map((i) => i.name);
  return keep && !names.includes(keep) ? [...names, keep] : names;
}

export const allNames = (list: MasterItem[]) => list.map((i) => i.name);
