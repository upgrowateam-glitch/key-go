import { useRouter } from '@/shims/expo-router';
import { Link2, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, DataTable, EmptyState, Grid, ListRow, Section, SegmentedControl, StatTile, StatusBadge, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate } from '../../lib/format';
import { useThemedStyles, type ThemeColors } from '../../theme';
import type { DriverAssignment } from '../../types';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, usePaged } from '../finance/tableTools';
import { AssignDriverSheet, useAssignableBookings } from './AssignDriverSheet';

const STATUS = ['All', 'Upcoming', 'In progress', 'Completed'] as const;
const SORTS = ['Newest', 'Oldest'] as const;

interface Row extends DriverAssignment {
  driverName: string;
  customerName: string;
}

export default function DriverAssignmentsTab() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cols } = useResponsive();
  const { drivers, bookings } = useApp();
  const unassigned = useAssignableBookings();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<(typeof STATUS)[number]>('All');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Newest');
  const [assign, setAssign] = useState<{ bookingId?: string } | null>(null);

  const all = useMemo<Row[]>(
    () => drivers.flatMap((d) => d.assignments.map((a) => ({ ...a, driverName: d.name, customerName: bookings.find((b) => b.id === a.bookingId)?.customerName ?? '—' }))),
    [drivers, bookings]
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((a) => status === 'All' || a.status === status)
      .filter((a) => !q || `${a.bookingId} ${a.vehicleNumber} ${a.driverName} ${a.customerName}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === 'Oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [all, status, query, sort]);
  const paged = usePaged(rows);

  const filtered = !!query.trim() || status !== 'All';
  const reset = () => {
    setQuery('');
    setStatus('All');
  };

  const columns: Column<Row>[] = [
    { key: 'date', label: 'Date', minWidth: 110, flex: 0.8, value: (a) => formatDate(a.date) },
    { key: 'driver', label: 'Driver', minWidth: 150, flex: 1.2, render: (a) => <Text style={styles.strong}>{a.driverName}</Text> },
    { key: 'booking', label: 'Booking', minWidth: 110, flex: 0.8, value: (a) => a.bookingId },
    { key: 'customer', label: 'Customer', minWidth: 150, flex: 1.2, value: (a) => a.customerName },
    { key: 'vehicle', label: 'Vehicle', minWidth: 140, flex: 1, value: (a) => a.vehicleNumber },
    { key: 'status', label: 'Status', minWidth: 110, flex: 0.8, render: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <View>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 8 }}>
        <StatTile emphasis label="Needs a driver" value={unassigned.length} hint="Confirmed or active bookings" />
        <StatTile label="In progress" value={all.filter((a) => a.status === 'In progress').length} tone="violet" />
        <StatTile label="Upcoming" value={all.filter((a) => a.status === 'Upcoming').length} tone="info" />
        <StatTile label="Completed" value={all.filter((a) => a.status === 'Completed').length} tone="success" />
      </Grid>

      <Section title="Bookings without a driver" subtitle="Only chauffeur-driven bookings need one; leave self-drive rentals as they are" action={<Button label="Assign driver" size="sm" icon={(c) => <Link2 size={14} color={c} />} onPress={() => setAssign({})} />}>
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {unassigned.length === 0 ? (
            <EmptyState compact title="Nothing to assign" message="Every confirmed or active booking already has a driver." />
          ) : (
            unassigned.map((b) => (
              <ListRow
                key={b.id}
                title={`${b.id} · ${b.customerName}`}
                subtitle={`${b.vehicleName} (${b.vehicleNumber}) · ${formatDate(b.pickupDate, false)} → ${formatDate(b.returnDate)}`}
                right={<StatusBadge status={b.status} />}
                onPress={() => setAssign({ bookingId: b.id })}
              />
            ))
          )}
        </Card>
      </Section>

      <Section title="All assignments" subtitle={`${rows.length} assignments · select one to open its booking`}>
        <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Driver, booking, customer or vehicle" />}>
          <FilterGroup label="Status">
            <SegmentedControl options={STATUS} value={status} onChange={setStatus} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
          </FilterGroup>
          <CsvButton
            data={() => ({
              filename: 'keygo-driver-assignments.csv',
              headers: ['Date', 'Driver', 'Booking', 'Customer', 'Vehicle', 'Status'],
              rows: rows.map((a) => [a.date, a.driverName, a.bookingId, a.customerName, a.vehicleNumber, a.status]),
            })}
          />
          {filtered ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(a) => `${a.driverName}-${a.id}`}
          onRowPress={(a) => router.push(`/bookings/${encodeURIComponent(a.bookingId)}`)}
          empty={<EmptyState compact title="No assignments" message={filtered ? 'Nothing matches these filters.' : 'Assignments appear here once a driver is linked to a booking.'} action={filtered ? <Button label="Clear filters" variant="outline" size="sm" onPress={reset} /> : undefined} />}
        />
        <Pager paged={paged} />
      </Section>

      {assign ? <AssignDriverSheet bookingId={assign.bookingId} onClose={() => setAssign(null)} /> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strong: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
  });
