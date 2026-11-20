import { API_URL, ApiError, api, errorFrom } from '../lib/api';

const enc = encodeURIComponent;

/** Staff: open a 30-minute phone link (shown as a QR code) for one car's photos. */
export const openPhotoLink = (vehicleId: string) => api<{ token: string; expiresAt: string }>(`/admin/vehicles/${enc(vehicleId)}/photo-link`, { method: 'POST' });

/** Staff: whether the link is still open, and the car's photos as the server has them now. */
export const photoLinkStatus = (vehicleId: string) =>
  api<{ open: boolean; photos: Record<string, string>; mainPhoto?: string }>(`/admin/vehicles/${enc(vehicleId)}/photo-link`);

/** Staff: close the link so the QR code stops working. */
export const closePhotoLink = (vehicleId: string) => api(`/admin/vehicles/${enc(vehicleId)}/photo-link`, { method: 'DELETE' });

/** The address the QR code opens on the phone. */
export const photoLinkUrl = (token: string) => `${window.location.origin}/photo-upload?token=${enc(token)}`;

export interface PhotoLinkInfo {
  vehicleId: string;
  name: string;
  code?: string;
  vehicleNumber?: string;
  expiresAt: string;
  slots: { slot: string; label: string; fileId: string | null }[];
}

/** Phone page: the car and its photo positions (no sign-in; the token is the permission). */
export const fetchPhotoLink = (token: string) => api<PhotoLinkInfo>(`/public/photo-links/${enc(token)}`, { auth: false });

/** Phone page: upload one photo into a position of the car. */
export async function uploadViaPhotoLink(token: string, slot: string, file: File): Promise<{ slot: string; label: string; fileId: string }> {
  const form = new FormData();
  form.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/public/photo-links/${enc(token)}/photos/${enc(slot)}`, { method: 'POST', body: form });
  } catch {
    throw new ApiError('No internet connection. Check your signal and try again.', 0);
  }
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}
