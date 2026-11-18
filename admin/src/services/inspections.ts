import { mockRequest } from './mockClient';
import { DEMO_TODAY } from '../data/mockData';
import type { CarZone, DamageMark } from '../types';

export const CHECKLIST_ITEMS = [
  'Exterior clean and undamaged',
  'Interior clean and odour free',
  'Tyres and spare in good condition',
  'All lights and indicators working',
  'Wipers and washer fluid working',
  'AC and infotainment working',
  'Jack, toolkit and warning triangle present',
  'RC, insurance and PUC copies in the vehicle',
] as const;
export type ChecklistResult = Record<string, boolean>;

/** Suggested repair estimates — placeholders the inspector can overwrite. */
export const SUGGESTED_COST: Record<DamageMark['severity'], number> = { Minor: 1500, Moderate: 5000, Major: 15000 };

export const DAMAGE_STATUSES = ['Reported', 'Estimated', 'In repair', 'Repaired', 'Charged', 'Waived'] as const;
export type DamageStatus = (typeof DAMAGE_STATUSES)[number];

export interface DamageEstimate {
  parts: number;
  labour: number;
  paint: number;
}

/** Changes made to a damage mark that came from an inspection report. */
export interface DamageOverlay extends Partial<DamageEstimate> {
  status: DamageStatus;
}

/** Damage reported outside of an inspection, e.g. found in the yard. */
export interface ManualDamageReport extends DamageEstimate {
  id: string;
  vehicleId: string;
  zone: CarZone;
  kind: DamageMark['kind'];
  severity: DamageMark['severity'];
  reportedBy: string;
  reportedOn: string;
  notes?: string;
  status: DamageStatus;
}

// Mock server state: survives tab switches, resets on reload.
const checklists = new Map<string, ChecklistResult>();
let overlays: Record<string, DamageOverlay> = {};
let manual: ManualDamageReport[] = [
  { id: 'DMG-301', vehicleId: 'car-4', zone: 'Left rear door', kind: 'Dent', severity: 'Moderate', parts: 0, labour: 3500, paint: 2500, reportedBy: 'Vikram Singh', reportedOn: '2026-09-18', notes: 'Found in the yard after a parking incident.', status: 'In repair' },
];

/** Stored alongside recordInspection, which only keeps the fields on InspectionRecord. */
export const saveChecklist = (inspectionId: string, result: ChecklistResult) => {
  checklists.set(inspectionId, result);
};
export const getChecklist = (inspectionId: string) => checklists.get(inspectionId);

const snapshot = () => ({ overlays, manual });
export const loadDamage = () => mockRequest(snapshot);

export const addManualDamage = (input: Omit<ManualDamageReport, 'id' | 'reportedOn' | 'status'>) =>
  mockRequest(() => {
    manual = [{ ...input, id: `DMG-${Date.now().toString(36).toUpperCase()}`, reportedOn: DEMO_TODAY, status: 'Reported' }, ...manual];
    return snapshot();
  });

export const updateDamage = (key: string, patch: Partial<DamageOverlay>) =>
  mockRequest(() => {
    if (manual.some((m) => m.id === key)) {
      manual = manual.map((m) => (m.id === key ? { ...m, ...patch } : m));
    } else {
      overlays = { ...overlays, [key]: { ...(overlays[key] ?? { status: 'Reported' }), ...patch } };
    }
    return snapshot();
  });
