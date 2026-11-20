import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Encryption at rest for identity data (Aadhaar numbers, ID cards, licences, face photos). AES-256-GCM.
 *
 * Keys
 * - DATA_ENCRYPTION_KEY is the current key. Everything new is encrypted with it.
 * - DATA_ENCRYPTION_OLD_KEYS (comma separated) are earlier keys, kept only to read older data. On start-up the
 *   server re-encrypts anything still on an old key with the current one (see EncryptionKeysService).
 * - JWT_ACCESS_SECRET is accepted as an old key, because Aadhaar numbers were encrypted with it before
 *   DATA_ENCRYPTION_KEY existed. Without DATA_ENCRYPTION_KEY it is still the current key (development).
 *
 * Every encrypted value carries the id of the key that made it ("k1.<key id>.…"), so after a restore the server
 * can say exactly which key it needs. The key id is a fingerprint; it does not reveal the key.
 *
 * Files use their own random key each ("envelope encryption"): the file key encrypts the file, and the server
 * key encrypts the file key (stored_files.wrapped_key). Changing the server key only re-encrypts the small file
 * keys, never the files.
 */
interface ServerKey {
  id: string;
  key: Buffer;
}

const fingerprint = (secret: string) => createHash('sha256').update(`keygo-key-id:${secret}`).digest('hex').slice(0, 10);
const toKey = (secret: string): ServerKey => ({ id: fingerprint(secret), key: createHash('sha256').update(secret).digest() });

let cache: { signature: string; current: ServerKey; all: ServerKey[] } | null = null;

function keys() {
  const main = process.env.DATA_ENCRYPTION_KEY?.trim();
  const jwt = process.env.JWT_ACCESS_SECRET?.trim();
  const old = (process.env.DATA_ENCRYPTION_OLD_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean);
  const signature = [main, jwt, ...old].join('\u0000');
  if (cache?.signature === signature) return cache;
  const currentSecret = main || jwt;
  if (!currentSecret) throw new Error('DATA_ENCRYPTION_KEY must be set to store identity data.');
  const current = toKey(currentSecret);
  const all = [current, ...[...old, ...(main && jwt ? [jwt] : [])].map(toKey)].filter((k, i, list) => list.findIndex((x) => x.id === k.id) === i);
  cache = { signature, current, all };
  return cache;
}

/** Fingerprint of the key new data is encrypted with. */
export const currentKeyId = () => keys().current.id;
/** True when the current key is a real DATA_ENCRYPTION_KEY (not the sign-in secret fallback). */
export const hasDedicatedKey = () => !!process.env.DATA_ENCRYPTION_KEY?.trim();

export function encrypt(plain: string): string {
  const { current } = keys();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', current.key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['k1', current.id, ...[iv, cipher.getAuthTag(), data].map((b) => b.toString('base64'))].join('.');
}

function open(key: Buffer, iv: Buffer, tag: Buffer, data: Buffer) {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** The key id an encrypted value was made with ("legacy" for values from before key ids). */
export const keyIdOf = (stored: string) => (stored.startsWith('k1.') ? stored.split('.')[1] : 'legacy');

/** Decrypts with whichever known key made the value; null when no known key can (wrong or missing key). */
export function decrypt(stored: string): string | null {
  const parts = stored.split('.');
  const tagged = parts[0] === 'k1' && parts.length === 5;
  const [iv, tag, data] = (tagged ? parts.slice(2) : parts).map((p) => Buffer.from(p, 'base64'));
  if (!iv || !tag || !data) return null;
  const { all } = keys();
  const candidates = tagged ? all.filter((k) => k.id === parts[1]) : all;
  for (const k of candidates) {
    try {
      return open(k.key, iv, tag, data).toString('utf8');
    } catch {
      // try the next key
    }
  }
  return null;
}

/** Re-encrypts a value with the current key (null when it cannot be read). */
export function reencrypt(stored: string): string | null {
  const plain = decrypt(stored);
  return plain === null ? null : encrypt(plain);
}

// ---------------------------------------------------------------- files

const FILE_MAGIC = Buffer.from('KGE1');

/** Encrypts a file with a fresh key; returns the bytes to store and the wrapped file key. */
export function encryptFile(content: Buffer): { data: Buffer; wrappedKey: string; keyId: string } {
  const fileKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', fileKey, iv);
  const body = Buffer.concat([cipher.update(content), cipher.final()]);
  const wrappedKey = encrypt(fileKey.toString('base64'));
  return { data: Buffer.concat([FILE_MAGIC, iv, cipher.getAuthTag(), body]), wrappedKey, keyId: keyIdOf(wrappedKey) };
}

export class EncryptionKeyError extends Error {}

/** Decrypts a stored file. Throws EncryptionKeyError when the key is missing or the file was altered. */
export function decryptFile(stored: Buffer, wrappedKey: string): Buffer {
  const keyText = decrypt(wrappedKey);
  if (keyText === null) {
    throw new EncryptionKeyError(`This file was encrypted with key ${keyIdOf(wrappedKey)}, which this server does not have.`);
  }
  if (!stored.subarray(0, 4).equals(FILE_MAGIC)) throw new EncryptionKeyError('This file is not a KeyGo encrypted file.');
  try {
    return open(Buffer.from(keyText, 'base64'), stored.subarray(4, 16), stored.subarray(16, 32), stored.subarray(32));
  } catch {
    throw new EncryptionKeyError('This file is damaged or was changed after it was stored.');
  }
}

/** Shown in the apps instead of the full number. */
export const maskAadhaar = (last4: string | null | undefined) => (last4 ? `XXXX-XXXX-${last4}` : '');
