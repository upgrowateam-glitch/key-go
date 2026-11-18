import { newId } from '../config/defaults';
import { serverDoc } from '../lib/serverState';
import { TODAY } from '../lib/today';
import type { CustomerDocument } from '../types';
import { addLedgerEntry } from './finance';

/** HR records the portal state does not hold, stored on the server as documents. */

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

const profilesDoc = serverDoc<StaffProfile[]>('people.profiles', []);

export const fetchStaffProfiles = async () => profilesDoc.get();

export const uploadStaffDocument = async (staffId: string, docId: string) => {
  await profilesDoc.set(
    profilesDoc.get().map((p) =>
      p.staffId === staffId ? { ...p, documents: p.documents.map((d) => (d.id === docId ? { ...d, status: 'Pending', uploadedAt: TODAY } : d)) } : p
    )
  );
};

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

const dutyDoc = serverDoc<DutyRecord[]>('people.duty', []);

export const fetchDutyRecords = async () => dutyDoc.get();

export const addDutyRecord = async (input: Omit<DutyRecord, 'id'>) => {
  await dutyDoc.set([{ ...input, id: newId('DUTY') }, ...dutyDoc.get()]);
  return dutyDoc.get();
};

// ---------------------------------------------------------------- payroll payouts

export interface Payout {
  personId: string;
  month: string;
  amount: number;
  txnRef: string;
  paidOn: string;
}

const payoutsDoc = serverDoc<Payout[]>('people.payouts', []);

export const fetchPayouts = async () => payoutsDoc.get();

/** Records the salary as paid and posts it to the finance ledger, so Finance and Reports pick it up. */
export const markPayoutPaid = async (input: { personId: string; personName: string; month: string; amount: number }) => {
  const txnRef = `SAL/${input.month.replace('-', '')}/${newId('P').slice(2)}`;
  await addLedgerEntry({ date: TODAY, category: 'Salary', direction: 'out', amount: input.amount, reference: `${input.personName} · ${txnRef}` });
  const payout: Payout = { personId: input.personId, month: input.month, amount: input.amount, txnRef, paidOn: TODAY };
  await payoutsDoc.set([payout, ...payoutsDoc.get()]);
  return payout;
};
