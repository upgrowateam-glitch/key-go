/** Indian state codes at the start of driving licence numbers (same list as the server). */
export const DL_STATE_CODES: Record<string, string> = {
  AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar', CH: 'Chandigarh',
  CG: 'Chhattisgarh', CT: 'Chhattisgarh', DD: 'Dadra and Nagar Haveli and Daman and Diu', DN: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana', HP: 'Himachal Pradesh', JK: 'Jammu and Kashmir', JH: 'Jharkhand', KA: 'Karnataka',
  KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep', MP: 'Madhya Pradesh', MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram',
  NL: 'Nagaland', OD: 'Odisha', OR: 'Odisha', PY: 'Puducherry', PB: 'Punjab', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu',
  TS: 'Telangana', TG: 'Telangana', TR: 'Tripura', UP: 'Uttar Pradesh', UK: 'Uttarakhand', UA: 'Uttarakhand', WB: 'West Bengal',
};

/**
 * Checks an Indian driving licence number: state code, RTO (2 digits), year of issue (4 digits), 7 digits.
 * Returns the standard form ("KL13 20110012345") and the state, or an error to show.
 */
export function checkLicence(raw: string): { number: string; state: string } | { error: string } {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{2})(\d{2})(\d{4})(\d{7})$/.exec(s);
  if (!m || !DL_STATE_CODES[m[1]]) return { error: 'Use the format KL13 20110012345 (state code, RTO, year, 7 digits)' };
  const year = Number(m[3]);
  if (year < 1950 || year > new Date().getFullYear()) return { error: `The number says it was issued in ${m[3]}. Check it.` };
  return { number: `${m[1]}${m[2]} ${m[3]}${m[4]}`, state: DL_STATE_CODES[m[1]] };
}
