import { useSyncExternalStore } from 'react';
import { Customer } from '../types';
import { mockRequest } from './mockClient';

export const DEMO_EMAIL = 'ananya.s@example.com';
export const DEMO_PASSWORD = 'keygo123';

const KEY = 'keygo.customer.auth.v1';

interface AuthState {
  onboarded: boolean;
  customerId: string | null;
  /** Accounts created in the app; real accounts move to the NestJS backend later. */
  registered: { customer: Customer; password: string }[];
}

const EMPTY: AuthState = { onboarded: false, customerId: null, registered: [] };

function read(): AuthState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<AuthState>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state = read();
const listeners = new Set<() => void>();

function update(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable — the session then lasts until the app closes
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Statically rendered web pages hydrate signed out, then switch to the stored session. */
export const useAuth = () => useSyncExternalStore(subscribe, () => state, () => EMPTY);

export const completeOnboarding = () => update({ onboarded: true });
export const signOut = () => update({ customerId: null });

export const signIn = (email: string, password: string, known: Customer[]) =>
  mockRequest(() => {
    const normalized = email.trim().toLowerCase();
    const account = state.registered.find((r) => r.customer.email.toLowerCase() === normalized);
    if (account && account.password === password) return account.customer.id;
    if (!account && normalized === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const demo = known.find((c) => c.email.toLowerCase() === DEMO_EMAIL);
      if (demo) return demo.id;
    }
    throw new Error('Incorrect email or password.');
  }).then((customerId) => update({ customerId }));

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dob: string;
  password: string;
}

export const register = (input: RegistrationInput, known: Customer[], today: string) =>
  mockRequest(() => {
    const email = input.email.trim().toLowerCase();
    if (known.some((c) => c.email.toLowerCase() === email) || state.registered.some((r) => r.customer.email.toLowerCase() === email)) {
      throw new Error('An account with this email already exists.');
    }
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const customer: Customer = {
      id: `cust-${Date.now()}`,
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      dob: input.dob,
      phone: input.phone.trim(),
      email,
      address: '',
      city: '',
      aadhaarNo: '',
      idCardStatus: 'Not uploaded',
      faceVerification: 'Not uploaded',
      photoCaptured: false,
      dlNumber: '',
      dlState: '',
      dlExpiry: '',
      careOfName: '',
      careOfRelation: '',
      careOfPhone: '',
      customerCode: `KG${firstName.slice(0, 3).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`,
      documents: [],
      customerSince: today,
      loyaltyTier: 'Bronze',
      loyaltyPoints: 0,
      avatarBg: '#DCE8DE',
      trustRating: 0,
    };
    return customer;
  }).then((customer) => {
    update({ registered: [...state.registered, { customer, password: input.password }], customerId: customer.id });
    return customer;
  });

export const registeredCustomers = () => state.registered.map((r) => r.customer);
