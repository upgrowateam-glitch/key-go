import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface CarPosition {
  vehicleId: string;
  deviceId: string;
  name: string;
  status: string;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  at: string | null;
  ignition: boolean | null;
}

export interface GpsFeed {
  /** False until the GPS tracking server (Traccar) is set up and reachable. */
  connected: boolean;
  message?: string;
  cars: CarPosition[];
  /** Devices sending locations that no car is linked to yet. */
  unmatched: { deviceId: string; name: string; status: string; at: string | null }[];
}

export const fetchGpsFeed = () => api<GpsFeed>('/admin/gps/positions');

/** Live positions, refreshed every 20 seconds while the screen is open. */
export function useGpsFeed() {
  const [feed, setFeed] = useState<GpsFeed | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    fetchGpsFeed().then(
      (f) => {
        setFeed(f);
        setError('');
      },
      (e: Error) => setError(e.message)
    );
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);
  return { feed, error, reload: load };
}

/** "just now", "5 min ago", "3 h ago", or the date. */
export function ago(iso: string | null) {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
