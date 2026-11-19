import '../theme/installStorage';
import { useSyncExternalStore } from 'react';
import { api, setApiToken, setTokenRenewedHandler, setUnauthorizedHandler } from '../lib/api';
import type { Customer } from '../types';

const KEY = 'keygo.customer.auth.v2';

interface AuthState {
  onboarded: boolean;
  /** Sign-in token from the KeyGo server. */
  token: string | null;
  customerId: string | null;
}

const EMPTY: AuthState = { onboarded: false, token: null, customerId: null };

function read(): AuthState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<AuthState>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state = read();
setApiToken(state.token);
const listeners = new Set<() => void>();

function update(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  setApiToken(state.token);
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
export const signOut = () => update({ token: null, customerId: null });

// A rejected token (expired, signed out everywhere, or the account was removed) signs the customer out
setUnauthorizedHandler(signOut);
// A sign-in in use is renewed by the server; keep the new token
setTokenRenewedHandler((token) => update({ token }));

/** Changes the password; other devices are signed out, this one stays signed in. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { token } = await api<{ token: string }>('/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
  update({ token });
}

/** Signs the customer out of KeyGo on every device, including this one. */
export async function signOutEverywhere() {
  await api('/auth/sign-out-everywhere', { method: 'POST' });
  signOut();
}

interface SessionResponse {
  token: string;
  customer: Customer;
}

export async function signIn(email: string, password: string) {
  const res = await api<SessionResponse>('/auth/customer/login', { method: 'POST', body: { email: email.trim().toLowerCase(), password }, auth: false });
  update({ token: res.token, customerId: res.customer.id, onboarded: true });
  return res.customer;
}

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dob: string;
  password: string;
}

export async function register(input: RegistrationInput) {
  const res = await api<SessionResponse>('/auth/customer/register', {
    method: 'POST',
    body: { ...input, email: input.email.trim().toLowerCase(), phone: input.phone.trim() },
    auth: false,
  });
  update({ token: res.token, customerId: res.customer.id, onboarded: true });
  return res.customer;
}
