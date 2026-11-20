import { BadRequestException } from '@nestjs/common';

/**
 * Indian registration numbers: "KL 13 AB 1234" (state, RTO code, series, number) and the Bharat series
 * "22 BH 1234 AB". Returns the number in a standard spaced form, or throws a readable error.
 */
export function normaliseRegistration(raw: unknown): string {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bh = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/.exec(s);
  if (bh) return `${bh[1]} BH ${bh[3]} ${bh[4]}`;
  const std = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(s);
  if (std) return [std[1], std[2].padStart(2, '0'), std[3], std[4].padStart(4, '0')].filter(Boolean).join(' ');
  throw new BadRequestException('Enter a valid vehicle number, e.g. KL 13 AB 1234 (or 22 BH 1234 AB).');
}

/** Readable fleet code shown everywhere: KG-V-0001, KG-V-0002, … */
export const vehicleCode = (n: number) => `KG-V-${String(n).padStart(4, '0')}`;
export const codeNumber = (code: unknown) => {
  const m = /^KG-V-(\d+)$/.exec(String(code ?? ''));
  return m ? Number(m[1]) : 0;
};

/** Photo positions staff can upload for a car; "front" is shown to customers unless another is chosen. */
export const PHOTO_SLOTS = ['main', 'front', 'back', 'left', 'right', 'interior', 'dashboard'] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
