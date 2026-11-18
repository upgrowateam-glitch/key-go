import { newId } from '../config/defaults';
import { serverDoc } from '../lib/serverState';
import type { FASTagLog } from '../types';

/** Tolls entered by hand (until the FASTag provider is connected), stored on the server. */
const manualDoc = serverDoc<FASTagLog[]>('fastag.manual', []);

export const isManualToll = (id: string) => id.startsWith('FT-MAN-');

export const loadManualTolls = async () => manualDoc.get();

export const addManualToll = (input: Omit<FASTagLog, 'id' | 'billedToCustomer'>) =>
  manualDoc.set([{ ...input, id: newId('FT-MAN'), billedToCustomer: false }, ...manualDoc.get()]);

export const billManualToll = (id: string) => manualDoc.set(manualDoc.get().map((l) => (l.id === id ? { ...l, billedToCustomer: true } : l)));
