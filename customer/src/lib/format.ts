const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ₹1,23,456 (Indian digit grouping). */
export function formatINR(amount: number, opts: { sign?: boolean } = {}) {
  const abs = Math.round(Math.abs(amount)).toLocaleString('en-IN');
  const sign = amount < 0 ? '−' : opts.sign && amount > 0 ? '+' : '';
  return `${sign}₹${abs}`;
}

/** Compact ₹ for charts and KPI tiles: ₹1.2L, ₹45.3K. */
export function formatINRCompact(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

export function formatKm(km: number) {
  return `${Math.round(km).toLocaleString('en-IN')} km`;
}

/** "2026-09-26" → "26 Sep 2026" (passes through anything that isn't an ISO date). */
export function formatDate(iso: string, withYear = true) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${parseInt(d, 10)} ${MONTHS[parseInt(mo, 10) - 1]}${withYear ? ` ${y}` : ''}`;
}

export function parseISODate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const d = parseISODate(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Whole days from a → b (b later ⇒ positive). */
export function daysBetween(a: string, b: string) {
  const da = parseISODate(a);
  const db = parseISODate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
