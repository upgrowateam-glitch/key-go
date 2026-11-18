import { DEMO_TODAY } from '../data/mockData';
import { readSession } from './auth';
import { mockRequest } from './mockClient';

/** One audit-trail row: who changed what, when, and from which value to which. */
export interface CustomerActivity {
  id: string;
  customerId: string;
  at: string;
  who: string;
  action: string;
  field?: string;
  previous?: string;
  next?: string;
}

export type ActivityInput = Pick<CustomerActivity, 'action' | 'field' | 'previous' | 'next'>;

const seed = (customerId: string, n: number, at: string, who: string, action: string, field?: string, previous?: string, next?: string): CustomerActivity => ({
  id: `${customerId}-a${n}`,
  customerId,
  at,
  who,
  action,
  field,
  previous,
  next,
});

/** Session-only store standing in for the API: entries survive navigation and reset on reload. */
let store: CustomerActivity[] = [
  seed('cust-1', 4, '2026-09-18 16:22', 'Priya Nair', 'Profile edited', 'Loyalty tier', 'Silver', 'Gold'),
  seed('cust-1', 3, '2026-08-02 11:05', 'Sneha Rao', 'Profile edited', 'Address', '18, Residency Road', '42, Lavelle Road'),
  seed('cust-1', 2, '2025-02-12 10:40', 'Sneha Rao', 'KYC reviewed', 'Face match', 'Pending', 'Verified'),
  seed('cust-1', 1, '2025-02-11 09:30', 'Sneha Rao', 'Profile created'),
  seed('cust-2', 2, '2026-07-21 14:10', 'Arjun Das', 'Profile edited', 'Loyalty tier', 'Gold', 'VIP'),
  seed('cust-2', 1, '2024-11-05 12:15', 'Sneha Rao', 'Profile created'),
  seed('cust-3', 2, '2026-09-10 17:45', 'Priya Nair', 'KYC reviewed', 'ID card', 'Pending', 'Verified'),
  seed('cust-3', 1, '2026-01-19 10:00', 'Sneha Rao', 'Profile created'),
  seed('cust-4', 2, '2026-09-25 13:20', 'Sneha Rao', 'ID card uploaded', 'ID card', 'Not uploaded', 'Pending'),
  seed('cust-4', 1, '2026-09-25 13:05', 'Sneha Rao', 'Profile created'),
  seed('cust-5', 2, '2026-03-16 11:50', 'Arjun Das', 'Profile edited', 'Loyalty tier', 'Bronze', 'Silver'),
  seed('cust-5', 1, '2025-07-30 11:20', 'Sneha Rao', 'Profile created'),
];

export const readCustomerActivity = (customerId: string) => store.filter((a) => a.customerId === customerId);
export const loadCustomerActivity = (customerId: string) => mockRequest(() => readCustomerActivity(customerId));

export function logCustomerActivity(customerId: string, entries: ActivityInput[]) {
  const who = readSession()?.name ?? 'Staff';
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const added = entries.map((e, i) => ({ ...e, id: `${customerId}-${Date.now()}-${i}`, customerId, who, at: `${DEMO_TODAY} ${time}` }));
  store = [...added, ...store];
}
