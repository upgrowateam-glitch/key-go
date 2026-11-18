import { FLEET_PHOTOS } from '../data/fleetPhotos';
import { api } from '../lib/api';
import type { Agreement, AgreementFine, Booking, Customer, FASTagLog, InspectionRecord, LoyaltyRewardTier, NotificationItem, Vehicle } from '../types';

export interface Workspace {
  customer: Customer;
  vehicles: Vehicle[];
  bookings: Booking[];
  agreements: Agreement[];
  inspections: InspectionRecord[];
  fastagLogs: FASTagLog[];
  notifications: NotificationItem[];
  loyaltyTiers: LoyaltyRewardTier[];
  /** Charges listed on every agreement, as set by KeyGo. */
  standardFines: AgreementFine[];
}

export const withPhoto = (v: Vehicle): Vehicle => (v.photoKey && FLEET_PHOTOS[v.photoKey] ? { ...v, imageAsset: FLEET_PHOTOS[v.photoKey] } : v);

/** Everything the app shows for the signed-in customer, loaded from the KeyGo server. */
export async function loadWorkspace(): Promise<Workspace> {
  const data = await api<Workspace>('/me/workspace');
  return { ...data, vehicles: data.vehicles.map(withPhoto) };
}
