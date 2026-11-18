import { createStore } from '../features/notifications/listControls';
import type { Customer } from '../types';

/** Campaign ids paused locally: the Campaign type has no paused status yet. */
export const pausedCampaignsStore = createStore<string[]>([]);

export interface CustomSegment {
  id: string;
  name: string;
  minTrips: number;
  tier: Customer['loyaltyTier'] | 'Any';
  city: string;
}

export const segmentsStore = createStore<CustomSegment[]>([
  { id: 'SEG-1', name: 'Gold and frequent', minTrips: 2, tier: 'Gold', city: '' },
  { id: 'SEG-2', name: 'Bengaluru regulars', minTrips: 1, tier: 'Any', city: 'Bengaluru' },
]);

export interface ReferralCode {
  id: string;
  code: string;
  /** Customer who shares the code. */
  customerId: string;
  friendDiscountPercent: number;
  referrerRewardPoints: number;
  uses: number;
  maxUses: number;
  expiresOn: string;
  active: boolean;
}

export const referralsStore = createStore<ReferralCode[]>([
  { id: 'REF-1', code: 'ANANYA500', customerId: 'cust-1', friendDiscountPercent: 10, referrerRewardPoints: 500, uses: 4, maxUses: 10, expiresOn: '2026-12-31', active: true },
  { id: 'REF-2', code: 'RAHUL10', customerId: 'cust-2', friendDiscountPercent: 10, referrerRewardPoints: 300, uses: 7, maxUses: 10, expiresOn: '2026-11-30', active: true },
  { id: 'REF-3', code: 'SURESHFRIEND', customerId: 'cust-3', friendDiscountPercent: 5, referrerRewardPoints: 250, uses: 3, maxUses: 5, expiresOn: '2026-10-15', active: true },
  { id: 'REF-4', code: 'MEERA5', customerId: 'cust-4', friendDiscountPercent: 5, referrerRewardPoints: 200, uses: 0, maxUses: 5, expiresOn: '2026-08-31', active: false },
]);

/** A rental percentage agreed with one customer for one vehicle. */
export interface CustomerVehicleRate {
  id: string;
  customerId: string;
  vehicleId: string;
  percent: number;
  note: string;
}

export const vehicleRatesStore = createStore<CustomerVehicleRate[]>([
  { id: 'CVR-1', customerId: 'cust-1', vehicleId: 'car-1', percent: 12, note: 'Corporate account rate' },
  { id: 'CVR-2', customerId: 'cust-2', vehicleId: 'car-3', percent: 15, note: 'VIP weekend agreement' },
  { id: 'CVR-3', customerId: 'cust-3', vehicleId: 'car-5', percent: 8, note: 'Repeat family trips' },
]);

export interface PointsAdjustment {
  id: string;
  customerId: string;
  points: number;
  reason: string;
  date: string;
}

export const pointsAdjustmentsStore = createStore<PointsAdjustment[]>([
  { id: 'ADJ-1', customerId: 'cust-1', points: 250, reason: 'Goodwill after delayed pickup', date: '2026-09-14' },
  { id: 'ADJ-2', customerId: 'cust-2', points: -100, reason: 'Redeemed against a toll bill', date: '2026-09-02' },
]);

export interface GiftItem {
  id: string;
  name: string;
  kind: 'Voucher' | 'Upgrade' | 'Merchandise';
  pointsCost: number;
  stock: number;
  active: boolean;
}

export const giftsStore = createStore<GiftItem[]>([
  { id: 'GIFT-1', name: 'Rs 500 fuel voucher', kind: 'Voucher', pointsCost: 500, stock: 40, active: true },
  { id: 'GIFT-2', name: 'Free vehicle upgrade', kind: 'Upgrade', pointsCost: 1500, stock: 12, active: true },
  { id: 'GIFT-3', name: 'KeyGo travel kit', kind: 'Merchandise', pointsCost: 800, stock: 25, active: true },
  { id: 'GIFT-4', name: 'Airport lounge pass', kind: 'Voucher', pointsCost: 2000, stock: 0, active: false },
]);

export interface GiftDispatch {
  id: string;
  customerId: string;
  giftId: string;
  note: string;
  date: string;
}

export const giftDispatchStore = createStore<GiftDispatch[]>([
  { id: 'GD-1', customerId: 'cust-1', giftId: 'GIFT-3', note: 'Five trips milestone', date: '2026-09-10' },
]);

export interface RetentionRule {
  id: string;
  name: string;
  description: string;
  channel: 'WhatsApp' | 'SMS' | 'Email';
  enabled: boolean;
}

export const retentionRulesStore = createStore<RetentionRule[]>([
  { id: 'RET-1', name: 'Win-back after 90 days', description: 'Offer 10% off to customers with no trip in 90 days.', channel: 'SMS', enabled: true },
  { id: 'RET-2', name: 'Tier upgrade congratulations', description: 'Tell customers when they reach a new loyalty tier.', channel: 'WhatsApp', enabled: true },
  { id: 'RET-3', name: 'Birthday gift', description: 'Send a fuel voucher on the customer birthday.', channel: 'WhatsApp', enabled: false },
  { id: 'RET-4', name: 'Referral nudge after a 5-star trip', description: 'Share the referral code after a completed rental.', channel: 'Email', enabled: false },
]);

export interface WebsiteIntegration {
  website: string;
  webhook: string;
  leadToQuote: boolean;
  apiKey: string;
}

export const integrationStore = createStore<WebsiteIntegration>({
  website: 'https://www.keygo.in',
  webhook: 'https://hooks.keygo.in/bookings',
  leadToQuote: false,
  apiKey: 'kg_live_7f3a9c2e41b84d6f90a1c5e8b2d47f19',
});
