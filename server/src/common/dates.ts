/**
 * The apps work with calendar dates ("2026-09-26") and clock times ("10:00 AM"). Booking times are stored
 * as wall-clock timestamps (no time zone), which is all the overlap rule needs.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (value: unknown): value is string => typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

/** "2026-09-26" → Date at 00:00 UTC, for DATE columns. Returns null for empty or invalid input. */
export function dateOnly(value: unknown): Date | null {
  return isIsoDate(value) ? new Date(`${value}T00:00:00.000Z`) : null;
}

/** Date → "2026-09-26". */
export const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

/** "10:00 AM", "6:30 pm" or "18:30" → [hours, minutes]. Defaults to 10:00. */
export function parseClock(value: unknown): [number, number] {
  const m = typeof value === 'string' ? /^\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?\s*$/.exec(value) : null;
  if (!m) return [10, 0];
  let h = Number(m[1]) % 24;
  const min = Math.min(59, Number(m[2] ?? 0));
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && h < 12) h += 12;
  if (meridiem === 'AM' && h === 12) h = 0;
  return [h, min];
}

/** Calendar date plus clock time → wall-clock timestamp. */
export function dateTime(date: unknown, time: unknown): Date | null {
  if (!isIsoDate(date)) return null;
  const [h, m] = parseClock(time);
  return new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
}

/** Wall-clock timestamp → "10:00 AM". */
export function clockLabel(d: Date) {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Whole days from one calendar date to another. */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export const addDays = (iso: string, days: number) => isoDate(new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * 86_400_000));

/** Today's calendar date in India. */
export const todayIst = () => isoDate(new Date(Date.now() + 5.5 * 3_600_000));
