import type { VerificationStatus } from '../types';
import { mockRequest } from './mockClient';

export const VEHICLE_CATEGORIES = ['Economy', 'Standard', 'Premium', 'Luxury'] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

/** The bytes of a stored document live in the browser file store (`lib/fileStore`) under `key`. */
export interface StoredFile {
  key: string;
  name: string;
  type: string;
  size: number;
}

export interface VehicleDocument {
  id: string;
  name: string;
  reference: string;
  expiry?: string;
  status: VerificationStatus;
  uploadedAt?: string;
  file?: StoredFile;
  /** Added by staff on top of the standard checklist; can be deleted. */
  custom?: boolean;
}

export interface GpsEvent {
  id: string;
  time: string;
  event: string;
  area: string;
}

export interface FleetExtras {
  categories: Record<string, VehicleCategory>;
  documents: Record<string, VehicleDocument[]>;
  gpsEvents: Record<string, GpsEvent[]>;
}

const docs = (prefix: string, rc: string, fitnessExpiry: string, taxExpiry: string, taxStatus: VerificationStatus = 'Verified'): VehicleDocument[] => [
  { id: `${prefix}-rc`, name: 'Registration certificate (RC)', reference: rc, status: 'Verified', uploadedAt: '2025-06-12' },
  { id: `${prefix}-fit`, name: 'Fitness certificate', reference: `FC-${rc}`, expiry: fitnessExpiry, status: 'Verified', uploadedAt: '2026-01-20' },
  { id: `${prefix}-tax`, name: 'Road tax receipt', reference: `RT-${rc}`, expiry: taxExpiry, status: taxStatus, uploadedAt: taxStatus === 'Not uploaded' ? undefined : '2026-04-02' },
];

/**
 * Store standing in for the API. Categories and GPS events are session-only; vehicle documents are
 * persisted in localStorage (and their files in IndexedDB) so stored paperwork survives a reload.
 */
const store: FleetExtras = {
  categories: { 'car-1': 'Premium', 'car-2': 'Premium', 'car-3': 'Luxury', 'car-4': 'Standard', 'car-5': 'Standard', 'car-6': 'Luxury' },
  documents: {
    'car-1': docs('car-1', 'KA01MX4921', '2028-03-14', '2027-03-31'),
    'car-2': docs('car-2', 'KA05EV9012', '2029-07-01', '2027-03-31'),
    'car-3': docs('car-3', 'MH02GT7007', '2027-11-22', '2026-10-31', 'Pending'),
    'car-4': docs('car-4', 'KA03MS2210', '2028-08-30', '2027-03-31'),
    'car-5': docs('car-5', 'DL01TR8812', '2027-05-18', '2026-12-31'),
    'car-6': docs('car-6', 'KA04LX1007', '2028-01-09', '2026-10-15', 'Not uploaded'),
  },
  gpsEvents: {
    'car-1': [
      { id: 'g1-1', time: '2026-09-26 09:42', event: 'Ignition on', area: 'Indiranagar, Bengaluru' },
      { id: 'g1-2', time: '2026-09-25 18:10', event: 'Ignition off', area: 'Koramangala, Bengaluru' },
      { id: 'g1-3', time: '2026-09-25 11:32', event: 'Left geofence', area: 'KeyGo Hub, Indiranagar' },
    ],
    'car-2': [
      { id: 'g2-1', time: '2026-09-26 08:05', event: 'Charging started', area: 'EV Care Centre, Whitefield' },
      { id: 'g2-2', time: '2026-09-25 20:48', event: 'Ignition off', area: 'Whitefield, Bengaluru' },
    ],
    'car-3': [
      { id: 'g3-1', time: '2026-09-26 07:20', event: 'Overspeed alert (112 km/h)', area: 'Mumbai–Pune Expressway' },
      { id: 'g3-2', time: '2026-09-25 22:15', event: 'Ignition off', area: 'Lonavala, Maharashtra' },
    ],
    'car-4': [{ id: 'g4-1', time: '2026-09-26 10:02', event: 'Entered geofence', area: 'Koramangala, Bengaluru' }],
    'car-5': [{ id: 'g5-1', time: '2026-09-25 17:30', event: 'Ignition off', area: 'Karol Bagh, Delhi' }],
    'car-6': [{ id: 'g6-1', time: '2026-09-24 09:00', event: 'Parked at workshop', area: 'Premium Auto Care, Hebbal' }],
  },
};

const blankDocs = (vehicleId: string): VehicleDocument[] => [
  { id: `${vehicleId}-rc`, name: 'Registration certificate (RC)', reference: 'Not recorded', status: 'Not uploaded' },
  { id: `${vehicleId}-fit`, name: 'Fitness certificate', reference: 'Not recorded', status: 'Not uploaded' },
  { id: `${vehicleId}-tax`, name: 'Road tax receipt', reference: 'Not recorded', status: 'Not uploaded' },
];

const DOCUMENTS_KEY = 'keygo.admin.vehicle-documents.v1';

function readPersistedDocuments(): Record<string, VehicleDocument[]> {
  try {
    const raw = globalThis.localStorage?.getItem(DOCUMENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, VehicleDocument[]>) : {};
  } catch {
    return {};
  }
}

function persistDocuments() {
  try {
    globalThis.localStorage?.setItem(DOCUMENTS_KEY, JSON.stringify(store.documents));
  } catch {
    // Storage full or blocked: the in-memory copy still serves this session.
  }
}

// Persisted edits win over the seed for the vehicles they cover.
store.documents = { ...store.documents, ...readPersistedDocuments() };

export const readFleetExtras = (): FleetExtras => ({ ...store });
export const loadFleetExtras = () => mockRequest(readFleetExtras);

export const categoryOf = (extras: FleetExtras, vehicleId: string): VehicleCategory => extras.categories[vehicleId] ?? 'Standard';
export const documentsOf = (extras: FleetExtras, vehicleId: string) => extras.documents[vehicleId] ?? blankDocs(vehicleId);

export function saveVehicleCategory(vehicleId: string, category: VehicleCategory) {
  store.categories = { ...store.categories, [vehicleId]: category };
}

export function saveVehicleDocument(vehicleId: string, documentId: string, patch: Partial<VehicleDocument>) {
  store.documents = {
    ...store.documents,
    [vehicleId]: documentsOf(store, vehicleId).map((d) => (d.id === documentId ? { ...d, ...patch } : d)),
  };
  persistDocuments();
}

/** Adds a document slot beyond the standard checklist (permit, insurance copy, loan NOC, ...). */
export function addVehicleDocument(vehicleId: string, input: { name: string; reference: string; expiry?: string }): VehicleDocument {
  const doc: VehicleDocument = { id: `${vehicleId}-doc-${Date.now()}`, status: 'Not uploaded', custom: true, ...input };
  store.documents = { ...store.documents, [vehicleId]: [...documentsOf(store, vehicleId), doc] };
  persistDocuments();
  return doc;
}

/** Removes a staff-added document slot. Standard slots are never removed, only cleared. */
export function removeVehicleDocument(vehicleId: string, documentId: string) {
  store.documents = {
    ...store.documents,
    [vehicleId]: documentsOf(store, vehicleId).filter((d) => !(d.id === documentId && d.custom)),
  };
  persistDocuments();
}

export function addGpsEvent(vehicleId: string, event: Omit<GpsEvent, 'id'>) {
  store.gpsEvents = {
    ...store.gpsEvents,
    [vehicleId]: [{ ...event, id: `gps-${Date.now()}` }, ...(store.gpsEvents[vehicleId] ?? [])],
  };
}
