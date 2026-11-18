import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, ChipGroup, Column, DataTable, EmptyState, Grid, HBarChart, ProgressBar, Section, SegmentedControl, SimulatedNote, StatTile, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { addDays, daysBetween, formatDate } from '../../lib/format';
import type { Booking, Vehicle } from '../../types';
import { FilterGroup, ListToolbar, Pager, useCommonStyles, usePaged } from '../agreements/listTools';

/** Booking statuses that actually occupy the vehicle. */
const OCCUPYING: Booking['status'][] = ['Confirmed', 'Active', 'Completed'];
const WINDOWS = ['7', '30', '90'] as const;
type WindowDays = (typeof WINDOWS)[number];
const SORTS = ['Most used', 'Least used', 'Vehicle A-Z'] as const;
type Sort = (typeof SORTS)[number];

export function computeUtilization(vehicles: Vehicle[], bookings: Booking[], today: string, windowDays: number) {
  const windowStart = addDays(today, -(windowDays - 1));
  const rows = vehicles
    .filter((v) => v.status !== 'Sold')
    .map((v) => {
      const booked = bookings
        .filter((b) => b.vehicleId === v.id && OCCUPYING.includes(b.status))
        .reduce((sum, b) => {
          // A booking occupies [pickupDate, pickupDate + days); an overdue active rental keeps occupying until today.
          let end = addDays(b.pickupDate, b.days);
          if (b.status === 'Active' && daysBetween(end, addDays(today, 1)) > 0) end = addDays(today, 1);
          const from = b.pickupDate > windowStart ? b.pickupDate : windowStart;
          const windowEnd = addDays(today, 1);
          const to = end < windowEnd ? end : windowEnd;
          return sum + Math.max(0, daysBetween(from, to));
        }, 0);
      const pct = Math.min(100, Math.round((booked / windowDays) * 100));
      return { vehicle: v, booked, pct };
    })
    .sort((a, b) => b.pct - a.pct);
  const fleetAvg = rows.length ? Math.round(rows.reduce((s, u) => s + u.pct, 0) / rows.length) : 0;
  return { rows, fleetAvg, windowStart };
}

type Row = ReturnType<typeof computeUtilization>['rows'][number];

export default function UtilizationTab() {
  const styles = useCommonStyles();
  const { cols, isPhone } = useResponsive();
  const { vehicles, bookings, today } = useApp();
  const [windowDays, setWindowDays] = useState<WindowDays>('30');
  const [sort, setSort] = useState<Sort>('Most used');
  const [query, setQuery] = useState('');

  const days = parseInt(windowDays, 10);
  const { rows: utilization, fleetAvg, windowStart } = useMemo(() => computeUtilization(vehicles, bookings, today, days), [vehicles, bookings, today, days]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return utilization
      .filter((u) => !q || u.vehicle.name.toLowerCase().includes(q) || u.vehicle.vehicleNumber.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'Vehicle A-Z' ? a.vehicle.name.localeCompare(b.vehicle.name) : sort === 'Least used' ? a.pct - b.pct : b.pct - a.pct));
  }, [utilization, query, sort]);
  const paged = usePaged(shown, `${query}|${sort}|${windowDays}`);

  const filtersActive = !!query || sort !== 'Most used';
  const reset = () => {
    setQuery('');
    setSort('Most used');
  };

  const columns: Column<Row>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.5,
      minWidth: 170,
      render: (u) => (
        <View>
          <Text style={styles.strong} numberOfLines={1}>
            {u.vehicle.name}
          </Text>
          <Text style={styles.sub}>{u.vehicle.vehicleNumber}</Text>
        </View>
      ),
    },
    { key: 'status', label: 'Status', flex: 0.9, minWidth: 110, render: (u) => <StatusBadge status={u.vehicle.status} /> },
    { key: 'booked', label: 'Booked days', flex: 0.8, minWidth: 100, align: 'right', value: (u) => `${u.booked} of ${days}` },
    {
      key: 'pct',
      label: 'Utilization',
      flex: 1.4,
      minWidth: 170,
      render: (u) => (
        <View style={{ alignSelf: 'stretch', gap: 4 }}>
          <Text style={styles.strong}>{u.pct}%</Text>
          <ProgressBar value={u.pct / 100} tone={u.pct === 0 ? 'warning' : 'primary'} />
        </View>
      ),
    },
  ];

  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <SegmentedControl options={WINDOWS} value={windowDays} onChange={setWindowDays} labels={{ '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days' }} />
      </View>
      <Grid cols={cols(1, 3, 3)}>
        <StatTile label="Fleet average" value={`${fleetAvg}%`} tone="primary" hint={`${utilization.length} vehicles in service`} />
        <StatTile label="Most used" value={utilization[0] ? `${utilization[0].pct}%` : '—'} tone="success" hint={utilization[0] ? utilization[0].vehicle.name : undefined} />
        <StatTile label="Idle vehicles" value={utilization.filter((u) => u.pct === 0).length} tone="warning" hint="0 booked days in window" />
      </Grid>

      <Section title="Vehicle utilization" subtitle={`${formatDate(windowStart, false)} – ${formatDate(today)} · booked days ÷ ${days}`}>
        <Card>
          {utilization.length ? (
            <HBarChart items={utilization.map((u) => ({ label: u.vehicle.name, sublabel: `${u.vehicle.vehicleNumber} · ${u.booked}d`, value: u.pct }))} formatValue={(v) => `${v}%`} />
          ) : (
            <EmptyState compact title="No vehicles in service" />
          )}
        </Card>
        <SimulatedNote>
          Sample calculation: days booked (confirmed, active or completed) that fall inside the last {days} days ÷ {days}, capped at 100%. Final utilization rules are pending business confirmation.
        </SimulatedNote>
      </Section>

      <Section title="By vehicle">
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle or number" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable columns={columns} rows={paged.pageRows} rowKey={(u) => u.vehicle.id} empty={<EmptyState compact title="No vehicles match" message="Try another search." />} />
        <Pager paged={paged} />
      </Section>
    </View>
  );
}
