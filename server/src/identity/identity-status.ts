import type { IdentityDocument, VerificationStatus } from '@prisma/client';
import { isoDate } from '../common/dates';
import { verificationEnum } from '../common/enums';
import { kindLabel } from './identity-kinds';

type Doc = Pick<IdentityDocument, 'kind' | 'status'>;

/**
 * Status of a two-sided paper (ID card, licence) from its documents: the front is required, the back optional.
 * Not uploaded → none; Rejected → any side rejected; Verified → every side verified; otherwise Pending.
 */
export function paperStatus(docs: Doc[], front: string, back: string): VerificationStatus {
  const sides = docs.filter((d) => d.kind === front || d.kind === back);
  if (!sides.length) return 'NOT_UPLOADED';
  if (sides.some((d) => d.status === 'REJECTED')) return 'REJECTED';
  if (sides.some((d) => d.kind === front) && sides.every((d) => d.status === 'VERIFIED')) return 'VERIFIED';
  return 'PENDING';
}

export type KycStatus = 'Verified' | 'Pending' | 'Rejected' | 'Not verified';

/**
 * A customer is Verified when the ID card and the driving licence are verified, the licence has not expired, and
 * staff matched the face with the ID photo. Any rejection makes it Rejected; anything waiting makes it Pending.
 */
export function kycStatus(input: { idCard: VerificationStatus; licence: VerificationStatus; face: VerificationStatus; dlExpiry: Date | null; today: string }): {
  status: KycStatus;
  missing: string[];
} {
  const { idCard, licence, face, dlExpiry, today } = input;
  const missing: string[] = [];
  const expired = !!dlExpiry && isoDate(dlExpiry) < today;
  if (idCard !== 'VERIFIED') missing.push(idCard === 'NOT_UPLOADED' ? 'ID card not uploaded' : idCard === 'REJECTED' ? 'ID card rejected' : 'ID card waiting for review');
  if (licence !== 'VERIFIED') missing.push(licence === 'NOT_UPLOADED' ? 'Driving licence not uploaded' : licence === 'REJECTED' ? 'Driving licence rejected' : 'Driving licence waiting for review');
  if (!dlExpiry) missing.push('Licence expiry date not entered');
  else if (expired) missing.push('Driving licence has expired');
  if (face !== 'VERIFIED') missing.push(face === 'REJECTED' ? 'Face did not match the ID photo' : face === 'PENDING' ? 'Face check waiting for staff' : 'Photo or selfie needed for the face check');
  if (!missing.length) return { status: 'Verified', missing };
  if ([idCard, licence, face].includes('REJECTED')) return { status: 'Rejected', missing };
  if ([idCard, licence, face].includes('PENDING')) return { status: 'Pending', missing };
  return { status: 'Not verified', missing };
}

/** A document as the apps see it (never the file itself). */
export function documentToApi(
  d: IdentityDocument & { file?: { mimeType: string } | null },
  opts: { forCustomer?: boolean } = {},
) {
  return {
    id: d.id,
    kind: d.kind,
    label: kindLabel(d.ownerType, d.kind),
    status: verificationEnum.fromDb(d.status),
    uploadedAt: d.createdAt.toISOString(),
    rejectReason: d.rejectReason ?? undefined,
    ...(opts.forCustomer
      ? {}
      : {
          mimeType: d.file?.mimeType,
          uploadedBy: d.uploadedBy ?? undefined,
          uploadedVia: d.uploadedVia,
          reviewedBy: d.reviewedBy ?? undefined,
          reviewedAt: d.reviewedAt?.toISOString(),
        }),
  };
}
