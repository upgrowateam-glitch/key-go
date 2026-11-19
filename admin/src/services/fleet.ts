import { newId } from '../config/defaults';
import { allNames, masterLists } from '../lib/catalog';
import { serverDoc } from '../lib/serverState';
import type { VerificationStatus } from '../types';

/** Vehicle categories come from Settings → Master data. */
export type VehicleCategory = string;
export const vehicleCategories = () => allNames(masterLists().categories);

/** A document file kept in the server's document storage (`key` is the stored file id). */
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

/** Vehicle categories, document checklists and GPS events, stored on the server as one document. */
const extrasDoc = serverDoc<FleetExtras>('fleet.extras', { categories: {}, documents: {}, gpsEvents: {} });

const save = (patch: Partial<FleetExtras>) => {
  extrasDoc.set({ ...extrasDoc.get(), ...patch }).catch(() => undefined);
};

/** Every vehicle starts with this checklist; staff fill in the numbers and upload the files. */
const blankDocs = (vehicleId: string): VehicleDocument[] => [
  { id: `${vehicleId}-rc`, name: 'Registration certificate (RC)', reference: 'Not recorded', status: 'Not uploaded' },
  { id: `${vehicleId}-fit`, name: 'Fitness certificate', reference: 'Not recorded', status: 'Not uploaded' },
  { id: `${vehicleId}-tax`, name: 'Road tax receipt', reference: 'Not recorded', status: 'Not uploaded' },
];

export const readFleetExtras = (): FleetExtras => ({ ...extrasDoc.get() });
export const loadFleetExtras = async () => readFleetExtras();

export const categoryOf = (extras: FleetExtras, vehicleId: string): VehicleCategory => extras.categories[vehicleId] ?? 'Standard';
export const documentsOf = (extras: FleetExtras, vehicleId: string) => extras.documents[vehicleId] ?? blankDocs(vehicleId);

export function saveVehicleCategory(vehicleId: string, category: VehicleCategory) {
  save({ categories: { ...extrasDoc.get().categories, [vehicleId]: category } });
}

export function saveVehicleDocument(vehicleId: string, documentId: string, patch: Partial<VehicleDocument>) {
  const extras = extrasDoc.get();
  save({ documents: { ...extras.documents, [vehicleId]: documentsOf(extras, vehicleId).map((d) => (d.id === documentId ? { ...d, ...patch } : d)) } });
}

/** Adds a document slot beyond the standard checklist (permit, insurance copy, loan NOC, ...). */
export function addVehicleDocument(vehicleId: string, input: { name: string; reference: string; expiry?: string }): VehicleDocument {
  const extras = extrasDoc.get();
  const doc: VehicleDocument = { id: newId(`${vehicleId}-doc`), status: 'Not uploaded', custom: true, ...input };
  save({ documents: { ...extras.documents, [vehicleId]: [...documentsOf(extras, vehicleId), doc] } });
  return doc;
}

/** Removes a staff-added document slot. Standard slots are never removed, only cleared. */
export function removeVehicleDocument(vehicleId: string, documentId: string) {
  const extras = extrasDoc.get();
  save({ documents: { ...extras.documents, [vehicleId]: documentsOf(extras, vehicleId).filter((d) => !(d.id === documentId && d.custom)) } });
}

export function addGpsEvent(vehicleId: string, event: Omit<GpsEvent, 'id'>) {
  const extras = extrasDoc.get();
  save({ gpsEvents: { ...extras.gpsEvents, [vehicleId]: [{ ...event, id: newId('GPS') }, ...(extras.gpsEvents[vehicleId] ?? [])] } });
}
