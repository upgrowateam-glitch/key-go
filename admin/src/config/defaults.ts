import type { AutomationRule, LoyaltyRewardTier, NotificationChannelSetting } from '../types';

/**
 * Starting business configuration, used until staff change it in the portal. These are settings, not sample
 * records: once edited they are saved on the server and these defaults are no longer used.
 */

export const DEFAULT_LOYALTY_TIERS: LoyaltyRewardTier[] = [
  { id: 'LT-1', tier: 'Bronze', minTrips: 1, reward: 'Welcome kit & 200 points' },
  { id: 'LT-2', tier: 'Silver', minTrips: 3, reward: 'Free weekend upgrade voucher' },
  { id: 'LT-3', tier: 'Gold', minTrips: 5, reward: 'Complimentary chauffeur for 1 day' },
  { id: 'LT-4', tier: 'VIP', minTrips: 10, reward: '15% off every rental + airport delivery' },
];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationChannelSetting[] = [
  { type: 'booking', label: 'Booking reminders', description: 'Confirmation and pickup reminder to the customer', leadTime: '2 days before pickup', whatsapp: true, sms: true },
  { type: 'return', label: 'Return reminders', description: 'Return time reminder and overdue alerts', leadTime: '3 hours before return', whatsapp: true, sms: false },
  { type: 'insurance', label: 'Insurance renewal', description: 'Alerts to fleet admin before policy expiry', leadTime: '30 days before expiry', whatsapp: true, sms: false },
  { type: 'emission', label: 'Emission (PUC) renewal', description: 'Alerts to fleet admin before PUC expiry', leadTime: '15 days before expiry', whatsapp: false, sms: true },
  { type: 'service', label: 'Service reminders', description: 'Oil, brake pad and periodic service alerts', leadTime: '7 days / 500 km before due', whatsapp: true, sms: false },
  { type: 'emi', label: 'Loan EMI reminders', description: 'EMI due alerts to accounts', leadTime: '5 days before due date', whatsapp: false, sms: true },
];

export const DEFAULT_AUTOMATIONS: AutomationRule[] = [
  { id: 'AUTO-1', name: 'Pickup reminder (T-2 days)', description: 'Send WhatsApp + SMS reminder two days before pickup.', trigger: 'Booking confirmed', enabled: true },
  { id: 'AUTO-2', name: 'Overdue return escalation', description: 'Alert operations and customer when a return is 1 hour late.', trigger: 'Return time passed', enabled: true },
  { id: 'AUTO-3', name: 'Post-trip review request', description: 'Ask for a rating 2 hours after a rental is completed.', trigger: 'Rental completed', enabled: true },
  { id: 'AUTO-4', name: 'Document expiry check', description: 'Nightly scan of insurance, PUC and licence expiries.', trigger: 'Every night 01:00', enabled: true },
  { id: 'AUTO-5', name: 'Auto-bill FASTag tolls', description: 'Add toll entries during a rental to the customer invoice.', trigger: 'Toll entry received', enabled: false },
  { id: 'AUTO-6', name: 'Web lead capture', description: 'Create a quote from website enquiry form submissions.', trigger: 'Website form submitted', enabled: false },
];

/** Unique id for a new record, e.g. "KG-LQ3X9A2" or "FIN-LQ3X9A2". */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, '0')}`;
