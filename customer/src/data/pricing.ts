// TEMPORARY MOCK PRICING — sample rates for frontend development only.
// These are not business-approved. Replace the values here when real rates are confirmed;
// every screen (Home, Explore, vehicle details, booking, quotes) reads prices from this file.

export interface VehicleRates {
  /** Rental for one day (₹). */
  daily: number;
  /** Rental for 7 days (₹). */
  weekly: number;
  /** Rental for 30 days (₹). */
  monthly: number;
  /** Refundable security deposit (₹). */
  deposit: number;
  /** Chauffeur charge per day for "With Driver" rentals (₹). */
  driverPerDay: number;
}

export const VEHICLE_RATES: Record<string, VehicleRates> = {
  'car-1': { daily: 3999, weekly: 25199, monthly: 89999, deposit: 10000, driverPerDay: 1000 }, // Toyota Innova Crysta
  'car-2': { daily: 2799, weekly: 17599, monthly: 62999, deposit: 7000, driverPerDay: 900 }, // Volkswagen Virtus
  'car-3': { daily: 3499, weekly: 21999, monthly: 79999, deposit: 10000, driverPerDay: 1000 }, // Mahindra Thar
  'car-4': { daily: 1799, weekly: 11299, monthly: 39999, deposit: 5000, driverPerDay: 800 }, // Maruti Suzuki Swift
  'car-5': { daily: 1999, weekly: 12599, monthly: 44999, deposit: 5000, driverPerDay: 800 }, // Maruti Suzuki Baleno
  'car-7': { daily: 1499, weekly: 9449, monthly: 32999, deposit: 5000, driverPerDay: 800 }, // Maruti Suzuki WagonR
  'car-8': { daily: 2999, weekly: 18899, monthly: 66999, deposit: 8000, driverPerDay: 900 }, // Hyundai Creta
};

/** GST applied to the rental amount. */
export const TAX_RATE = 0.18;

/** Rates for a vehicle; unknown vehicles fall back to their listed daily price. */
export function ratesFor(vehicle: { id: string; pricePerDay: number }): VehicleRates {
  return (
    VEHICLE_RATES[vehicle.id] ?? {
      daily: vehicle.pricePerDay,
      weekly: Math.round(vehicle.pricePerDay * 7 * 0.9),
      monthly: Math.round(vehicle.pricePerDay * 30 * 0.75),
      deposit: 5000,
      driverPerDay: 800,
    }
  );
}
