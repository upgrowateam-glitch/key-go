import { mockRequest } from './mockClient';
import { DEMO_TODAY } from '../data/mockData';
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

// Mock server state: survives tab switches, resets on reload.
let contacts: ContactLogEntry[] = [];

export const loadContactLog = () => mockRequest(() => contacts);

export const logContact = (input: Omit<ContactLogEntry, 'id' | 'date'>) =>
  mockRequest(() => {
    contacts = [{ ...input, id: `CL-${Date.now().toString(36).toUpperCase()}`, date: DEMO_TODAY }, ...contacts];
    return contacts;
  });

/** Stands in for a telematics poll: returns a fresh simulated reading for each vehicle on the road. */
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
