import { api } from '../lib/api';
import type { Booking, BookingExtension } from '../types';

const enc = encodeURIComponent;
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

const base = (id: string) => `/admin/bookings/${enc(id)}/extensions`;
export const quoteExtension = (bookingId: string, unit: ExtensionUnit, amount: number) => api<ExtensionQuote>(`${base(bookingId)}/quote?unit=${unit}&amount=${amount}`);
export const extendRentalNow = (bookingId: string, unit: ExtensionUnit, amount: number) => api<Booking>(base(bookingId), { method: 'POST', body: { unit, amount } });
export const approveExtension = (bookingId: string, extId: string) => api<Booking>(`${base(bookingId)}/${enc(extId)}/approve`, { method: 'POST' });
export const declineExtension = (bookingId: string, extId: string, reason: string) => api<Booking>(`${base(bookingId)}/${enc(extId)}/decline`, { method: 'POST', body: { reason } });

/** Approved extensions added to a booking, and the request waiting for staff (if any). */
export function extensionSummary(b: Booking) {
  const all: BookingExtension[] = b.extensions ?? [];
  const approved = all.filter((e) => e.status === 'Approved');
  return {
    all,
    approved,
    pending: all.find((e) => e.status === 'Requested'),
    days: approved.filter((e) => e.unit === 'days').reduce((s, e) => s + e.amount, 0),
    hours: approved.filter((e) => e.unit === 'hours').reduce((s, e) => s + e.amount, 0),
    subtotal: approved.reduce((s, e) => s + e.extraSubtotal, 0),
  };
}

export const extensionLabel = (e: Pick<BookingExtension, 'unit' | 'amount'>) => `+${e.amount} ${e.unit === 'days' ? (e.amount === 1 ? 'day' : 'days') : e.amount === 1 ? 'hour' : 'hours'}`;
