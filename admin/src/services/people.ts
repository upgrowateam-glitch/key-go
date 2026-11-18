import { DEMO_TODAY, INITIAL_DRIVERS, INITIAL_STAFF_PUNCHES } from '../data/mockData';
import { addDays } from '../lib/format';
import type { CustomerDocument } from '../types';
import { addLedgerEntry } from './finance';
import { mockRequest } from './mockClient';

/**
 * HR records AppContext does not hold. They live in this module, so changes survive tab switches but reset on reload.
 */

export interface StaffProfile {
  staffId: string;
  employeeCode: string;
  email: string;
  branch: string;
  joinedOn: string;
  employment: 'Full time' | 'Part time' | 'Contract';
  emergencyContact: string;
  documents: CustomerDocument[];
}

const staffDocs = (prefix: string, verified: boolean): CustomerDocument[] => [
  { id: `${prefix}-d1`, name: 'Aadhaar card', kind: 'ID card', status: 'Verified', uploadedAt: '2025-06-02' },
  { id: `${prefix}-d2`, name: 'Address proof', kind: 'Address proof', status: verified ? 'Verified' : 'Pending', uploadedAt: '2025-06-02' },
  { id: `${prefix}-d3`, name: 'Signed employment letter', kind: 'Other', status: verified ? 'Verified' : 'Not uploaded', uploadedAt: verified ? '2025-06-04' : undefined },
];

let profiles: StaffProfile[] = [
  { staffId: 'PUNCH-101', employeeCode: 'KG-E014', email: 'vikram.singh@keygo.example', branch: 'Hebbal, Bengaluru', joinedOn: '2024-11-18', employment: 'Full time', emergencyContact: 'Neha Singh · +91 98860 44120', documents: staffDocs('s101', true) },
  { staffId: 'PUNCH-102', employeeCode: 'KG-E021', email: 'arun.kumar@keygo.example', branch: 'Bengaluru Airport', joinedOn: '2025-06-02', employment: 'Full time', emergencyContact: 'Lakshmi Kumar · +91 99450 12077', documents: staffDocs('s102', false) },
  { staffId: 'PUNCH-103', employeeCode: 'KG-E009', email: 'kavya.reddy@keygo.example', branch: 'Hebbal, Bengaluru', joinedOn: '2024-03-11', employment: 'Full time', emergencyContact: 'Srinivas Reddy · +91 90080 33415', documents: staffDocs('s103', true) },
];

export const fetchStaffProfiles = () => mockRequest(() => profiles);

export const uploadStaffDocument = (staffId: string, docId: string) =>
  mockRequest(() => {
    profiles = profiles.map((p) =>
      p.staffId === staffId
        ? { ...p, documents: p.documents.map((d) => (d.id === docId ? { ...d, status: 'Pending', uploadedAt: DEMO_TODAY } : d)) }
        : p
    );
  });

// ---------------------------------------------------------------- duty records

export interface DutyRecord {
  id: string;
  personId: string;
  personName: string;
  kind: 'Staff' | 'Driver';
  date: string;
  start: string;
  end: string;
  hours: number;
  overtime: number;
  note?: string;
}

/** Thirteen working days before today, stable between renders. Weekly offs are skipped. */
function buildDutyRecords(): DutyRecord[] {
  const people = [
    ...INITIAL_STAFF_PUNCHES.map((s) => ({ id: s.id, name: s.staffName, kind: 'Staff' as const })),
    ...INITIAL_DRIVERS.map((d) => ({ id: d.id, name: d.name, kind: 'Driver' as const })),
  ];
  const records: DutyRecord[] = [];
  people.forEach((p, personIndex) => {
    for (let back = 1; back <= 14; back++) {
      if ((back + personIndex) % 7 === 0) continue;
      const overtime = (back * (personIndex + 3)) % 11 === 0 ? 2 : 0;
      records.push({
        id: `DUTY-${p.id}-${back}`,
        personId: p.id,
        personName: p.name,
        kind: p.kind,
        date: addDays(DEMO_TODAY, -back),
        start: personIndex % 2 ? '09:00 AM' : '08:30 AM',
        end: overtime ? (personIndex % 2 ? '08:00 PM' : '07:30 PM') : personIndex % 2 ? '06:00 PM' : '05:30 PM',
        hours: 9 + overtime,
        overtime,
        note: overtime ? (p.kind === 'Driver' ? 'Extended chauffeur trip' : 'Late returns at the counter') : undefined,
      });
    }
  });
  return records;
}

const dutyRecords = buildDutyRecords();

export const fetchDutyRecords = () => mockRequest(() => dutyRecords);

// ---------------------------------------------------------------- payroll payouts

export interface Payout {
  personId: string;
  month: string;
  amount: number;
  txnRef: string;
  paidOn: string;
}

let payouts: Payout[] = [];
let payoutSeq = 100;

export const fetchPayouts = () => mockRequest(() => payouts);

/** Records the salary as paid and posts it to the finance ledger, so Finance and Reports pick it up. */
export const markPayoutPaid = async (input: { personId: string; personName: string; month: string; amount: number }) => {
  const txnRef = `SAL/${input.month.replace('-', '')}/${++payoutSeq}`;
  await addLedgerEntry({ date: DEMO_TODAY, category: 'Salary', direction: 'out', amount: input.amount, reference: `${input.personName} · ${txnRef}` });
  return mockRequest(() => {
    const payout: Payout = { personId: input.personId, month: input.month, amount: input.amount, txnRef, paidOn: DEMO_TODAY };
    payouts = [payout, ...payouts];
    return payout;
  });
};
