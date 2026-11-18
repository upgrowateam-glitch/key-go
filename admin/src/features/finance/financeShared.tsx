import { useRouter } from '@/shims/expo-router';
import { RotateCcw, Trash2, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, ChipGroup, DataTable, EmptyState, SegmentedControl, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR } from '../../lib/format';
import type { LedgerCategory, LedgerEntry } from '../../services/finance';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, usePaged } from './tableTools';
import { PERIOD_CAPTION, PERIODS, type Period } from './useLedger';

export function PeriodBar({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const styles = useThemedStyles(makeStyles);
  const { isPhone } = useResponsive();
  return (
    <View style={[styles.filterRow, isPhone && { flexDirection: 'column', alignItems: 'stretch' }]}>
      <SegmentedControl options={PERIODS} value={period} onChange={onChange} style={isPhone ? undefined : { minWidth: 380 }} />
      <Text style={styles.caption}>{PERIOD_CAPTION[period]}</Text>
    </View>
  );
}

export function useVehicleLabel() {
  const { vehicles } = useApp();
  return (id?: string) => {
    if (!id) return 'Fleet-wide';
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.name} · ${v.vehicleNumber}` : id;
  };
}

const SORTS = ['Newest', 'Oldest', 'Largest'] as const;
type Sort = (typeof SORTS)[number];

/** Searchable, sortable and paged ledger; every finance tab that lists entries uses it. */
export function LedgerTable({
  entries,
  categories,
  filename,
  emptyLabel = 'transactions',
  onDelete,
}: {
  entries: LedgerEntry[];
  categories: LedgerCategory[];
  filename: string;
  emptyLabel?: string;
  onDelete?: (entry: LedgerEntry) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone } = useResponsive();
  const vehicleLabel = useVehicleLabel();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | LedgerCategory>('All');
  const [sort, setSort] = useState<Sort>('Newest');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => category === 'All' || e.category === category)
      .filter((e) => !q || `${e.reference} ${e.category} ${vehicleLabel(e.vehicleId)} ${e.id}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === 'Largest' ? b.amount - a.amount : sort === 'Oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    // vehicleLabel closes over vehicles, which rarely change while this table is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, category, query, sort]);
  const paged = usePaged(rows);

  const txnIn = rows.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0);
  const txnOut = rows.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0);
  const filtered = category !== 'All' || !!query.trim();
  const reset = () => {
    setCategory('All');
    setQuery('');
  };

  const columns: Column<LedgerEntry>[] = [
    { key: 'date', label: 'Date', minWidth: 110, flex: 0.9, value: (r) => formatDate(r.date) },
    { key: 'category', label: 'Category', minWidth: 130, flex: 1.1, value: (r) => r.category },
    {
      key: 'direction',
      label: 'Type',
      minWidth: 100,
      flex: 0.8,
      render: (r) => <Badge label={r.direction === 'in' ? 'Income' : 'Expense'} tone={r.direction === 'in' ? 'success' : 'neutral'} />,
    },
    { key: 'vehicle', label: 'Vehicle', minWidth: 180, flex: 1.6, value: (r) => vehicleLabel(r.vehicleId) },
    { key: 'reference', label: 'Reference', minWidth: 170, flex: 1.5, value: (r) => r.reference },
    {
      key: 'amount',
      label: 'Amount',
      minWidth: 120,
      flex: 1,
      align: 'right',
      render: (r) => (
        <Text style={[styles.amount, r.direction === 'in' && { color: colors.success }]}>
          {r.direction === 'in' ? '+' : '−'}
          {formatINR(r.amount)}
        </Text>
      ),
    },
    ...(onDelete
      ? [
          {
            key: 'remove',
            label: '',
            minWidth: 60,
            flex: 0.4,
            align: 'center',
            render: (r) =>
              r.session ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${r.reference}`} onPress={() => onDelete(r)}>
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              ) : null,
          } as Column<LedgerEntry>,
        ]
      : []),
  ];

  const bookingOf = (e: LedgerEntry) => e.reference.match(/KG-\d+/)?.[0];

  return (
    <View>
      <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Reference, vehicle or category" />}>
        <FilterGroup label="Sort by">
          <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
        </FilterGroup>
        <CsvButton
          data={() => ({
            filename,
            headers: ['Date', 'Category', 'Type', 'Vehicle', 'Reference', 'Amount (INR)'],
            rows: rows.map((r) => [r.date, r.category, r.direction === 'in' ? 'Income' : 'Expense', vehicleLabel(r.vehicleId), r.reference, r.amount]),
          })}
        />
        {filtered ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
      </ListToolbar>
      {categories.length > 1 ? (
        <View style={{ marginBottom: 12 }}>
          <ChipGroup options={['All', ...categories] as ('All' | LedgerCategory)[]} value={category} onChange={setCategory} scroll={isPhone} />
        </View>
      ) : null}
      <Text style={[styles.caption, { marginBottom: 8 }]}>
        {rows.length} entries · in {formatINR(txnIn)} · out {formatINR(txnOut)}
      </Text>
      <DataTable
        columns={columns}
        rows={paged.pageRows}
        rowKey={(r) => r.id}
        onRowPress={(r) => {
          const b = bookingOf(r);
          if (b) router.push(`/bookings/${encodeURIComponent(b)}`);
        }}
        empty={
          <EmptyState
            compact
            title={`No ${emptyLabel}`}
            message={filtered ? 'Nothing matches these filters.' : 'Nothing recorded in this period.'}
            icon={(c) => <Wallet size={22} color={c} />}
            action={filtered ? <Button label="Clear filters" variant="outline" size="sm" onPress={reset} /> : undefined}
          />
        }
      />
      <Pager paged={paged} />
    </View>
  );
}

export const makeFinanceStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cardTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    cardSub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    cellStrong: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      backgroundColor: colors.warmSoft,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    noticeText: {
      flex: 1,
      color: colors.warmText,
      fontSize: 12,
      fontWeight: '600',
    },
    formError: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
    label: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
    },
  });

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      marginBottom: 16,
    },
    caption: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '600',
    },
    amount: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'right',
    },
  });
