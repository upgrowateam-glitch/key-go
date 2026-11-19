/**
 * Talks to the KeyGo server. Calls made while signed in carry the customer's sign-in token.
 *
 * The server address comes from EXPO_PUBLIC_API_URL when the app is bundled, and defaults to the live server.
 * For local development against a local server, set EXPO_PUBLIC_API_URL=http://<your-computer-ip>:4000 in .env.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://keygo-api.upgrowa.cloud').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let currentToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Set by the auth service when the customer signs in or out. */
export const setApiToken = (token: string | null) => {
  currentToken = token;
};

/** Called when the server sends a renewed sign-in token, so the app keeps it. */
let onRenewed: ((token: string) => void) | null = null;
export const setTokenRenewedHandler = (fn: ((token: string) => void) | null) => {
  onRenewed = fn;
};

/** Called when the server rejects the token, so the app can return to sign-in. */
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = init.auth === false ? null : currentToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  } catch {
    throw new ApiError('Cannot reach KeyGo. Check your internet connection and try again.', 0);
  }
  if (res.status === 401 && token) onUnauthorized?.();
  // The server renews a sign-in that is in use; keep the fresh token
  const renewed = res.headers.get('X-KeyGo-Token');
  if (renewed && token && token === currentToken) onRenewed?.(renewed);
  if (!res.ok) {
    let message = `KeyGo answered ${res.status}. Please try again.`;
    try {
      const body = await res.json();
      const m = body?.message;
      message = Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : message;
    } catch {
      // Not JSON; keep the generic message
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
