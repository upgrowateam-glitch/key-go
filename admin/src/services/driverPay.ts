import { api } from '../lib/api';
import type { AuditEntry } from './identity';

const enc = encodeURIComponent;

export interface PayTrip {
  bookingId: string;
  customerName: string;
  vehicleNumber: string;
  completedOn: string;
  amount: number;
  commission: number;
}

export interface PayEntry {
  id: string;
  driverId: string;
  month: string;
  type: 'advance' | 'deduction' | 'bonus';
  amount: number;
  note: string;
  date: string;
  createdBy: string;
  createdAt: string;
}

export interface DriverPay {
  driverId: string;
  name: string;
  month: string;
  salary: number;
  salaryFrom: string;
  commissionPercent: number;
  trips: PayTrip[];
  commission: number;
  entries: PayEntry[];
  advances: number;
  deductions: number;
  bonuses: number;
  payable: number;
  status: 'Open' | 'Finalised' | 'Paid';
  payslip?: { finalisedBy: string; finalisedAt: string; paidAt?: string; paidBy?: string; method?: string; reference?: string };
}

export interface SalaryRecord {
  id: string;
  driverId: string;
  from: string;
  amount: number;
  note?: string;
  setBy: string;
  setAt: string;
}

const base = '/admin/payroll/drivers';
export const fetchDriverPay = (month: string) => api<DriverPay[]>(`${base}?month=${enc(month)}`);
export const addPayEntry = (driverId: string, entry: { month: string; type: PayEntry['type']; amount: number; note: string; date?: string }) =>
  api<PayEntry>(`${base}/${enc(driverId)}/entries`, { method: 'POST', body: entry });
export const removePayEntry = (driverId: string, entryId: string) => api(`${base}/${enc(driverId)}/entries/${enc(entryId)}`, { method: 'DELETE' });
export const setDriverSalary = (driverId: string, input: { from: string; amount: number; note?: string }) => api<SalaryRecord>(`${base}/${enc(driverId)}/salary`, { method: 'PUT', body: input });
export const finaliseDriverPay = (driverId: string, month: string) => api<DriverPay>(`${base}/${enc(driverId)}/finalise`, { method: 'POST', body: { month } });
export const reopenDriverPay = (driverId: string, month: string) => api<DriverPay>(`${base}/${enc(driverId)}/reopen`, { method: 'POST', body: { month } });
export const markDriverPaid = (driverId: string, input: { month: string; method: string; reference: string }) => api<DriverPay>(`${base}/${enc(driverId)}/paid`, { method: 'POST', body: input });
export const driverPayHistory = (driverId: string) => api<{ salaries: SalaryRecord[]; log: AuditEntry[] }>(`${base}/${enc(driverId)}/history`);
