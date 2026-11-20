import { API_URL, ApiError, api, errorFrom, readToken } from '../lib/api';
import type { Customer, IdentityDoc } from '../types';

const enc = encodeURIComponent;
export type OwnerType = 'customer' | 'driver';

export interface IdentityList {
  documents: IdentityDoc[];
  canUpload: boolean;
  /** May open the documents (ID documents & face check: view). */
  canOpen: boolean;
  /** May verify, reject, delete and do the face check (ID documents & face check: edit). */
  canReview: boolean;
}

export const listIdentity = (ownerType: OwnerType, ownerId: string) => api<IdentityList>(`/admin/identity/${ownerType}/${enc(ownerId)}`);

/** Uploads a document; the server encrypts it before storing it. */
export async function uploadIdentity(ownerType: OwnerType, ownerId: string, kind: string, file: File): Promise<IdentityDoc> {
  const form = new FormData();
  form.append('file', file);
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/identity/${ownerType}/${enc(ownerId)}/documents/${enc(kind)}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError('Cannot reach the KeyGo server. Check your internet connection and try again.', 0);
  }
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

/**
 * Opens a document: the server decrypts it and records who opened it. Returns a temporary address for showing it
 * on this page only (revoke it when done).
 */
export async function openIdentity(docId: string): Promise<{ url: string; type: string }> {
  const token = readToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/identity/documents/${enc(docId)}/file`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' });
  } catch {
    throw new ApiError('Cannot reach the KeyGo server. Check your internet connection and try again.', 0);
  }
  if (!res.ok) throw await errorFrom(res);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}

export const reviewIdentity = (docId: string, status: 'Verified' | 'Rejected', reason?: string) =>
  api<IdentityDoc>(`/admin/identity/documents/${enc(docId)}/review`, { method: 'POST', body: { status, reason } });

export const deleteIdentity = (docId: string) => api(`/admin/identity/documents/${enc(docId)}`, { method: 'DELETE' });

export const faceCheck = (customerId: string, result: 'match' | 'no_match', note?: string) =>
  api<{ faceVerification: string }>(`/admin/identity/customer/${enc(customerId)}/face-check`, { method: 'POST', body: { result, note } });

export interface AuditEntry {
  id: string;
  at: string;
  actorId?: string | null;
  actorName: string;
  actorRole?: string | null;
  action: string;
  subjectName?: string | null;
  detail: Record<string, unknown>;
}

export const identityHistory = (ownerType: OwnerType, ownerId: string) => api<AuditEntry[]>(`/admin/identity/${ownerType}/${enc(ownerId)}/history`);

export const openIdentityLink = (ownerType: OwnerType, ownerId: string) =>
  api<{ token: string; url: string; expiresAt: string }>(`/admin/identity/${ownerType}/${enc(ownerId)}/link`, { method: 'POST', body: { baseUrl: window.location.origin } });

export const closeIdentityLink = (ownerType: OwnerType, ownerId: string) => api(`/admin/identity/${ownerType}/${enc(ownerId)}/link`, { method: 'DELETE' });

export const fetchCustomer = (id: string) => api<Customer>(`/admin/customers/${enc(id)}`);

/** Stores the full Aadhaar number (encrypted on the server); the portal keeps only the masked form. */
export const saveAadhaar = (customerId: string, aadhaarNo: string) => api<{ aadhaarNo: string }>(`/admin/customers/${enc(customerId)}/aadhaar`, { method: 'PUT', body: { aadhaarNo } });

// ---------------------------------------------------------------- phone page (no sign-in)

export interface IdentityLinkInfo {
  ownerType: OwnerType;
  firstName: string;
  via: 'staff-phone' | 'customer-link';
  expiresAt: string;
  slots: { kind: string; label: string; photoOnly: boolean; camera: 'user' | 'environment'; status: string; rejectReason?: string }[];
}

export const fetchIdentityLink = (token: string) => api<IdentityLinkInfo>(`/public/id-links/${enc(token)}`, { auth: false });

export async function uploadViaIdentityLink(token: string, kind: string, file: File): Promise<{ kind: string; label: string; status: string }> {
  const form = new FormData();
  form.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/public/id-links/${enc(token)}/documents/${enc(kind)}`, { method: 'POST', body: form });
  } catch {
    throw new ApiError('No internet connection. Check your signal and try again.', 0);
  }
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

/** Labels for audit log actions. */
export const ACTION_LABELS: Record<string, string> = {
  'document.uploaded': 'Uploaded',
  'document.replaced': 'Replaced',
  'document.viewed': 'Opened',
  'document.verified': 'Verified',
  'document.rejected': 'Rejected',
  'document.deleted': 'Deleted',
  'face.match': 'Face check: Match',
  'face.no_match': 'Face check: Not a match',
  'face.reset': 'Face check needed again',
  'licence.details_changed': 'Licence details changed',
  'aadhaar.updated': 'Aadhaar number updated',
  'aadhaar.viewed': 'Full Aadhaar number viewed',
};
