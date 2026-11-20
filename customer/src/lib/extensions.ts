import { api } from './api';
import type { Booking, BookingExtension } from '../types';

export type ExtensionUnit = 'hours' | 'days';

export interface ExtensionQuote {
  unit: ExtensionUnit;
  amount: number;
  newReturnDate: string;
  newReturnTime: string;
  extraRent: number;
  extraDriver: number;
  extraSubtotal: number;
  extraTax: number;
  extraTotal: number;
  explain: string;
  available: boolean;
  latestReturn?: { date: string; time: string };
  problem?: string;
}

const enc = encodeURIComponent;

/** Price and availability of extending your rental (the server works it out from the car's prices). */
export const quoteExtension = (bookingId: string, unit: ExtensionUnit, amount: number) => api<ExtensionQuote>(`/me/bookings/${enc(bookingId)}/extend-quote?unit=${unit}&amount=${amount}`);

/** Asks KeyGo for more time; the car is held while staff decide. Returns the updated booking. */
export const requestExtension = (bookingId: string, unit: ExtensionUnit, amount: number) => api<Booking>(`/me/bookings/${enc(bookingId)}/extend`, { method: 'POST', body: { unit, amount } });

/** Approved extensions on a booking and the request waiting for KeyGo (if any). */
export function extensionSummary(b: Booking) {
  const all: BookingExtension[] = b.extensions ?? [];
  const approved = all.filter((e) => e.status === 'Approved');
  return {
    all,
    approved,
    pending: all.find((e) => e.status === 'Requested'),
    /** The latest answered request (to tell the customer about a decline). */
    last: [...all].reverse().find((e) => e.status !== 'Requested'),
    days: approved.filter((e) => e.unit === 'days').reduce((s, e) => s + e.amount, 0),
    subtotal: approved.reduce((s, e) => s + e.extraSubtotal, 0),
  };
}

export const extensionLabel = (e: Pick<BookingExtension, 'unit' | 'amount'>) => `+${e.amount} ${e.unit === 'days' ? (e.amount === 1 ? 'day' : 'days') : e.amount === 1 ? 'hour' : 'hours'}`;
