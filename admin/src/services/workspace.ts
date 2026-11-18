import { api } from '../lib/api';
import { hydrateServerState } from '../lib/serverState';
import type { Booking, Customer, Vehicle } from '../types';

export interface Workspace {
  vehicles: Vehicle[];
  bookings: Booking[];
  customers: Customer[];
  /** Admin-managed lists by collection name (agreements, inspections, financeEntries, ...). */
  records: Record<string, unknown[]>;
}

/** Fleet photos shipped with the portal (public/images/fleet), chosen by the vehicle's photo key. */
const withPhoto = (v: Vehicle): Vehicle => (v.photoKey && !v.imageAsset ? { ...v, imageAsset: { uri: `/images/fleet/${v.photoKey}.png` } } : v);

/** Everything the portal shows, loaded once after sign-in. Settings documents go to the shared cache. */
export async function loadWorkspace(): Promise<Workspace> {
  const data = await api<Workspace & { settings: Record<string, unknown> }>('/admin/workspace');
  hydrateServerState(data.settings);
  return { vehicles: data.vehicles.map(withPhoto), bookings: data.bookings, customers: data.customers, records: data.records };
}
