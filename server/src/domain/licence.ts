import { BadRequestException } from '@nestjs/common';

/** Indian state and union territory codes used at the start of driving licence numbers. */
export const DL_STATE_CODES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CH: 'Chandigarh',
  CG: 'Chhattisgarh',
  CT: 'Chhattisgarh',
  DD: 'Dadra and Nagar Haveli and Daman and Diu',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi',
  GA: 'Goa',
  GJ: 'Gujarat',
  HR: 'Haryana',
  HP: 'Himachal Pradesh',
  JK: 'Jammu and Kashmir',
  JH: 'Jharkhand',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MP: 'Madhya Pradesh',
  MH: 'Maharashtra',
  MN: 'Manipur',
  ML: 'Meghalaya',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  OR: 'Odisha',
  PY: 'Puducherry',
  PB: 'Punjab',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
  TG: 'Telangana',
  TR: 'Tripura',
  UP: 'Uttar Pradesh',
  UK: 'Uttarakhand',
  UA: 'Uttarakhand',
  WB: 'West Bengal',
};

/**
 * Indian driving licence numbers (Sarathi format): state code, 2-digit RTO, 4-digit year of issue and a 7-digit
 * number, e.g. "KL13 20110012345". Spaces and dashes are ignored. Returns the number in that form and the state.
 */
export function normaliseLicence(raw: unknown): { number: string; state: string } {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{2})(\d{2})(\d{4})(\d{7})$/.exec(s);
  const state = m && DL_STATE_CODES[m[1]];
  if (!m || !state) throw new BadRequestException('Enter a valid driving licence number, e.g. KL13 20110012345 (state code, RTO, year, 7 digits).');
  const year = Number(m[3]);
  if (year < 1950 || year > new Date().getFullYear()) throw new BadRequestException(`The licence number says it was issued in ${m[3]}. Check the number.`);
  return { number: `${m[1]}${m[2]} ${m[3]}${m[4]}`, state };
}
