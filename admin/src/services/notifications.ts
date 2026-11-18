import { createStore } from '../features/notifications/listControls';
import type { MessageLogEntry, NotificationChannelSetting } from '../types';

export type TemplateChannel = MessageLogEntry['channel'];
export type TemplateType = NotificationChannelSetting['type'];

export interface MessageTemplate {
  id: string;
  name: string;
  type: TemplateType;
  channel: TemplateChannel;
  body: string;
  active: boolean;
  updatedAt: string;
}

/** Placeholder values shown in template previews; real messages use the booking's own details. */
export const TEMPLATE_VARIABLES: Record<string, string> = {
  '{customer}': 'Customer name',
  '{booking_id}': 'KG-XXXXXX',
  '{vehicle}': 'Vehicle name',
  '{vehicle_no}': 'KA 00 AA 0000',
  '{date}': '01 Jan',
  '{time}': '10:00 AM',
  '{amount}': 'Rs 0',
  '{policy_no}': 'POLICY-NO',
};

export const fillSample = (body: string) =>
  Object.entries(TEMPLATE_VARIABLES).reduce((text, [variable, sample]) => text.split(variable).join(sample), body);

/** Starting message templates; staff edit them and the edits are saved. */
export const templatesStore = createStore<MessageTemplate[]>('notifications.templates', [
  { id: 'TPL-1', name: 'Booking confirmed', type: 'booking', channel: 'WhatsApp', body: 'Hi {customer}, your KeyGo booking {booking_id} ({vehicle}) is confirmed. Reply HELP for support.', active: true, updatedAt: '' },
  { id: 'TPL-2', name: 'Pickup reminder (T-2)', type: 'booking', channel: 'WhatsApp', body: 'Hi {customer}, your {vehicle} pickup is on {date} at {time}. Please carry your driving licence.', active: true, updatedAt: '' },
  { id: 'TPL-3', name: 'Pickup reminder SMS', type: 'booking', channel: 'SMS', body: 'KeyGo: {vehicle} pickup on {date} at {time}. Carry your driving licence.', active: true, updatedAt: '' },
  { id: 'TPL-4', name: 'Return due', type: 'return', channel: 'WhatsApp', body: 'Hi {customer}, your {vehicle} ({booking_id}) is due back on {date} at {time}. Late returns may attract a fine as per your agreement.', active: true, updatedAt: '' },
  { id: 'TPL-5', name: 'Insurance expiring', type: 'insurance', channel: 'WhatsApp', body: 'Fleet alert: insurance policy {policy_no} for {vehicle_no} expires on {date}. Please renew to keep the vehicle rentable.', active: true, updatedAt: '' },
  { id: 'TPL-6', name: 'PUC expiring', type: 'emission', channel: 'SMS', body: 'Fleet alert: PUC certificate for {vehicle_no} expires on {date}. Do not dispatch the vehicle after expiry.', active: true, updatedAt: '' },
  { id: 'TPL-7', name: 'Service due', type: 'service', channel: 'WhatsApp', body: 'Fleet alert: {vehicle} ({vehicle_no}) periodic service is due by {date}.', active: true, updatedAt: '' },
  { id: 'TPL-8', name: 'EMI due', type: 'emi', channel: 'SMS', body: 'Accounts: loan EMIs totalling {amount} are due on {date}. Please ensure sufficient balance.', active: true, updatedAt: '' },
  { id: 'TPL-9', name: 'Overdue return (draft)', type: 'return', channel: 'SMS', body: 'KeyGo: {vehicle} was due back on {date}. Please return it or contact us to extend.', active: false, updatedAt: '' },
]);

export interface ProviderConfig {
  key: 'wa' | 'sms';
  senderId: string;
  accountId: string;
  /** Details were saved here; no provider is actually connected. */
  configured: boolean;
}

export const providersStore = createStore<ProviderConfig[]>('notifications.providers', [
  { key: 'wa', senderId: '', accountId: '', configured: false },
  { key: 'sms', senderId: '', accountId: '', configured: false },
]);

export interface DailySchedule {
  time: string;
  email: string;
  timezone: string;
  weekly: boolean;
}

export const scheduleStore = createStore<DailySchedule>('notifications.schedule', { time: '08:00', email: '', timezone: 'Asia/Kolkata (IST)', weekly: true });

/** Simulated "Run now" labels by automation rule id. */
export const ruleRunsStore = createStore<Record<string, string>>('notifications.ruleRuns', {});

/** Notifications marked read one at a time. */
export const readNotificationsStore = createStore<string[]>('notifications.read', []);
