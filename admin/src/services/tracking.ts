import { mockRequest } from './mockClient';
import { newId } from '../config/defaults';
import { serverDoc } from '../lib/serverState';
import { TODAY } from '../lib/today';
import type { Vehicle } from '../types';

export type ContactOutcome = 'Reached' | 'No answer' | 'Promised return' | 'Escalated';

export interface ContactLogEntry {
  id: string;
  bookingId: string;
  outcome: ContactOutcome;
  note: string;
  by: string;
  date: string;
}

export interface GpsPing {
  speedKmh: number;
  ignitionOn: boolean;
  updatedAt: string;
}

/** Calls and messages to customers about overdue returns, stored on the server. */
const contactsDoc = serverDoc<ContactLogEntry[]>('tracking.contacts', []);

export const loadContactLog = async () => contactsDoc.get();

export const logContact = (input: Omit<ContactLogEntry, 'id' | 'date'>) =>
  contactsDoc.set([{ ...input, id: newId('CL'), date: TODAY }, ...contactsDoc.get()]);

/** Stands in for a telematics poll until GPS devices are connected: a simulated reading for each vehicle on the road. */
export const pingFleet = (vehicles: Vehicle[]) =>
  mockRequest(() => {
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const pings: Record<string, GpsPing> = {};
    vehicles.forEach((v) => {
      const moving = v.gps.ignitionOn;
      pings[v.id] = { speedKmh: moving ? Math.max(0, v.gps.speedKmh + Math.round(Math.random() * 20 - 10)) : 0, ignitionOn: v.gps.ignitionOn, updatedAt: `Today, ${at}` };
    });
    return pings;
  });
