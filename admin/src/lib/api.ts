/**
 * Talks to the KeyGo server. Every admin call carries the staff sign-in token; a 401 signs the user out.
 *
 * The server address comes from NEXT_PUBLIC_API_URL at build time, and defaults to the live server.
 * For local development against a local server, set NEXT_PUBLIC_API_URL=http://localhost:4000 in .env.local.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://keygo-api.upgrowa.cloud').replace(/\/$/, '');

const TOKEN_KEY = 'keygo.admin.token.v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked; the session then lasts until the tab closes
  }
}

/** Called when the server rejects the token, so the portal can return to the login page. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `The KeyGo server answered ${res.status}.`;
  try {
    const body = await res.json();
    const m = body?.message;
    message = Array.isArray(m) ? m.join(' ') : typeof m === 'string' ? m : message;
  } catch {
    // Not JSON; keep the generic message
  }
  return new ApiError(message, res.status);
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = init.auth === false ? null : readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  } catch {
    throw new ApiError('Cannot reach the KeyGo server. Check your internet connection and try again.', 0);
  }
  if (res.status === 401 && token) onUnauthorized?.();
  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

/** Uploads one file to the server's document storage. */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/files`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  } catch {
    throw new ApiError('Cannot reach the KeyGo server. Check your internet connection and try again.', 0);
  }
  if (res.status === 401) onUnauthorized?.();
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as UploadedFile;
}

/** Deletes a stored file from the server. */
export const deleteFile = (id: string) => api(`/admin/files/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Opens a stored file in a new tab. Returns false when the file no longer exists. */
export async function openFile(id: string): Promise<boolean> {
  const token = readToken();
  const res = await fetch(`${API_URL}/admin/files/${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 404) return false;
  if (!res.ok) throw await errorFrom(res);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
