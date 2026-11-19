import { api } from '../lib/api';

export type WhatsAppStatus = 'disconnected' | 'connecting' | 'waiting-for-scan' | 'connected';

export interface WhatsAppState {
  status: WhatsAppStatus;
  /** The linked number, digits with country code. */
  phone: string | null;
  /** QR code image (data URL) while waiting for the phone to scan it. */
  qr: string | null;
  error: string | null;
}

/** KeyGo's own WhatsApp number, linked like WhatsApp Web (Owners and Admins). */
export const fetchWhatsApp = () => api<WhatsAppState>('/admin/whatsapp');
export const connectWhatsApp = () => api<WhatsAppState>('/admin/whatsapp/connect', { method: 'POST' });
export const disconnectWhatsApp = () => api<WhatsAppState>('/admin/whatsapp/disconnect', { method: 'POST' });
export const sendWhatsAppTest = (phone: string) => api<{ to: string }>('/admin/whatsapp/test', { method: 'POST', body: { phone } });
