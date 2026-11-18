import { mockRequest } from './mockClient';
import type { FASTagLog } from '../types';

/** AppContext has no way to add a toll, so entries added by hand live in this mock store. Resets on reload. */
let manual: FASTagLog[] = [];

export const isManualToll = (id: string) => id.startsWith('FT-MAN-');

export const loadManualTolls = () => mockRequest(() => manual);

export const addManualToll = (input: Omit<FASTagLog, 'id' | 'billedToCustomer'>) =>
  mockRequest(() => {
    manual = [{ ...input, id: `FT-MAN-${Date.now().toString(36).toUpperCase()}`, billedToCustomer: false }, ...manual];
    return manual;
  });

export const billManualToll = (id: string) =>
  mockRequest(() => {
    manual = manual.map((l) => (l.id === id ? { ...l, billedToCustomer: true } : l));
    return manual;
  });
