import { useRouter } from '@/shims/expo-router';
import { CalendarCheck, FileText, IndianRupee, Plus, Search, Send, TriangleAlert, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, Column, ConfirmDialog, DataTable, EmptyState, Field, Grid, SimulatedNote, StatTile, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { findConflicts } from '../../lib/availability';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Booking } from '../../types';
import { ListPager, usePaged } from '../fleet/ListPager';
import { makeStyles } from './shared';

const SORT_KEYS = ['Newest', 'Pickup date', 'Amount'] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORTERS: Record<SortKey, (a: Booking, b: Booking) => number> = {
  Newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'Pickup date': (a, b) => a.pickupDate.localeCompare(b.pickupDate),
  Amount: (a, b) => b.totalAmount - a.totalAmount,
};

export function QuotesTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cols } = useResponsive();
  const { bookings, today, messageLog, confirmBooking, cancelBooking, sendTestMessage } = useApp();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('Pickup date');
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);

  const quotes = useMemo(() => bookings.filter((b) => b.status === 'Quoted' || b.status === 'Pending'), [bookings]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotes.filter((b) => !q || [b.id, b.customerName, b.customerPhone, b.vehicleName, b.vehicleNumber].some((s) => s.toLowerCase().includes(q))).sort(SORTERS[sort]);
  }, [quotes, query, sort]);
  const paged = usePaged(filtered);

  const clashes = (b: Booking) => findConflicts(bookings, b, { excludeBookingId: b.id, today });
  const shared = (b: Booking) => messageLog.some((m) => m.preview.includes(`Quote ${b.id}`));
  const share = (b: Booking) =>
    sendTestMessage(
      'booking',
      'WhatsApp',
      `${b.customerName} · ${b.customerPhone}`,
      `KeyGo: Quote ${b.id} for ${b.vehicleName}, ${formatDate(b.pickupDate, false)} to ${formatDate(b.returnDate, false)}: ${formatINR(b.totalAmount)}`
    );

  const columns: Column<Booking>[] = [
    { key: 'id', label: 'Quote', flex: 0.7, minWidth: 90, render: (b) => <Text style={styles.link} accessibilityRole="link" onPress={() => router.push(`/bookings/${encodeURIComponent(b.id)}` as any)}>{b.id}</Text> },
    {
      key: 'customer',
      label: 'Customer',
      flex: 1.2,
      minWidth: 130,
      render: (b) => (
        <View>
          <Text style={styles.cellStrong} numberOfLines={1}>{b.customerName}</Text>
          <Text style={styles.cellSub} numberOfLines={1}>{b.customerPhone}</Text>
        </View>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.3,
      minWidth: 140,
      render: (b) => (
        <View>
          <Text style={styles.cellStrong} numberOfLines={1}>{b.vehicleName}</Text>
          {clashes(b).length ? <Badge label={`Clashes with ${clashes(b)[0].id}`} tone="danger" icon={(c) => <TriangleAlert size={11} color={c} />} /> : <Text style={styles.cellSub}>{b.vehicleNumber}</Text>}
        </View>
      ),
    },
    {
      key: 'dates',
      label: 'Trip',
      flex: 1.2,
      minWidth: 130,
      render: (b) => (
        <View>
          <Text style={styles.cell}>{formatDate(b.pickupDate, false)} – {formatDate(b.returnDate, false)}</Text>
          <Text style={styles.cellSub}>{b.term} · {b.days}d</Text>
        </View>
      ),
    },
    { key: 'amount', label: 'Total', flex: 0.7, minWidth: 90, align: 'right', render: (b) => <Text style={styles.cellStrong}>{formatINR(b.totalAmount)}</Text> },
    { key: 'status', label: 'Status', flex: 0.7, minWidth: 90, render: (b) => <StatusBadge status={b.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      flex: 1.8,
      minWidth: 280,
      render: (b) => (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Button label="Confirm" size="sm" disabled={clashes(b).length > 0} icon={(c) => <CalendarCheck size={14} color={c} />} onPress={() => setConfirming(b)} />
          <Button label={shared(b) ? 'Sent' : 'Send'} variant="outline" size="sm" icon={(c) => <Send size={14} color={c} />} onPress={() => share(b)} />
          <Button label="Cancel" variant="ghost" size="sm" icon={(c) => <X size={14} color={c} />} onPress={() => setCancelling(b)} />
        </View>
      ),
    },
  ];

  return (
    <View>
      <Grid cols={cols(2, 3, 3)} style={{ marginBottom: 4 }}>
        <StatTile label="Open quotes" value={quotes.length} tone="info" icon={(c) => <FileText size={16} color={c} />} />
        <StatTile label="Quoted value" value={formatINRCompact(quotes.reduce((s, b) => s + b.totalAmount, 0))} tone="primary" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Vehicle clashes" value={quotes.filter((b) => clashes(b).length > 0).length} tone="warning" hint="Cannot be confirmed" icon={(c) => <TriangleAlert size={16} color={c} />} />
      </Grid>
      <Card style={{ gap: 12, marginBottom: 12 }}>
        <Field label="Search" value={query} onChangeText={setQuery} placeholder="Quote ID, customer, phone, vehicle or plate" left={<Search size={16} color={colors.muted} />} style={{ marginBottom: 0 }} />
        <View>
          <Text style={styles.filterLabel}>Sort by</Text>
          <ChipGroup options={SORT_KEYS} value={sort} onChange={setSort} scroll />
        </View>
      </Card>
      <DataTable
        columns={columns}
        rows={paged.rows}
        rowKey={(b) => b.id}
        empty={
          <EmptyState
            title={quotes.length ? 'No quotes match' : 'No open quotes'}
            message={quotes.length ? 'Try a different search.' : 'Generate a quote from Create Booking.'}
            icon={(c) => <FileText size={22} color={c} />}
            action={quotes.length ? undefined : <Button label="Create booking" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => router.push('/bookings?tab=create-booking' as any)} />}
          />
        }
      />
      <ListPager paged={paged} />
      <SimulatedNote>Sending a quote is simulated and only appears in the delivery log. WhatsApp, SMS and PDF generation are pending integration.</SimulatedNote>

      <ConfirmDialog
        visible={confirming !== null}
        title={`Confirm ${confirming?.id ?? ''}?`}
        message={confirming ? `${confirming.vehicleName} will be held for ${confirming.customerName} from ${formatDate(confirming.pickupDate, false)} to ${formatDate(confirming.returnDate)}. A pickup reminder is scheduled for two days before.` : undefined}
        confirmLabel="Confirm booking"
        onConfirm={() => {
          if (confirming) confirmBooking(confirming.id);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        visible={cancelling !== null}
        title={`Cancel ${cancelling?.id ?? ''}?`}
        message="The quote will be marked as cancelled and can no longer be confirmed."
        confirmLabel="Cancel quote"
        danger
        onConfirm={() => {
          if (cancelling) cancelBooking(cancelling.id);
          setCancelling(null);
        }}
        onCancel={() => setCancelling(null)}
      />
    </View>
  );
}
