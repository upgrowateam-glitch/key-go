import { api, readToken, storeToken } from '../lib/api';

/** Owner is the Super Admin. Drivers only see their own driver page. */
export type StaffRole = 'Owner' | 'Admin' | 'Manager' | 'Staff' | 'Driver';

/** Areas of the portal; the server decides what each role may view or change (server/src/auth/permissions.ts). */
export type Area =
  | 'dashboard'
  | 'fleet'
  | 'bookings'
  | 'customers'
  | 'agreements'
  | 'inspections'
  | 'maintenance'
  | 'tracking'
  | 'fastag'
  | 'people'
  | 'finance'
  | 'reports'
  | 'notifications'
  | 'marketing'
  | 'settings'
  | 'users';
export type Access = 'none' | 'view' | 'edit';

export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  /** Driver accounts: the driver record they belong to. */
  driverId?: string | null;
  /** What this person may view or change, as sent by the server. */
  permissions?: Partial<Record<Area, Access>>;
}

/** True when the session may view (or, with need = 'edit', change) an area. */
export function canAccess(session: StaffSession | null | undefined, area: Area, need: Exclude<Access, 'none'> = 'view') {
  const have = session?.permissions?.[area] ?? 'none';
  return need === 'view' ? have !== 'none' : have === 'edit';
}

const SESSION_KEY = 'keygo.admin.session.v2';

/** The signed-in staff member, if this browser has a session. */
export function readSession(): StaffSession | null {
  if (!readToken()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

function storeSession(session: StaffSession | null) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be blocked; the session then simply ends with the tab
  }
}

export function signOut() {
  storeToken(null);
  storeSession(null);
}

/** Signs in against the KeyGo server; staff accounts are managed in Settings → Users & roles. */
export async function signIn(email: string, password: string): Promise<StaffSession> {
  const { token, user } = await api<{ token: string; user: StaffSession }>('/auth/staff/login', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), password },
    auth: false,
  });
  storeToken(token);
  storeSession(user);
  return user;
}

/** Re-reads the signed-in account from the server (role or name may have changed). */
export async function refreshSession(): Promise<StaffSession> {
  const user = await api<StaffSession>('/auth/staff/me');
  storeSession(user);
  return user;
}

/** Who an invitation link is for. */
export const fetchInvite = (token: string) => api<{ name: string; email: string; role: StaffRole }>(`/auth/invite/${encodeURIComponent(token)}`, { auth: false });

/** Sets the password from an invitation and signs the person in. */
export async function acceptInvite(token: string, password: string): Promise<StaffSession> {
  const { token: session, user } = await api<{ token: string; user: StaffSession }>(`/auth/invite/${encodeURIComponent(token)}`, { method: 'POST', body: { password }, auth: false });
  storeToken(session);
  storeSession(user);
  return user;
}

/** Changes the signed-in person's password; other devices are signed out, this one keeps working. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { token } = await api<{ token: string }>('/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
  storeToken(token);
}

/** Signs this person out of KeyGo on every device, including this browser. */
export async function signOutEverywhere() {
  await api('/auth/sign-out-everywhere', { method: 'POST' });
  signOut();
}
