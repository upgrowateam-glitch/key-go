import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encryption at rest for identity numbers (Aadhaar). AES-256-GCM with a key from DATA_ENCRYPTION_KEY,
 * falling back to JWT_ACCESS_SECRET. Keep the key stable: changing it makes stored numbers unreadable.
 */
function key() {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('DATA_ENCRYPTION_KEY or JWT_ACCESS_SECRET must be set to store identity numbers.');
  return createHash('sha256').update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(stored: string): string | null {
  try {
    const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Shown in the apps instead of the full number. */
export const maskAadhaar = (last4: string | null | undefined) => (last4 ? `XXXX-XXXX-${last4}` : '');
