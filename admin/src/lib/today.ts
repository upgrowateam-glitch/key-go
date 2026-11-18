/** Today's calendar date ("2026-11-18") on this computer, used for due dates, overdue checks and new records. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's date when the portal was opened. */
export const TODAY = todayIso();
