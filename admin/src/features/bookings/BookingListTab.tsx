import { useRouter } from '@/shims/expo-router';
import { Bell, CalendarCheck, Car, CheckCircle2, FileText, IndianRupee, Plus, RotateCcw, Search, Send } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, Column, DataTable, EmptyState, Field, Grid, ListRow, Section, SimulatedNote, StatTile, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { daysBetween, formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Booking } from '../../types';
import { ListPager, usePaged } from '../fleet/ListPager';
import {
    BookingCard,
    CATEGORY_FILTERS,
    CLASS_FILTERS,
    CLASS_TONE,
    makeStyles,
    matchesStatus,
    ReminderIndicator,
    reminderPreview,
    sendReminderLabel,
    STATUS_FILTERS,
    StatusFilter,
    TERM_FILTERS,
} from './shared';

const SORT_KEYS = ['Newest', 'Pickup date', 'Amount', 'Customer'] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORTERS: Record<SortKey, (a: Booking, b: Booking) => number> = {
  Newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'Pickup date': (a, b) => a.pickupDate.localeCompare(b.pickupDate),
  Amount: (a, b) => b.totalAmount - a.totalAmount,
  Customer: (a, b) => a.customerName.localeCompare(b.customerName),
};

export function BookingListTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isDesktop, cols } = useResponsive();
  const { bookings, vehicles, today, messageLog, sendTestMessage } = useApp();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [term, setTerm] = useState<(typeof TERM_FILTERS)[number]>('All');
  const [classification, setClassification] = useState<(typeof CLASS_FILTERS)[number]>('All');
  const [category, setCategory] = useState<(typeof CATEGORY_FILTERS)[number]>('All');
  const [sort, setSort] = useState<SortKey>('Newest');

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const month = today.slice(0, 7);

  const kpis = useMemo(() => {
    const quotes = bookings.filter((b) => b.status === 'Quoted' || b.status === 'Pending');
    const confirmed = bookings.filter((b) => b.status === 'Confirmed');
    const active = bookings.filter((b) => b.status === 'Active');
    const completedThisMonth = bookings.filter(
      (b) => b.status === 'Completed' && (b.completedAt ?? b.returnDate).startsWith(month)
    );
    const revenue = bookings
      .filter((b) => ['Confirmed', 'Active', 'Completed'].includes(b.status) && b.pickupDate.startsWith(month))
      .reduce((s, b) => s + b.totalAmount, 0);
    return {
      quotes: quotes.length,
      quotesValue: quotes.reduce((s, b) => s + b.totalAmount, 0),
      confirmed: confirmed.length,
      active: active.length,
      completed: completedThisMonth.length,
      revenue,
    };
  }, [bookings, month]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = bookings.filter(
      (b) =>
        matchesStatus(b, status) &&
        (term === 'All' || b.term === term) &&
        (classification === 'All' || b.classification === classification) &&
        (category === 'All' || b.vehicleCategory === category) &&
        (!q ||
          [b.id, b.customerName, b.customerPhone, b.vehicleName, b.vehicleNumber, b.pickupLocation].some((s) =>
            s.toLowerCase().includes(q)
          ))
    );
    return [...rows].sort(SORTERS[sort]);
  }, [bookings, query, status, term, classification, category, sort]);
  const paged = usePaged(filtered);

  // Pickups inside the two-day reminder window that have not been reminded yet
  const dueReminders = useMemo(
    () =>
      bookings
        .filter((b) => {
          if (b.status !== 'Confirmed' && b.status !== 'Quoted' && b.status !== 'Pending') return false;
          const d = daysBetween(today, b.pickupDate);
          return d >= 0 && d <= 2;
        })
        .sort((a, b) => (a.pickupDate < b.pickupDate ? -1 : 1)),
    [bookings, today]
  );
  const wasReminded = (b: Booking) => b.reminderSent || messageLog.some((m) => m.preview.includes(b.id));

  const filtersActive = !!query || status !== 'All' || term !== 'All' || classification !== 'All' || category !== 'All';
  const resetFilters = () => {
    setQuery('');
    setStatus('All');
    setTerm('All');
    setClassification('All');
    setCategory('All');
    setSort('Newest');
  };

  const open = (b: Booking) => router.push(`/bookings/${encodeURIComponent(b.id)}` as any);
  const sendReminder = (b: Booking) => {
    const kind = b.status === 'Active' ? 'Return' : 'Pickup';
    sendTestMessage(kind === 'Return' ? 'return' : 'booking', 'WhatsApp', `${b.customerName} · ${b.customerPhone}`, reminderPreview(b));
  };

  const columns: Column<Booking>[] = [
    {
      key: 'id',
      label: 'Booking',
      flex: 0.8,
      minWidth: 70,
      render: (b) => <Text style={styles.cellStrong}>{b.id}</Text>,
    },
    {
      key: 'customer',
      label: 'Customer',
      flex: 1.3,
      minWidth: 100,
      render: (b) => (
        <View>
          <Text style={styles.cellStrong} numberOfLines={1}>
            {b.customerName}
          </Text>
          <Text style={styles.cellSub} numberOfLines={1}>
            {b.customerPhone}
          </Text>
        </View>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.4,
      minWidth: 110,
      render: (b) => (
        <View>
          <Text style={styles.cellStrong} numberOfLines={1}>
            {b.vehicleName}
          </Text>
          <Text style={styles.cellSub} numberOfLines={1}>
            {b.vehicleCategory} · {b.vehicleNumber}
          </Text>
        </View>
      ),
    },
    { key: 'createdAt', label: 'Reserved', flex: 0.8, minWidth: 70, value: (b) => formatDate(b.createdAt, false) },
    {
      key: 'pickup',
      label: 'Pickup',
      flex: 0.9,
      minWidth: 80,
      render: (b) => (
        <View>
          <Text style={styles.cell}>{formatDate(b.pickupDate, false)}</Text>
          <Text style={styles.cellSub}>{b.pickupTime}</Text>
        </View>
      ),
    },
    {
      key: 'return',
      label: 'Return',
      flex: 0.9,
      minWidth: 80,
      render: (b) => (
        <View>
          <Text style={styles.cell}>{formatDate(b.returnDate, false)}</Text>
          <Text style={styles.cellSub}>{b.returnTime}</Text>
        </View>
      ),
    },
    {
      key: 'term',
      label: 'Term',
      flex: 0.7,
      minWidth: 62,
      render: (b) => (
        <View>
          <Text style={styles.cell}>{b.term}</Text>
          <Text style={styles.cellSub}>{b.days}d</Text>
        </View>
      ),
    },
    { key: 'purpose', label: 'Purpose', flex: 0.8, minWidth: 72, value: (b) => b.purpose },
    {
      key: 'class',
      label: 'Type',
      flex: 1,
      minWidth: 90,
      render: (b) => <Badge label={b.classification} tone={CLASS_TONE[b.classification]} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      flex: 0.9,
      minWidth: 76,
      align: 'right',
      render: (b) => <Text style={styles.cellStrong}>{formatINR(b.totalAmount)}</Text>,
    },
    { key: 'status', label: 'Status', flex: 0.9, minWidth: 84, render: (b) => <StatusBadge status={b.status} /> },
    {
      key: 'reminder',
      label: 'Reminder',
      flex: 1.3,
      minWidth: 120,
      render: (b) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ReminderIndicator booking={b} compact />
          {sendReminderLabel(b) ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${sendReminderLabel(b)} to ${b.customerName} (simulated)`}
              onPress={() => sendReminder(b)}
              hitSlop={8}
              style={styles.sendBtn}>
              <Send size={13} color={colors.primaryText} />
            </TouchableOpacity>
          ) : null}
        </View>
      ),
    },
    { key: 'open', label: '', flex: 0.6, minWidth: 90, render: (b) => <Button label="Open" variant="outline" size="sm" onPress={() => open(b)} /> },
  ];

  const empty = (
    <EmptyState
      title={bookings.length === 0 ? 'No bookings yet' : 'No bookings match'}
      message={bookings.length === 0 ? 'Create a quote to start a reservation.' : 'Try a different search or clear the filters.'}
      icon={(c) => <CalendarCheck size={22} color={c} />}
      action={
        filtersActive ? (
          <Button label="Reset filters" variant="outline" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={resetFilters} />
        ) : (
          <Button label="Create booking" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => router.push('/bookings?tab=create-booking' as any)} />
        )
      }
    />
  );

  return (
    <View>
      <Grid cols={cols(2, 3, 5)} style={{ marginTop: 12 }}>
        <StatTile label="Open quotes" value={kpis.quotes} hint={`${formatINRCompact(kpis.quotesValue)} quoted`} tone="info" icon={(c) => <FileText size={16} color={c} />} />
        <StatTile label="Confirmed" value={kpis.confirmed} hint="Awaiting pickup" tone="success" icon={(c) => <CalendarCheck size={16} color={c} />} />
        <StatTile label="Active rentals" value={kpis.active} hint="Currently on rent" tone="violet" icon={(c) => <Car size={16} color={c} />} />
        <StatTile label="Completed this month" value={kpis.completed} hint={formatDate(`${month}-01`).split(' ').slice(1).join(' ')} tone="neutral" icon={(c) => <CheckCircle2 size={16} color={c} />} />
        <StatTile label="Revenue this month" value={formatINRCompact(kpis.revenue)} hint="Confirmed, active & completed pickups" emphasis icon={(c) => <IndianRupee size={16} color={c} />} />
      </Grid>

      <Section title="Two-day pickup reminders" subtitle="Pickups within the next two days" style={{ marginTop: 8 }}>
        <Card style={{ paddingVertical: 4 }}>
          {dueReminders.length === 0 ? (
            <EmptyState compact title="No reminders due" message="Pickups show here two days before their date." icon={(c) => <Bell size={22} color={c} />} />
          ) : (
            dueReminders.map((b, i) => (
              <ListRow
                key={b.id}
                title={`${b.id} · ${b.customerName}`}
                subtitle={`${b.vehicleName} · pickup ${formatDate(b.pickupDate, false)} at ${b.pickupTime}`}
                right={
                  wasReminded(b) ? (
                    <Badge label="Reminder sent" tone="success" />
                  ) : (
                    <Button label="Send" variant="outline" size="sm" icon={(c) => <Send size={14} color={c} />} onPress={() => sendReminder(b)} />
                  )
                }
                style={i === dueReminders.length - 1 ? { borderBottomWidth: 0 } : undefined}
              />
            ))
          )}
        </Card>
      </Section>

      <Card style={{ marginTop: 16, gap: 12 }}>
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Booking ID, customer, phone, vehicle or plate"
          left={<Search size={16} color={colors.muted} />}
          style={{ marginBottom: 0 }}
        />
        <View>
          <Text style={styles.filterLabel}>Status</Text>
          <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll />
        </View>
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
          <View style={isDesktop ? { flex: 0.8 } : undefined}>
            <Text style={styles.filterLabel}>Term</Text>
            <ChipGroup options={TERM_FILTERS} value={term} onChange={setTerm} scroll />
          </View>
          <View style={isDesktop ? { flex: 1 } : undefined}>
            <Text style={styles.filterLabel}>Vehicle category</Text>
            <ChipGroup options={CATEGORY_FILTERS} value={category} onChange={setCategory} scroll />
          </View>
        </View>
        <View>
          <Text style={styles.filterLabel}>Classification</Text>
          <ChipGroup options={CLASS_FILTERS} value={classification} onChange={setClassification} scroll />
        </View>
        <View>
          <Text style={styles.filterLabel}>Sort by</Text>
          <ChipGroup options={SORT_KEYS} value={sort} onChange={setSort} scroll />
        </View>
        <View style={[styles.rowBetween, { alignItems: 'center' }]}>
          <Text style={styles.cardSub}>
            Showing {filtered.length} of {bookings.length} bookings
          </Text>
          {filtersActive ? (
            <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={resetFilters} />
          ) : null}
        </View>
      </Card>

      <Section title="Booking registry" subtitle="Open a booking to see its rental workflow">
        {isDesktop ? (
          <DataTable columns={columns} rows={paged.rows} rowKey={(b) => b.id} empty={empty} />
        ) : filtered.length === 0 ? (
          <Card>{empty}</Card>
        ) : (
          <Grid cols={cols(1, 2, 2)}>
            {paged.rows.map((b) => (
              <BookingCard key={b.id} booking={b} vehicle={vehicleById.get(b.vehicleId)} onPress={() => open(b)} onSendReminder={() => sendReminder(b)} />
            ))}
          </Grid>
        )}
        <ListPager paged={paged} />
        <SimulatedNote>Reminders are scheduled automatically 2 days before pickup. WhatsApp/SMS delivery is simulated in this build.</SimulatedNote>
      </Section>
    </View>
  );
}
