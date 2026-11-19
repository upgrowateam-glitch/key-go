import { createHash, randomBytes } from 'node:crypto';

/** How long an invitation link works. */
export const INVITE_DAYS = 7;

/** Only the hash of an invitation is stored, so a database copy cannot be used to accept invitations. */
export const hashInvite = (token: string) => createHash('sha256').update(token).digest('hex');

/** A new one-time invitation: the token goes in the link, the hash and expiry go in the database. */
export function newInvite() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashInvite(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) };
}

/** A password nobody knows, for accounts that are waiting for their invitation to be accepted. */
export const unusablePassword = () => randomBytes(32).toString('hex');
