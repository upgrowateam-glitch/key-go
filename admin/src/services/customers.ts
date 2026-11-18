import { newId } from '../config/defaults';
import { serverDoc } from '../lib/serverState';
import { TODAY } from '../lib/today';
import { readSession } from './auth';

/** One audit-trail row: who changed what, when, and from which value to which. */
export interface CustomerActivity {
  id: string;
  customerId: string;
  at: string;
  who: string;
  action: string;
  field?: string;
  previous?: string;
  next?: string;
}

export type ActivityInput = Pick<CustomerActivity, 'action' | 'field' | 'previous' | 'next'>;

const activityDoc = serverDoc<CustomerActivity[]>('customers.activity', []);

export const readCustomerActivity = (customerId: string) => activityDoc.get().filter((a) => a.customerId === customerId);
export const loadCustomerActivity = async (customerId: string) => readCustomerActivity(customerId);

export function logCustomerActivity(customerId: string, entries: ActivityInput[]) {
  const who = readSession()?.name ?? 'Staff';
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const added = entries.map((e) => ({ ...e, id: newId('ACT'), customerId, who, at: `${TODAY} ${time}` }));
  activityDoc.set([...added, ...activityDoc.get()]).catch(() => undefined);
}
