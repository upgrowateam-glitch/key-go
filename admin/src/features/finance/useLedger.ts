import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { EXPENSE_CATEGORIES, fetchLedgerExtras, INCOME_CATEGORIES, type LedgerCategory, type LedgerEntry } from '../../services/finance';
import { useResource } from '../../services/mockClient';

/** AppContext entries plus records the finance service holds, so every money figure in the portal agrees. */
export function useLedger() {
  const { financeEntries } = useApp();
  const res = useResource(fetchLedgerExtras);
  const entries = useMemo<LedgerEntry[]>(() => [...(res.data ?? []), ...financeEntries], [res.data, financeEntries]);
  return { entries, extrasLoading: res.loading && !res.data, error: res.error, reload: res.reload };
}

export const sumCategories = (entries: { category: LedgerCategory; amount: number }[], cats: LedgerCategory[]) =>
  entries.filter((e) => cats.includes(e.category)).reduce((s, e) => s + e.amount, 0);

export const totalIncome = (entries: LedgerEntry[]) => sumCategories(entries, INCOME_CATEGORIES);
export const totalExpense = (entries: LedgerEntry[]) => sumCategories(entries, EXPENSE_CATEGORIES);

export const PERIODS = ['This month', 'Last month', 'Last 3 months'] as const;
export type Period = (typeof PERIODS)[number];

/** Month keys (YYYY-MM) covered by each period, relative to the demo date (Sep 2026). */
export const PERIOD_MONTHS: Record<Period, string[]> = {
  'This month': ['2026-09'],
  'Last month': ['2026-08'],
  'Last 3 months': ['2026-07', '2026-08', '2026-09'],
};
export const PERIOD_CAPTION: Record<Period, string> = {
  'This month': 'September 2026 (month to date)',
  'Last month': 'August 2026',
  'Last 3 months': 'July – September 2026',
};
export const TREND_MONTHS = [
  { key: '2026-07', label: 'Jul' },
  { key: '2026-08', label: 'Aug' },
  { key: '2026-09', label: 'Sep' },
];
