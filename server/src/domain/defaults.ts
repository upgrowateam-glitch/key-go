/**
 * Starting business settings, used until staff change them in the admin portal. These are configuration,
 * not sample records: the admin portal saves its own version into app_settings once edited.
 */

export const SETTING_LOYALTY_TIERS = 'loyaltyTiers';
export const SETTING_PENALTIES = 'agreements.penalties';

export const DEFAULT_LOYALTY_TIERS = [
  { id: 'LT-1', tier: 'Bronze', minTrips: 1, reward: 'Welcome kit & 200 points' },
  { id: 'LT-2', tier: 'Silver', minTrips: 3, reward: 'Free weekend upgrade voucher' },
  { id: 'LT-3', tier: 'Gold', minTrips: 5, reward: 'Complimentary chauffeur for 1 day' },
  { id: 'LT-4', tier: 'VIP', minTrips: 10, reward: '15% off every rental + airport delivery' },
];

/** Charges listed on every rental agreement. */
export const DEFAULT_PENALTIES = [
  { id: 'f1', label: 'Late return (per hour)', amount: 500, basis: 'Per hour', active: true },
  { id: 'f2', label: 'Smoking / deep cleaning', amount: 2000, basis: 'Flat', active: true },
  { id: 'f3', label: 'Lost key or key fob', amount: 5000, basis: 'Flat', active: true },
  { id: 'f4', label: 'Traffic challan admin fee (plus actual fine)', amount: 250, basis: 'Actual + fee', active: true },
];
