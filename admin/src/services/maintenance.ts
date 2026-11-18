import { newId } from '../config/defaults';
import { serverDoc } from '../lib/serverState';
import { TODAY } from '../lib/today';
import { daysBetween } from '../lib/format';
import type { MaintenanceReminder } from '../types';

/** Services scheduled from the Maintenance section, stored on the server. */
const scheduledDoc = serverDoc<MaintenanceReminder[]>('maintenance.scheduled', []);

export const statusForDueDate = (dueDate: string): MaintenanceReminder['status'] => {
  const d = daysBetween(TODAY, dueDate);
  return d < 0 ? 'Overdue' : d <= 30 ? 'Due soon' : 'Scheduled';
};

export const loadScheduledServices = async () => scheduledDoc.get();

export const scheduleService = (input: Pick<MaintenanceReminder, 'vehicleId' | 'type' | 'dueDate' | 'dueKm'>) =>
  scheduledDoc.set([{ ...input, id: newId('SCH'), status: statusForDueDate(input.dueDate) }, ...scheduledDoc.get()]);

export const completeScheduledService = (id: string) => scheduledDoc.set(scheduledDoc.get().map((r) => (r.id === id ? { ...r, status: 'Done' as const } : r)));

export const isScheduledService = (id: string) => id.startsWith('SCH-');
