import { BadRequestException } from '@nestjs/common';

/**
 * The admin site's address, for links people open (invitations, document upload pages). Taken from the request
 * when it is one of the allowed sites (CORS_ORIGINS), otherwise the https site whose address contains "admin".
 */
export function portalBase(corsOrigins: string | undefined, requested?: string) {
  const allowed = (corsOrigins ?? '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
  const wanted = requested?.trim().replace(/\/$/, '');
  if (wanted && /^https?:\/\//.test(wanted) && (allowed.length === 0 || allowed.includes(wanted))) return wanted;
  const admin = allowed.find((o) => o.startsWith('https://') && o.includes('admin'));
  if (!admin) throw new BadRequestException('Cannot tell which admin site the link should open.');
  return admin;
}
