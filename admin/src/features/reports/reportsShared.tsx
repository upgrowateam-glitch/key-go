import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarRange, FileDown, FileSpreadsheet, IndianRupee, RotateCcw, Route, TrendingDown, TrendingUp } from 'lucide-react-native';
import { BarChart, Button, Card, ChipGroup, Grid, SegmentedControl, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { addDays, formatDate, formatINRCompact } from '../../lib/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type LedgerCategory, type LedgerEntry } from '../../services/finance';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking, FASTagLog, MaintenanceRecord, Vehicle } from '../../types';
import { downloadCsv, type CsvData } from '../finance/tableTools';
import { sumCategories, TREND_MONTHS, useLedger } from '../finance/useLedger';

export const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;
export type ReportPeriod = (typeof PERIODS)[number];
const CATEGORIES = ['All', 'SUV', 'Sedan', 'Electric', 'Luxury'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

export interface Bucket {
  label: string;
  /** Full label for table rows, where there is always room. */
  longLabel: string;
  start: string;
  end: string;
}

/** Trend buckets ending on the demo "today". */
function buildBuckets(period: ReportPeriod, today: string, short: boolean): Bucket[] {
  if (period === 'Daily') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return { label: short ? String(parseInt(d.slice(8), 10)) : formatDate(d, false), longLabel: formatDate(d), start: d, end: d };
    });
  }
  if (period === 'Weekly') {
    return Array.from({ length: 4 }, (_, i) => {
      const end = addDays(today, -7 * (3 - i));
      const start = addDays(end, -6);
      return { label: short ? `W${i + 1}` : `${formatDate(start, false)}–${parseInt(end.slice(8), 10)}`, longLabel: `${formatDate(start, false)} – ${formatDate(end, false)}`, start, end };
    });
  }
  return TREND_MONTHS.map((m) => ({ label: m.label, longLabel: `${m.label} 2026`, start: `${m.key}-01`, end: `${m.key}-31` }));
}

export const inRange = (iso: string, start: string, end: string) => {
  const d = iso.slice(0, 10);
  return d >= start && d <= end;
};
export const sumAmount = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
export const countsAsTrip = (b: Booking) => b.status !== 'Cancelled' && b.status !== 'Quoted' && b.status !== 'Pending';

export interface Trend {
  income: number[];
  expense: number[];
  rental: number[];
  fines: number[];
}

interface ReportsValue {
  period: ReportPeriod;
  setPeriod: (p: ReportPeriod) => void;
  category: CategoryFilter;
  setCategory: (c: CategoryFilter) => void;
  vehicleId: string;
  setVehicleId: (id: string) => void;
  buckets: Bucket[];
  windowLabel: string;
  scopedVehicles: Vehicle[];
  vehicleByNumber: Map<string, Vehicle>;
  allFinance: LedgerEntry[];
  scopedFinance: LedgerEntry[];
  windowFinance: LedgerEntry[];
  windowBookings: Booking[];
  scopedBookings: Booking[];
  windowMaintenance: MaintenanceRecord[];
  windowTolls: FASTagLog[];
  trend: Trend;
  ready: boolean;
  error?: string;
  reload: () => void;
}

const ReportsContext = createContext<ReportsValue | undefined>(undefined);

/** Sits above the tabs, so filters carry over when the user moves between reports. */
export function ReportsProvider({ children }: { children: ReactNode }) {
  const { isPhone } = useResponsive();
  const { vehicles, bookings, maintenanceLogs, fastagLogs, today } = useApp();
  const { entries, extrasLoading, error, reload } = useLedger();
  const [period, setPeriod] = useState<ReportPeriod>('Monthly');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [vehicleId, setVehicleId] = useState('');

  const buckets = useMemo(() => buildBuckets(period, today, isPhone), [period, today, isPhone]);
  const windowStart = buckets[0].start;
  const windowEnd = buckets[buckets.length - 1].end;
  const windowLabel = period === 'Monthly' ? 'July – September 2026' : `${formatDate(windowStart, windowStart.slice(0, 4) !== windowEnd.slice(0, 4))} – ${formatDate(windowEnd)}`;

  const scopedVehicles = useMemo(() => vehicles.filter((v) => category === 'All' || v.type === category), [vehicles, category]);
  const scopedIds = useMemo(() => new Set(scopedVehicles.map((v) => v.id)), [scopedVehicles]);
  const vehicleByNumber = useMemo(() => new Map(vehicles.map((v) => [v.vehicleNumber, v])), [vehicles]);

  const scopedFinance = useMemo(() => entries.filter((e) => (category === 'All' ? true : !!e.vehicleId && scopedIds.has(e.vehicleId))), [entries, category, scopedIds]);
  const windowFinance = useMemo(() => scopedFinance.filter((e) => inRange(e.date, windowStart, windowEnd)), [scopedFinance, windowStart, windowEnd]);
  const scopedBookings = useMemo(() => bookings.filter((b) => countsAsTrip(b) && scopedIds.has(b.vehicleId)), [bookings, scopedIds]);
  const windowBookings = useMemo(() => scopedBookings.filter((b) => inRange(b.pickupDate, windowStart, windowEnd)), [scopedBookings, windowStart, windowEnd]);
  const windowMaintenance = useMemo(() => maintenanceLogs.filter((m) => scopedIds.has(m.vehicleId) && inRange(m.date, windowStart, windowEnd)), [maintenanceLogs, scopedIds, windowStart, windowEnd]);
  const windowTolls = useMemo(
    () =>
      fastagLogs.filter((l) => {
        const v = vehicleByNumber.get(l.vehicleNumber);
        return (category === 'All' || (!!v && scopedIds.has(v.id))) && inRange(l.dateTime, windowStart, windowEnd);
      }),
    [fastagLogs, vehicleByNumber, category, scopedIds, windowStart, windowEnd]
  );

  const trend = useMemo<Trend>(() => {
    const at = (b: Bucket) => scopedFinance.filter((e) => inRange(e.date, b.start, b.end));
    return {
      income: buckets.map((b) => sumCategories(at(b), INCOME_CATEGORIES)),
      expense: buckets.map((b) => sumCategories(at(b), EXPENSE_CATEGORIES)),
      rental: buckets.map((b) => sumCategories(at(b), ['Rental income'])),
      fines: buckets.map((b) => sumCategories(at(b), ['Fine collection'])),
    };
  }, [scopedFinance, buckets]);

  return (
    <ReportsContext.Provider
      value={{
        period,
        setPeriod,
        category,
        setCategory,
        vehicleId,
        setVehicleId,
        buckets,
        windowLabel,
        scopedVehicles,
        vehicleByNumber,
        allFinance: entries,
        scopedFinance,
        windowFinance,
        windowBookings,
        scopedBookings,
        windowMaintenance,
        windowTolls,
        trend,
        ready: !extrasLoading && !error,
        error,
        reload,
      }}>
      {children}
    </ReportsContext.Provider>
  );
}

export function useReports() {
  const value = useContext(ReportsContext);
  if (!value) throw new Error('useReports must be used within a ReportsProvider');
  return value;
}

/** Filters, headline figures, trend chart and export buttons shared by every report tab. */
export function ReportFrame({ name, csv, children }: { name: string; csv: () => CsvData; children: ReactNode }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeReportStyles);
  const { cols, isPhone } = useResponsive();
  const { showToast } = useApp();
  const r = useReports();

  if (!r.ready) return <ResourceState loading={!r.error} error={r.error} onRetry={r.reload} />;

  const totalIn = sumCategories(r.windowFinance, INCOME_CATEGORIES);
  const totalOut = sumCategories(r.windowFinance, EXPENSE_CATEGORIES);
  const net = totalIn - totalOut;
  const isDefault = r.period === 'Monthly' && r.category === 'All';

  return (
    <View>
      <Card style={{ marginTop: 8 }}>
        <View style={[styles.filters, isPhone && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ gap: 6, minWidth: isPhone ? undefined : 280 }}>
            <Text style={styles.filterLabel}>Period</Text>
            <SegmentedControl options={PERIODS} value={r.period} onChange={r.setPeriod} />
          </View>
          <View style={{ gap: 6, flex: 1 }}>
            <Text style={styles.filterLabel}>Vehicle category</Text>
            <ChipGroup options={CATEGORIES} value={r.category} onChange={r.setCategory} scroll={isPhone} />
          </View>
          <Button
            label="Reset"
            variant="ghost"
            size="sm"
            disabled={isDefault}
            icon={(c) => <RotateCcw size={14} color={c} />}
            onPress={() => {
              r.setPeriod('Monthly');
              r.setCategory('All');
            }}
            accessibilityHint="Reset period and category filters"
          />
        </View>
        <View style={styles.windowRow}>
          <CalendarRange size={14} color={colors.muted} />
          <Text style={[styles.muted, { flex: 1 }]}>
            Reporting window: {r.windowLabel}
            {r.category !== 'All' ? ` · ${r.category} vehicles only (fleet-wide costs such as salaries are excluded)` : ''}
          </Text>
          <Button label="CSV" variant="outline" size="sm" icon={(c) => <FileSpreadsheet size={16} color={c} />} onPress={() => downloadCsv(csv())} accessibilityHint={`Download the ${name} report as a CSV file`} />
          <Button label="PDF (simulated)" variant="outline" size="sm" icon={(c) => <FileDown size={16} color={c} />} onPress={() => showToast(`${name} report PDF is simulated, no file was created. Use CSV for a real download.`)} />
        </View>
      </Card>

      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 16 }}>
        <StatTile label="Income" value={formatINRCompact(totalIn)} hint="Rentals + fines" tone="success" icon={(c) => <TrendingUp size={16} color={c} />} />
        <StatTile label="Expenses" value={formatINRCompact(totalOut)} hint="All cost categories" tone="warm" icon={(c) => <TrendingDown size={16} color={c} />} />
        <StatTile label="Trips" value={r.windowBookings.length} hint={`${r.windowBookings.reduce((s, b) => s + b.days, 0)} rental days`} tone="info" icon={(c) => <Route size={16} color={c} />} />
        <StatTile label={net < 0 ? 'Net loss' : 'Net profit'} value={formatINRCompact(net)} hint={net < 0 ? 'Expenses exceed income' : 'Income minus expenses'} emphasis icon={(c) => <IndianRupee size={16} color={c} />} />
      </Grid>

      <Card style={{ marginBottom: 20 }}>
        <Text style={styles.cardTitle}>Income vs expense trend</Text>
        <Text style={styles.muted}>{r.period === 'Daily' ? 'Last 7 days of September 2026' : r.period === 'Weekly' ? 'Last 4 weeks (7-day periods ending 26 Sep)' : 'Monthly, July – September 2026'}</Text>
        <View style={{ marginTop: 14 }}>
          <BarChart
            labels={r.buckets.map((b) => b.label)}
            series={[
              { name: 'Income', values: r.trend.income, color: colors.chart[0] },
              { name: 'Expense', values: r.trend.expense, color: colors.chart[2] },
            ]}
            height={180}
            formatValue={formatINRCompact}
          />
        </View>
        {isPhone && r.period === 'Weekly' ? <Text style={[styles.muted, { marginTop: 8 }]}>{r.buckets.map((b, i) => `W${i + 1}: ${formatDate(b.start, false)}–${formatDate(b.end, false)}`).join(' · ')}</Text> : null}
        {r.trend.income.every((v) => v === 0) && r.trend.expense.every((v) => v === 0) ? <Text style={[styles.muted, { marginTop: 8 }]}>No entries in this window for the selected filters.</Text> : null}
      </Card>

      {children}
    </View>
  );
}

export const incomeCategories: LedgerCategory[] = INCOME_CATEGORIES;
export const expenseCategories: LedgerCategory[] = EXPENSE_CATEGORIES;

export const makeReportStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    filters: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 16,
    },
    filterLabel: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
    },
    windowRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    cardTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    muted: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
      flexShrink: 1,
    },
    cellStrong: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    thumb: {
      width: 96,
      height: 60,
      borderRadius: 10,
      backgroundColor: colors.bg2,
      padding: 4,
    },
  });
