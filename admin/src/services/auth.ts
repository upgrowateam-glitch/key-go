import { api, readToken, storeToken } from '../lib/api';

export type StaffRole = 'Owner' | 'Admin' | 'Manager' | 'Staff';

export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
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
