import { DEMO_ACCOUNTS, type StaffRole } from './auth';
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

export const companyStore = createStore<CompanyProfile>({
  name: 'KeyGo',
  legalName: 'KeyGo Mobility Private Limited',
  gstin: '29AAKCK1234F1Z5',
  pan: 'AAKCK1234F',
  phone: '+91 80 4000 1234',
  email: 'hello@keygo.in',
  website: 'https://www.keygo.in',
  address: '12, Residency Road, Bengaluru, Karnataka 560025',
  supportHours: '7:00 AM to 10:00 PM, all days',
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

export const branchesStore = createStore<Branch[]>([
  { id: 'BR-1', name: 'Residency Road (HQ)', city: 'Bengaluru', address: '12, Residency Road, Bengaluru 560025', phone: '+91 80 4000 1234', manager: 'Arjun Das', active: true },
  { id: 'BR-2', name: 'Kempegowda Airport', city: 'Bengaluru', address: 'Terminal 2 Arrivals, KIAL, Bengaluru 560300', phone: '+91 80 4000 1250', manager: 'Sneha Rao', active: true },
  { id: 'BR-3', name: 'Andheri East', city: 'Mumbai', address: 'Marol Naka, Andheri East, Mumbai 400059', phone: '+91 22 4100 2200', manager: 'Vikram Shetty', active: true },
  { id: 'BR-4', name: 'Aerocity', city: 'New Delhi', address: 'Aerocity Hospitality District, New Delhi 110037', phone: '+91 11 4200 3300', manager: 'Neha Kapoor', active: false },
]);

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  branch: string;
  active: boolean;
  lastActive: string;
}

export const usersStore = createStore<PortalUser[]>([
  ...DEMO_ACCOUNTS.map((a, i) => ({ id: `USR-${i + 1}`, name: a.name, email: a.email, role: a.role, branch: 'Residency Road (HQ)', active: true, lastActive: 'Today' })),
  { id: 'USR-5', name: 'Vikram Shetty', email: 'vikram@keygo.in', role: 'Manager', branch: 'Andheri East', active: true, lastActive: 'Yesterday' },
  { id: 'USR-6', name: 'Neha Kapoor', email: 'neha@keygo.in', role: 'Manager', branch: 'Aerocity', active: false, lastActive: '12 Aug' },
  { id: 'USR-7', name: 'Farhan Ali', email: 'farhan@keygo.in', role: 'Staff', branch: 'Kempegowda Airport', active: true, lastActive: 'Today' },
  { id: 'USR-8', name: 'Divya Menon', email: 'divya@keygo.in', role: 'Staff', branch: 'Kempegowda Airport', active: true, lastActive: 'Today' },
  { id: 'USR-9', name: 'Kiran Joshi', email: 'kiran@keygo.in', role: 'Staff', branch: 'Andheri East', active: true, lastActive: '2 days ago' },
]);

export interface PricingSettings {
  termDiscount: Record<RentalTerm, number>;
  taxRate: number;
  depositByCategory: Record<VehicleType, number>;
  minDays: Record<RentalTerm, number>;
}

export const pricingStore = createStore<PricingSettings>({
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

export const policiesStore = createStore<BookingPolicies>({
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

export const paymentStore = createStore<PaymentSettings>({
  cash: true,
  upi: true,
  card: true,
  bankTransfer: true,
  gateway: 'Razorpay',
  merchantId: '',
  gatewayConfigured: false,
  upiId: 'keygo@okhdfcbank',
  accountName: 'KeyGo Mobility Private Limited',
  accountNumber: '50200012345678',
  ifsc: 'HDFC0001234',
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

export const notificationPrefsStore = createStore<NotificationPreferences>({
  quietHours: true,
  quietStart: '22:00',
  quietEnd: '07:00',
  opsEmail: 'ops@keygo.in',
  escalationPhone: '+91 98450 11223',
  accountsEmail: 'accounts@keygo.in',
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

export const termsStore = createStore<TermsDocument>({
  version: 3,
  publishedOn: '2026-08-01',
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
