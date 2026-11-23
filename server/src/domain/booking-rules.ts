/**
 * Level 5 booking rules: booking IDs, how long a quotation stays valid, and when the pickup reminder goes out.
 * Quote validity and the reminder are set by the Owner in Settings → Bookings (settings.bookingRules).
 */

export const SETTING_BOOKING_RULES = 'settings.bookingRules';

export interface BookingRules {
  /** How long a quotation can be confirmed after it is made, in hours. */
  quoteValidHours: number;
  reminder: {
    enabled: boolean;
    /** Days before the pickup day. */
    daysBefore: number;
    /** Time of day the reminder goes out, "HH:MM" (24 h, India time). */
    time: string;
    /** Also send it by WhatsApp when KeyGo's number is linked. */
    whatsapp: boolean;
  };
}

export const DEFAULT_BOOKING_RULES: BookingRules = {
  quoteValidHours: 48,
  reminder: { enabled: true, daysBefore: 2, time: '09:00', whatsapp: true },
};

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
};

/** The saved rules, checked and completed with the defaults. */
export function bookingRules(saved: unknown): BookingRules {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const r = (s.reminder && typeof s.reminder === 'object' ? s.reminder : {}) as Record<string, unknown>;
  const d = DEFAULT_BOOKING_RULES;
  return {
    quoteValidHours: num(s.quoteValidHours, 1, 24 * 30, d.quoteValidHours),
    reminder: {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : d.reminder.enabled,
      daysBefore: num(r.daysBefore, 1, 14, d.reminder.daysBefore),
      time: typeof r.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : d.reminder.time,
      whatsapp: typeof r.whatsapp === 'boolean' ? r.whatsapp : d.reminder.whatsapp,
    },
  };
}

/** "YYYY-MM-DD" of a moment, in India time. */
export const istDate = (at: Date) => new Date(at.getTime() + 330 * 60000).toISOString().slice(0, 10);

/** A moment from an India-time date and "HH:MM". */
export const istAt = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:30`);

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * When the pickup reminder for a booking is due (a real moment): N days before the pickup day, at the set time in
 * India. Booking times are stored as India wall-clock times, so the pickup day is the stored date itself.
 */
export function reminderDueAt(pickupAt: Date, rules: BookingRules): Date {
  return istAt(addDays(pickupAt.toISOString().slice(0, 10), -rules.reminder.daysBefore), rules.reminder.time);
}

/** The current India wall-clock time, in the same form as stored booking times (for comparing with them). */
export const wallNow = () => new Date(Date.now() + 330 * 60000);

/** Until when a quotation made now can be confirmed. */
export const quoteValidUntil = (from: Date, rules: BookingRules) => new Date(from.getTime() + rules.quoteValidHours * 3600_000);

// ---------------------------------------------------------------- booking IDs

/** Booking IDs: KG + year, month and day the booking is made (India time) + that day's count. KG26112301, KG26112302, … */
export const BOOKING_ID_RE = /^KG(\d{6})(\d{2,})$/;

export function bookingIdPrefix(at: Date) {
  const [y, m, d] = istDate(at).split('-');
  return `KG${y.slice(2)}${m}${d}`;
}

/** The next ID for the day, given the IDs already used that day (2 digits, 3 after the 99th booking). */
export function nextBookingId(prefix: string, usedIds: string[]) {
  const last = usedIds.reduce((max, id) => {
    const hit = BOOKING_ID_RE.exec(id);
    return hit && `KG${hit[1]}` === prefix ? Math.max(max, Number(hit[2])) : max;
  }, 0);
  return `${prefix}${String(last + 1).padStart(2, '0')}`;
}
