import { useRouter } from '@/shims/expo-router';
import { Plus, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, ChipGroup, Column, DataTable, EmptyState, Grid, ListRow, StatTile, StatusBadge } from '../../../components/kit';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate, formatINR } from '../../../lib/format';
import { useThemedStyles } from '../../../theme';
import type { Booking, Customer } from '../../../types';
import { ListPager, usePaged } from '../../fleet/ListPager';
import { makeStyles } from '../shared';

const STATUS_FILTERS = ['All', 'Quoted', 'Confirmed', 'Active', 'Completed', 'Cancelled'] as const;

export function BookingsTab({ customer, history, stats }: { customer: Customer; history: Booking[]; stats: { trips: number; bookings: number; spend: number } }) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone } = useResponsive();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const newBooking = () => router.push('/bookings?tab=create-booking' as any);
  const openBooking = (b: Booking) => router.push(`/bookings/${encodeURIComponent(b.id)}` as any);
  const rows = history.filter((b) => status === 'All' || b.status === status).sort((a, b) => (a.pickupDate < b.pickupDate ? 1 : -1));
  const paged = usePaged(rows);

  const columns: Column<Booking>[] = [
    { key: 'id', label: 'Booking', flex: 0.8, minWidth: 80, render: (b) => <Text style={styles.strong}>{b.id}</Text> },
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.4,
      minWidth: 130,
      render: (b) => (
        <View>
          <Text style={styles.strong} numberOfLines={1}>
            {b.vehicleName}
          </Text>
          <Text style={styles.sub}>{b.vehicleNumber}</Text>
        </View>
      ),
    },
    { key: 'dates', label: 'Dates', flex: 1.3, minWidth: 130, value: (b) => `${formatDate(b.pickupDate, false)} – ${formatDate(b.returnDate)}` },
    { key: 'amount', label: 'Amount', flex: 0.9, minWidth: 90, align: 'right', value: (b) => formatINR(b.totalAmount) },
    { key: 'status', label: 'Status', flex: 0.9, minWidth: 90, render: (b) => <StatusBadge status={b.status} /> },
  ];

  const empty = (
    <EmptyState
      compact
      title={history.length ? 'No bookings match' : 'No bookings yet'}
      message={history.length ? 'Try another status.' : "Create a booking to start this customer's first rental."}
      action={history.length ? undefined : <Button label="Create booking" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={newBooking} />}
    />
  );

  return (
    <View>
      <Grid cols={isPhone ? 2 : 4}>
        <StatTile label="Trips completed" value={stats.trips} tone="success" />
        <StatTile label="Total spend" value={formatINR(stats.spend)} tone="primary" />
        <StatTile label="Loyalty tier" value={customer.loyaltyTier} tone="highlight" icon={(c) => <Star size={14} color={c} />} />
        <StatTile label="Loyalty points" value={customer.loyaltyPoints.toLocaleString('en-IN')} tone="neutral" />
      </Grid>
      <View style={{ marginBottom: 10 }}>
        <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll />
      </View>
      {rows.length === 0 ? (
        <Card>{empty}</Card>
      ) : isPhone ? (
        <Card padded={false} style={{ paddingHorizontal: 14 }}>
          {paged.rows.map((b) => (
            <ListRow
              key={b.id}
              title={`${b.id} · ${b.vehicleName}`}
              subtitle={`${formatDate(b.pickupDate, false)} – ${formatDate(b.returnDate)} · ${formatINR(b.totalAmount)}`}
              right={<StatusBadge status={b.status} />}
              onPress={() => openBooking(b)}
            />
          ))}
        </Card>
      ) : (
        <DataTable columns={columns} rows={paged.rows} rowKey={(b) => b.id} onRowPress={openBooking} />
      )}
      <ListPager paged={paged} />
    </View>
  );
}
