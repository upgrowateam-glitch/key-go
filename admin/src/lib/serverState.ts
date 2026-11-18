import { api } from './api';

/**
 * Portal settings and lists that are stored on the server as one document each (app_settings).
 * All documents arrive with the workspace when the portal loads, so services can read them synchronously.
 * A save updates the local copy at once and then writes it to the server.
 */
const cache = new Map<string, unknown>();
const listeners = new Set<(message: string) => void>();

export function hydrateServerState(settings: Record<string, unknown>) {
  cache.clear();
  Object.entries(settings).forEach(([k, v]) => cache.set(k, v));
}

/** Notified when a background save fails, so the portal can show it. */
export function onServerStateError(fn: (message: string) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export interface ServerDoc<T> {
  get: () => T;
  /** Saves the whole document; resolves once the server has it. */
  set: (value: T) => Promise<T>;
}

export function serverDoc<T>(key: string, defaultValue: T): ServerDoc<T> {
  return {
    get: () => (cache.has(key) && cache.get(key) !== null ? (cache.get(key) as T) : defaultValue),
    set: async (value: T) => {
      cache.set(key, value);
      try {
        await api(`/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: { value } });
      } catch (e) {
        listeners.forEach((l) => l(`Could not save: ${(e as Error).message}`));
        throw e;
      }
      return value;
    },
  };
}
