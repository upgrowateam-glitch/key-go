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

export const TEMPLATE_VARIABLES: Record<string, string> = {
  '{customer}': 'Suresh',
  '{booking_id}': 'KG-6299',
  '{vehicle}': 'Urban SUV',
  '{vehicle_no}': 'KA 04 LX 1007',
  '{date}': '28 Sep',
  '{time}': '08:00 AM',
  '{amount}': 'Rs 1,54,600',
  '{policy_no}': 'INS-ROYAL-9910',
};

export const fillSample = (body: string) =>
  Object.entries(TEMPLATE_VARIABLES).reduce((text, [variable, sample]) => text.split(variable).join(sample), body);

export const templatesStore = createStore<MessageTemplate[]>([
  { id: 'TPL-1', name: 'Booking confirmed', type: 'booking', channel: 'WhatsApp', body: 'Hi {customer}, your KeyGo booking {booking_id} ({vehicle}) is confirmed. Reply HELP for support.', active: true, updatedAt: '2026-09-12' },
  { id: 'TPL-2', name: 'Pickup reminder (T-2)', type: 'booking', channel: 'WhatsApp', body: 'Hi {customer}, your {vehicle} pickup is on {date} at {time}. Please carry your driving licence.', active: true, updatedAt: '2026-09-12' },
  { id: 'TPL-3', name: 'Pickup reminder SMS', type: 'booking', channel: 'SMS', body: 'KeyGo: {vehicle} pickup on {date} at {time}. Carry your driving licence.', active: true, updatedAt: '2026-08-30' },
  { id: 'TPL-4', name: 'Return due', type: 'return', channel: 'WhatsApp', body: 'Hi {customer}, your {vehicle} ({booking_id}) is due back on {date} at {time}. Late returns may attract a fine as per your agreement.', active: true, updatedAt: '2026-09-02' },
  { id: 'TPL-5', name: 'Insurance expiring', type: 'insurance', channel: 'WhatsApp', body: 'Fleet alert: insurance policy {policy_no} for {vehicle_no} expires on {date}. Please renew to keep the vehicle rentable.', active: true, updatedAt: '2026-07-18' },
  { id: 'TPL-6', name: 'PUC expiring', type: 'emission', channel: 'SMS', body: 'Fleet alert: PUC certificate for {vehicle_no} expires on {date}. Do not dispatch the vehicle after expiry.', active: true, updatedAt: '2026-07-18' },
  { id: 'TPL-7', name: 'Service due', type: 'service', channel: 'WhatsApp', body: 'Fleet alert: {vehicle} ({vehicle_no}) periodic service is due by {date}.', active: true, updatedAt: '2026-06-21' },
  { id: 'TPL-8', name: 'EMI due', type: 'emi', channel: 'SMS', body: 'Accounts: loan EMIs totalling {amount} are due on {date}. Please ensure sufficient balance.', active: true, updatedAt: '2026-06-21' },
  { id: 'TPL-9', name: 'Overdue return (draft)', type: 'return', channel: 'SMS', body: 'KeyGo: {vehicle} was due back on {date}. Please return it or contact us to extend.', active: false, updatedAt: '2026-09-20' },
]);

export interface ProviderConfig {
  key: 'wa' | 'sms';
  senderId: string;
  accountId: string;
  /** Details were saved here; no provider is actually connected. */
  configured: boolean;
}

export const providersStore = createStore<ProviderConfig[]>([
  { key: 'wa', senderId: '', accountId: '', configured: false },
  { key: 'sms', senderId: '', accountId: '', configured: false },
]);

export interface DailySchedule {
  time: string;
  email: string;
  timezone: string;
  weekly: boolean;
}

export const scheduleStore = createStore<DailySchedule>({ time: '08:00', email: 'ops@keygo.in', timezone: 'Asia/Kolkata (IST)', weekly: true });

/** Simulated "Run now" labels by automation rule id. */
export const ruleRunsStore = createStore<Record<string, string>>({});

/** Notifications marked read one at a time. */
export const readNotificationsStore = createStore<string[]>([]);
