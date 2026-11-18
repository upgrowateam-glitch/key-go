import { newId } from '../config/defaults';
import { serverDoc } from '../lib/serverState';
import { TODAY } from '../lib/today';
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

/** Suggested repair estimates — the inspector can overwrite them. */
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

/** Checklist results by inspection id; kept next to the inspection records. */
const checklistsDoc = serverDoc<Record<string, ChecklistResult>>('inspections.checklists', {});
const damageDoc = serverDoc<{ overlays: Record<string, DamageOverlay>; manual: ManualDamageReport[] }>('inspections.damage', { overlays: {}, manual: [] });

export const saveChecklist = (inspectionId: string, result: ChecklistResult) => {
  checklistsDoc.set({ ...checklistsDoc.get(), [inspectionId]: result }).catch(() => undefined);
};
export const getChecklist = (inspectionId: string) => checklistsDoc.get()[inspectionId];

const snapshot = () => damageDoc.get();
export const loadDamage = async () => snapshot();

export const addManualDamage = async (input: Omit<ManualDamageReport, 'id' | 'reportedOn' | 'status'>) => {
  const d = snapshot();
  await damageDoc.set({ ...d, manual: [{ ...input, id: newId('DMG'), reportedOn: TODAY, status: 'Reported' }, ...d.manual] });
  return snapshot();
};

export const updateDamage = async (key: string, patch: Partial<DamageOverlay>) => {
  const d = snapshot();
  await damageDoc.set(
    d.manual.some((m) => m.id === key)
      ? { ...d, manual: d.manual.map((m) => (m.id === key ? { ...m, ...patch } : m)) }
      : { ...d, overlays: { ...d.overlays, [key]: { ...(d.overlays[key] ?? { status: 'Reported' }), ...patch } } }
  );
  return snapshot();
};
