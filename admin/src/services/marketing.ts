import { createStore } from '../features/notifications/listControls';
import type { Customer } from '../types';

/** Campaign ids paused by staff: the Campaign type has no paused status yet. */
export const pausedCampaignsStore = createStore<string[]>('marketing.pausedCampaigns', []);

export interface CustomSegment {
  id: string;
  name: string;
  minTrips: number;
  tier: Customer['loyaltyTier'] | 'Any';
  city: string;
}

export const segmentsStore = createStore<CustomSegment[]>('marketing.segments', []);

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

export const referralsStore = createStore<ReferralCode[]>('marketing.referrals', []);

/** A rental percentage agreed with one customer for one vehicle. */
export interface CustomerVehicleRate {
  id: string;
  customerId: string;
  vehicleId: string;
  percent: number;
  note: string;
}

export const vehicleRatesStore = createStore<CustomerVehicleRate[]>('marketing.customerVehicleRates', []);

export interface PointsAdjustment {
  id: string;
  customerId: string;
  points: number;
  reason: string;
  date: string;
}

export const pointsAdjustmentsStore = createStore<PointsAdjustment[]>('marketing.pointsAdjustments', []);

export interface GiftItem {
  id: string;
  name: string;
  kind: 'Voucher' | 'Upgrade' | 'Merchandise';
  pointsCost: number;
  stock: number;
  active: boolean;
}

export const giftsStore = createStore<GiftItem[]>('marketing.gifts', []);

export interface GiftDispatch {
  id: string;
  customerId: string;
  giftId: string;
  note: string;
  date: string;
}

export const giftDispatchStore = createStore<GiftDispatch[]>('marketing.giftDispatches', []);

export interface RetentionRule {
  id: string;
  name: string;
  description: string;
  channel: 'WhatsApp' | 'SMS' | 'Email';
  enabled: boolean;
}

/** Starting retention rules; staff switch them on and off and the choice is saved. */
export const retentionRulesStore = createStore<RetentionRule[]>('marketing.retentionRules', [
  { id: 'RET-1', name: 'Win-back after 90 days', description: 'Offer 10% off to customers with no trip in 90 days.', channel: 'SMS', enabled: false },
  { id: 'RET-2', name: 'Tier upgrade congratulations', description: 'Tell customers when they reach a new loyalty tier.', channel: 'WhatsApp', enabled: false },
  { id: 'RET-3', name: 'Birthday gift', description: 'Send a fuel voucher on the customer birthday.', channel: 'WhatsApp', enabled: false },
  { id: 'RET-4', name: 'Referral nudge after a 5-star trip', description: 'Share the referral code after a completed rental.', channel: 'Email', enabled: false },
]);

export interface WebsiteIntegration {
  website: string;
  webhook: string;
  leadToQuote: boolean;
  apiKey: string;
}

export const integrationStore = createStore<WebsiteIntegration>('marketing.websiteIntegration', {
  website: '',
  webhook: '',
  leadToQuote: false,
  apiKey: '',
});
