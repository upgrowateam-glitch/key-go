import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, Gauge, KeyRound, MapPin, Navigation, Route } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, EmptyState, Grid, ProgressBar, Section, SegmentedControl, StatTile } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { daysBetween, formatDate, formatKm } from '../../lib/format';
import { elapsedDays, isOverdue } from '../../lib/lifecycle';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking, Vehicle } from '../../types';
import { FilterGroup, ListToolbar, Pager, usePaged } from '../agreements/listTools';
import { computeUtilization } from './UtilizationTab';

const FILTERS = ['All', 'On time', 'Overdue'] as const;
type Filter = (typeof FILTERS)[number];
const SORTS = ['Return date', 'Longest running', 'Km driven', 'Customer A-Z'] as const;
type Sort = (typeof SORTS)[number];

export default function ActiveRentalsTab() {
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { bookings, vehicles, today } = useApp();
  const [filter, setFilter] = useState<Filter>('All');
  const [sort, setSort] = useState<Sort>('Return date');
  const [query, setQuery] = useState('');

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const active = useMemo(() => bookings.filter((b) => b.status === 'Active'), [bookings]);
  const overdueCount = active.filter((b) => isOverdue(b, today)).length;
  const totalKm = active.reduce((s, b) => s + (b.kmDriven ?? 0), 0);
  const fleetAvg = useMemo(() => computeUtilization(vehicles, bookings, today, 30).fleetAvg, [vehicles, bookings, today]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return active
      .filter((b) => (filter === 'All' ? true : filter === 'Overdue' ? isOverdue(b, today) : !isOverdue(b, today)))
      .filter((b) => !q || [b.id, b.customerName, b.vehicleName, b.vehicleNumber].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) =>
        sort === 'Customer A-Z'
          ? a.customerName.localeCompare(b.customerName)
          : sort === 'Km driven'
            ? (b.kmDriven ?? 0) - (a.kmDriven ?? 0)
            : sort === 'Longest running'
              ? a.pickupDate.localeCompare(b.pickupDate)
              : a.returnDate.localeCompare(b.returnDate)
      );
  }, [active, filter, query, sort, today]);
  const paged = usePaged(shown, `${filter}|${sort}|${query}`, 8);

  const filtersActive = filter !== 'All' || !!query || sort !== 'Return date';
  const reset = () => {
    setFilter('All');
    setSort('Return date');
    setQuery('');
  };

  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label="Active rentals" value={active.length} emphasis icon={(c) => <KeyRound size={16} color={c} />} onPress={() => setFilter('All')} />
        <StatTile
          label="Overdue returns"
          value={overdueCount}
          tone={overdueCount ? 'danger' : 'success'}
          hint={overdueCount ? 'Tap to filter' : 'All on time'}
          icon={(c) => <AlertTriangle size={16} color={c} />}
          onPress={() => setFilter(overdueCount ? 'Overdue' : 'All')}
        />
        <StatTile label="Km driven (active)" value={formatKm(totalKm)} tone="info" icon={(c) => <Route size={16} color={c} />} />
        <StatTile label="Fleet utilization" value={`${fleetAvg}%`} tone="primary" hint="Last 30 days · sample" icon={(c) => <Gauge size={16} color={c} />} onPress={() => router.replace('/tracking?tab=utilization')} />
      </Grid>

      <Section title="Active rentals" subtitle={`${shown.length} of ${active.length} shown`}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Booking, customer or vehicle" onReset={filtersActive ? reset : undefined}>
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              title={active.length ? 'No rentals match' : 'No active rentals'}
              message={active.length ? 'No rentals in this filter.' : 'Rentals appear here once the pickup inspection is done.'}
              icon={(c) => <Navigation size={22} color={c} />}
              action={filtersActive ? <Button label="Show all" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          </Card>
        ) : (
          <Grid cols={cols(1, 2, 2)}>
            {paged.pageRows.map((b) => (
              <RentalCard key={b.id} booking={b} vehicle={vehicleById.get(b.vehicleId)} today={today} onOpen={() => router.push(`/bookings/${encodeURIComponent(b.id)}`)} />
            ))}
          </Grid>
        )}
        <Pager paged={paged} />
      </Section>
    </View>
  );
}

function RentalCard({ booking: b, vehicle, today, onOpen }: { booking: Booking; vehicle?: Vehicle; today: string; onOpen: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const overdue = isOverdue(b, today);
  const elapsed = elapsedDays(b, today);
  const lateBy = daysBetween(b.returnDate, today);
  const left = Math.max(0, daysBetween(today, b.returnDate));
  return (
    <Card onPress={onOpen}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }} accessibilityLabel={`Rental ${b.id}, ${b.customerName}, ${overdue ? 'overdue' : 'on time'}`}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cellTitle} numberOfLines={1}>
            {b.customerName}
          </Text>
          <Text style={styles.cellSub} numberOfLines={1}>
            {b.id} · {b.vehicleName} · {b.vehicleNumber}
          </Text>
        </View>
        {overdue ? <Badge label={`Overdue ${lateBy}d`} tone="danger" /> : <Badge label="On time" tone="success" />}
      </View>

      <View style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.metaLabel}>
            {elapsed} of {b.days} day{b.days === 1 ? '' : 's'} elapsed
          </Text>
          <Text style={[styles.metaLabel, overdue && { color: colors.danger, fontWeight: '700' }]}>
            {overdue ? `Was due ${formatDate(b.returnDate, false)}` : left === 0 ? `Returns today ${b.returnTime}` : `Returns ${formatDate(b.returnDate, false)} · ${left}d left`}
          </Text>
        </View>
        <ProgressBar value={b.days ? elapsed / b.days : 0} tone={overdue ? 'danger' : 'primary'} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Route size={14} color={colors.muted} />
          <Text style={styles.metaText}>{b.kmDriven != null ? formatKm(b.kmDriven) : '—'} driven</Text>
        </View>
        <View style={[styles.metaItem, { flexShrink: 1 }]}>
          <MapPin size={14} color={colors.muted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {vehicle ? `${vehicle.gps.area} · ${vehicle.gps.speedKmh} km/h` : 'No GPS fix'}
          </Text>
        </View>
      </View>
      <Text style={styles.updated}>{vehicle ? `GPS updated ${vehicle.gps.updatedAt}` : ''}</Text>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cellTitle: { color: colors.txt, fontSize: 14, fontWeight: '700' },
    cellSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    metaLabel: { color: colors.muted, fontSize: 12 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: colors.txt, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    updated: { color: colors.muted, fontSize: 11, marginTop: 6 },
  });
