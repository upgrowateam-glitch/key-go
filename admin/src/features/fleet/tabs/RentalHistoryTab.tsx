import { useRouter } from '@/shims/expo-router';
import { CalendarClock, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Card, ChipGroup, Column, DataTable, EmptyState, Field, Grid, StatTile, StatusBadge } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate, formatINR } from '../../../lib/format';
import { useThemeColors } from '../../../theme';
import { Booking, Vehicle } from '../../../types';
import { ListPager, usePaged } from '../ListPager';

const STATUS_FILTERS = ['All', 'Quoted', 'Confirmed', 'Active', 'Completed', 'Cancelled'] as const;
const SORT_KEYS = ['Latest pickup', 'Oldest pickup', 'Amount'] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORTERS: Record<SortKey, (a: Booking, b: Booking) => number> = {
  'Latest pickup': (a, b) => b.pickupDate.localeCompare(a.pickupDate),
  'Oldest pickup': (a, b) => a.pickupDate.localeCompare(b.pickupDate),
  Amount: (a, b) => b.totalAmount - a.totalAmount,
};

const COLUMNS: Column<Booking>[] = [
  { key: 'id', label: 'Booking', flex: 0.8, minWidth: 90, value: (b) => b.id },
  { key: 'customer', label: 'Customer', flex: 1.4, minWidth: 150, value: (b) => b.customerName },
  { key: 'dates', label: 'Dates', flex: 1.4, minWidth: 160, value: (b) => `${formatDate(b.pickupDate, false)} – ${formatDate(b.returnDate)}` },
  { key: 'days', label: 'Days', flex: 0.5, minWidth: 60, align: 'right', value: (b) => b.days },
  { key: 'amount', label: 'Amount', flex: 0.8, minWidth: 100, align: 'right', value: (b) => formatINR(b.totalAmount) },
  { key: 'status', label: 'Status', flex: 0.9, minWidth: 110, render: (b) => <StatusBadge status={b.status} /> },
];

export function RentalHistoryTab({ v }: { v: Vehicle }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { cols } = useResponsive();
  const { bookings } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [sort, setSort] = useState<SortKey>('Latest pickup');

  const own = useMemo(() => bookings.filter((b) => b.vehicleId === v.id), [bookings, v.id]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return own
      .filter((b) => (status === 'All' || b.status === status) && (!q || `${b.id} ${b.customerName}`.toLowerCase().includes(q)))
      .sort(SORTERS[sort]);
  }, [own, query, status, sort]);
  const paged = usePaged(filtered);

  const earning = own.filter((b) => ['Confirmed', 'Active', 'Completed'].includes(b.status));
  return (
    <View>
      <Grid cols={cols(2, 3, 3)}>
        <StatTile label="Bookings" value={own.length} tone="neutral" icon={(c) => <CalendarClock size={16} color={c} />} />
        <StatTile label="Rented days" value={earning.reduce((s, b) => s + b.days, 0)} tone="info" hint="Confirmed, active & completed" />
        <StatTile label="Booked value" value={formatINR(earning.reduce((s, b) => s + b.totalAmount, 0))} tone="primary" />
      </Grid>
      <Card style={{ gap: 10, marginBottom: 12 }}>
        <Field label="Search" value={query} onChangeText={setQuery} placeholder="Booking ID or customer" left={<Search size={16} color={colors.muted} />} style={{ marginBottom: 0 }} />
        <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll />
        <ChipGroup options={SORT_KEYS} value={sort} onChange={setSort} scroll />
      </Card>
      <DataTable
        columns={COLUMNS}
        rows={paged.rows}
        rowKey={(b) => b.id}
        onRowPress={(b) => router.push(`/bookings/${encodeURIComponent(b.id)}` as any)}
        empty={<EmptyState compact title={own.length ? 'No bookings match' : 'No bookings yet'} message="Bookings for this vehicle will appear here." icon={(c) => <CalendarClock size={22} color={c} />} />}
      />
      <ListPager paged={paged} />
    </View>
  );
}
