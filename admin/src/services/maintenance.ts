import { mockRequest } from './mockClient';
import { DEMO_TODAY } from '../data/mockData';
import { daysBetween } from '../lib/format';
import type { MaintenanceReminder } from '../types';

/** AppContext has no way to add a reminder, so scheduled services added here live in this mock store. */
let scheduled: MaintenanceReminder[] = [];

export const statusForDueDate = (dueDate: string): MaintenanceReminder['status'] => {
  const d = daysBetween(DEMO_TODAY, dueDate);
  return d < 0 ? 'Overdue' : d <= 30 ? 'Due soon' : 'Scheduled';
};

const snapshot = () => scheduled;
export const loadScheduledServices = () => mockRequest(snapshot);

export const scheduleService = (input: Pick<MaintenanceReminder, 'vehicleId' | 'type' | 'dueDate' | 'dueKm'>) =>
  mockRequest(() => {
    scheduled = [{ ...input, id: `SCH-${Date.now().toString(36).toUpperCase()}`, status: statusForDueDate(input.dueDate) }, ...scheduled];
    return snapshot();
  });

export const completeScheduledService = (id: string) =>
  mockRequest(() => {
    scheduled = scheduled.map((r) => (r.id === id ? { ...r, status: 'Done' } : r));
    return snapshot();
  });

export const isScheduledService = (id: string) => id.startsWith('SCH-');
