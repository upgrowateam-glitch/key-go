import { mockRequest } from './mockClient';

export type StaffRole = 'Owner' | 'Admin' | 'Manager' | 'Staff';

export interface StaffSession {
  name: string;
  email: string;
  role: StaffRole;
}

/** Demo accounts for the UI phase. Authentication moves to the NestJS backend later. */
export const DEMO_ACCOUNTS: StaffSession[] = [
  { name: 'Rahul Menon', email: 'owner@keygo.in', role: 'Owner' },
  { name: 'Priya Nair', email: 'admin@keygo.in', role: 'Admin' },
  { name: 'Arjun Das', email: 'manager@keygo.in', role: 'Manager' },
  { name: 'Sneha Rao', email: 'staff@keygo.in', role: 'Staff' },
];
export const DEMO_PASSWORD = 'keygo123';

const STORAGE_KEY = 'keygo.admin.session.v1';

export function readSession(): StaffSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

export function signOut() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the session then simply ends with the tab
  }
}

export const signIn = (email: string, password: string) =>
  mockRequest(() => {
    const account = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
    if (!account || password !== DEMO_PASSWORD) throw new Error('Incorrect email or password.');
    return account;
  }).then((account) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } catch {
      // Storage can be blocked; the session then simply ends with the tab
    }
    return account;
  });
