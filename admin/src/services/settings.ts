import { api } from '../lib/api';
import type { StaffRole } from './auth';
import { createStore } from '../features/notifications/listControls';
import { PRICING_RULES } from '../lib/pricing';
import type { RentalTerm, VehicleType } from '../types';

export interface CompanyProfile {
  name: string;
  legalName: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  supportHours: string;
}

export const companyStore = createStore<CompanyProfile>('settings.company', {
  name: 'KeyGo',
  legalName: '',
  gstin: '',
  pan: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  supportHours: '',
});

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  manager: string;
  active: boolean;
}

export const branchesStore = createStore<Branch[]>('settings.branches', []);

export interface PortalUser {
  id: string;
  name: string;
  /** Empty when the person was added with only a WhatsApp number. */
  email: string;
  /** WhatsApp number, e.g. +919876543210 (empty if none). */
  phone: string;
  role: StaffRole;
  branch: string;
  /** Driver accounts: the driver record they belong to. */
  driverId?: string | null;
  active: boolean;
  lastActive: string;
  /** Waiting for the person to open their invitation link and set a password. */
  invitePending?: boolean;
  inviteExpiresAt?: string | null;
  /** Returned only when an invitation is created: the secret part of the link. */
  inviteToken?: string;
  /** Set when the invitation was sent on WhatsApp just now. */
  whatsappSent?: boolean;
  whatsappTo?: string;
  whatsappError?: string;
}

/** Staff accounts live in the users table on the server, so they can sign in. Owners and Admins manage them. */
export const fetchUsers = () => api<PortalUser[]>('/admin/users');
/** Without a password the server creates an invitation link instead (returned once as inviteToken). */
export const createUser = (input: { name: string; email?: string; phone?: string; role: StaffRole; branch: string; password?: string; driverId?: string; sendWhatsApp?: boolean }) =>
  api<PortalUser>('/admin/users', { method: 'POST', body: { ...input, inviteBaseUrl: window.location.origin } });
export const updateUser = (id: string, patch: Partial<Pick<PortalUser, 'name' | 'role' | 'branch' | 'active' | 'phone'>> & { password?: string; driverId?: string }) =>
  api<PortalUser>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });

/** A new one-time invitation link for this person; any earlier link stops working. */
export const sendInvite = (id: string, sendWhatsApp = false) =>
  api<PortalUser>(`/admin/users/${encodeURIComponent(id)}/invite`, { method: 'POST', body: { sendWhatsApp, inviteBaseUrl: window.location.origin } });

/** The link a person opens to accept their invitation. */
export const inviteLink = (token: string) => `${typeof window === 'undefined' ? '' : window.location.origin}/invite?token=${encodeURIComponent(token)}`;

export interface PricingSettings {
  termDiscount: Record<RentalTerm, number>;
  taxRate: number;
  depositByCategory: Record<VehicleType, number>;
  minDays: Record<RentalTerm, number>;
}

export const pricingStore = createStore<PricingSettings>('settings.pricing', {
  termDiscount: { ...PRICING_RULES.termDiscount },
  taxRate: PRICING_RULES.taxRate,
  depositByCategory: { ...PRICING_RULES.depositByCategory },
  minDays: { ...PRICING_RULES.minDays },
});

export interface BookingPolicies {
  minDriverAge: string;
  minAdvanceHours: string;
  freeCancelHours: string;
  cancellationFeePercent: string;
  lateGraceMinutes: string;
  lateFeePerHour: string;
  kmLimitPerDay: string;
  extraKmCharge: string;
  fuelPolicy: 'Same to same' | 'Full to full' | 'Prepaid';
  requireLicence: boolean;
  requireAadhaar: boolean;
  requireFaceCheck: boolean;
  allowOutstation: boolean;
}

export const policiesStore = createStore<BookingPolicies>('settings.policies', {
  minDriverAge: '21',
  minAdvanceHours: '4',
  freeCancelHours: '24',
  cancellationFeePercent: '20',
  lateGraceMinutes: '30',
  lateFeePerHour: '250',
  kmLimitPerDay: '250',
  extraKmCharge: '12',
  fuelPolicy: 'Same to same',
  requireLicence: true,
  requireAadhaar: true,
  requireFaceCheck: false,
  allowOutstation: true,
});

export interface PaymentSettings {
  cash: boolean;
  upi: boolean;
  card: boolean;
  bankTransfer: boolean;
  gateway: 'Razorpay' | 'PayU' | 'Cashfree';
  merchantId: string;
  gatewayConfigured: boolean;
  upiId: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  invoicePrefix: string;
  refundDays: string;
}

export const paymentStore = createStore<PaymentSettings>('settings.payments', {
  cash: true,
  upi: true,
  card: true,
  bankTransfer: true,
  gateway: 'Razorpay',
  merchantId: '',
  gatewayConfigured: false,
  upiId: '',
  accountName: '',
  accountNumber: '',
  ifsc: '',
  invoicePrefix: 'KG-INV-',
  refundDays: '3',
});

export interface NotificationPreferences {
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  opsEmail: string;
  escalationPhone: string;
  accountsEmail: string;
  customerOptOut: boolean;
  dailyDigest: boolean;
}

export const notificationPrefsStore = createStore<NotificationPreferences>('settings.notificationPreferences', {
  quietHours: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  opsEmail: '',
  escalationPhone: '',
  accountsEmail: '',
  customerOptOut: true,
  dailyDigest: true,
});

export interface TermsClause {
  id: string;
  title: string;
  body: string;
}

export interface TermsDocument {
  version: number;
  publishedOn: string;
  /** True when clauses changed after the last publish. */
  dirty: boolean;
  clauses: TermsClause[];
}

/** Starting terms; staff edit and publish them, and the published version is saved. */
export const termsStore = createStore<TermsDocument>('settings.terms', {
  version: 1,
  publishedOn: '',
  dirty: false,
  clauses: [
    { id: 'TC-1', title: 'Driver eligibility', body: 'The driver must hold a valid driving licence and meet the minimum age in the booking policy.' },
    { id: 'TC-2', title: 'Security deposit', body: 'A refundable deposit is collected before pickup and settled after the return inspection.' },
    { id: 'TC-3', title: 'Fuel and mileage', body: 'The vehicle is returned as per the fuel policy. Distance above the daily limit is charged per km.' },
    { id: 'TC-4', title: 'Late return', body: 'Returns after the grace period attract a late fee per hour, as stated in the agreement.' },
    { id: 'TC-5', title: 'Damage and fines', body: 'The customer is liable for damage found at return inspection and for traffic fines during the rental.' },
    { id: 'TC-6', title: 'Cancellation', body: 'Cancellations within the free cancellation window are refunded in full. Later cancellations attract a fee.' },
  ],
});
