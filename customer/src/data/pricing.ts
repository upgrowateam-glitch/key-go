// Prices come from the KeyGo server: every vehicle carries its current price list (`rates`), set by staff
// in the admin portal. The server works out the final price of every booking with the same rules.

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

/** GST applied to the rental amount. */
export const TAX_RATE = 0.18;

/** The vehicle's price list; a vehicle without one is priced from its daily rate. */
export function ratesFor(vehicle: { pricePerDay: number; rates?: VehicleRates }): VehicleRates {
  return (
    vehicle.rates ?? {
      daily: vehicle.pricePerDay,
      weekly: Math.round(vehicle.pricePerDay * 7 * 0.9),
      monthly: Math.round(vehicle.pricePerDay * 30 * 0.75),
      deposit: 5000,
      driverPerDay: 800,
    }
  );
}
