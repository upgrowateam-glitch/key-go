/**
 * Indian registration numbers: "KL 13 AB 1234" and the Bharat series "22 BH 1234 AB".
 * Returns the standard spaced form, or null when the number is not valid. The server applies the same rule.
 */
export function normaliseRegistration(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bh = /^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/.exec(s);
  if (bh) return `${bh[1]} BH ${bh[3]} ${bh[4]}`;
  const std = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(s);
  if (std) return [std[1], std[2].padStart(2, '0'), std[3], std[4].padStart(4, '0')].filter(Boolean).join(' ');
  return null;
}
