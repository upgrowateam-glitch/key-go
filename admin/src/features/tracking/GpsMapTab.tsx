import { useRouter } from '@/shims/expo-router';
import { RefreshCw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Column, DataTable, EmptyState, GpsMapPlaceholder, MapMarker, Section, SegmentedControl, SimulatedNote, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { isOverdue } from '../../lib/lifecycle';
import { GpsPing, pingFleet } from '../../services/tracking';
import type { Vehicle } from '../../types';
import { ListToolbar, Pager, useCommonStyles, usePaged } from '../agreements/listTools';

const FILTERS = ['On rent', 'On time', 'Overdue', 'All vehicles'] as const;
type Filter = (typeof FILTERS)[number];

/** Normalises lat/lng of the shown vehicles into 0..1 map space (simple min/max, not a projection). */
function toMapPoints(vs: Vehicle[]) {
  if (vs.length === 0) return new Map<string, { x: number; y: number }>();
  const lats = vs.map((v) => v.gps.lat);
  const lngs = vs.map((v) => v.gps.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = (a: number, b: number) => (b - a > 1e-6 ? b - a : 0);
  return new Map(
    vs.map((v, i) => {
      const sx = span(minLng, maxLng);
      const sy = span(minLat, maxLat);
      // Spread single / identical points so pins don't overlap.
      const x = sx ? 0.12 + ((v.gps.lng - minLng) / sx) * 0.7 : 0.3 + (i % 3) * 0.2;
      const y = sy ? 0.15 + (1 - (v.gps.lat - minLat) / sy) * 0.65 : 0.35 + (i % 2) * 0.25;
      return [v.id, { x, y }];
    })
  );
}

export default function GpsMapTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { bookings, vehicles, today, showToast } = useApp();
  const [filter, setFilter] = useState<Filter>('On rent');
  const [query, setQuery] = useState('');
  const [pings, setPings] = useState<Record<string, GpsPing>>({});
  const [refreshing, setRefreshing] = useState(false);

  const tracked = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const rentalByVehicle = useMemo(() => new Map(bookings.filter((b) => b.status === 'Active').map((b) => [b.vehicleId, b])), [bookings]);

  const onMap = useMemo(
    () =>
      tracked.filter((v) => {
        const b = rentalByVehicle.get(v.id);
        if (filter === 'All vehicles') return true;
        if (!b) return false;
        return filter === 'Overdue' ? isOverdue(b, today) : filter === 'On time' ? !isOverdue(b, today) : true;
      }),
    [tracked, rentalByVehicle, filter, today]
  );

  const points = toMapPoints(onMap);
  const markers: MapMarker[] = onMap.flatMap((v) => {
    const p = points.get(v.id);
    if (!p) return [];
    const b = rentalByVehicle.get(v.id);
    const overdue = !!b && isOverdue(b, today);
    return [{ id: v.id, label: `${v.vehicleNumber}${overdue ? ' · overdue' : ''}`, x: p.x, y: p.y, tone: overdue ? 'danger' : b ? 'primary' : 'neutral' }];
  });

  const positions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return onMap.filter((v) => !q || [v.name, v.vehicleNumber, v.gps.area].some((s) => s.toLowerCase().includes(q)));
  }, [onMap, query]);
  const paged = usePaged(positions, `${filter}|${query}`);

  const refresh = () => {
    setRefreshing(true);
    pingFleet(tracked)
      .then(
        (next) => {
          setPings(next);
          showToast('Positions refreshed (simulated)');
        },
        (e: Error) => showToast(e.message)
      )
      .finally(() => setRefreshing(false));
  };

  const positionCols: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.5,
      minWidth: 170,
      render: (v) => (
        <View>
          <Text style={styles.title} numberOfLines={1}>
            {v.name}
          </Text>
          <Text style={styles.sub}>{v.vehicleNumber}</Text>
        </View>
      ),
    },
    { key: 'status', label: 'Status', flex: 1, minWidth: 120, render: (v) => <StatusBadge status={v.status} /> },
    { key: 'area', label: 'Location', flex: 1.8, minWidth: 200, value: (v) => v.gps.area },
    { key: 'speed', label: 'Speed', flex: 0.7, minWidth: 90, align: 'right', value: (v) => `${pings[v.id]?.speedKmh ?? v.gps.speedKmh} km/h` },
    {
      key: 'ignition',
      label: 'Ignition',
      flex: 0.7,
      minWidth: 90,
      render: (v) => {
        const on = pings[v.id]?.ignitionOn ?? v.gps.ignitionOn;
        return <Badge label={on ? 'On' : 'Off'} tone={on ? 'success' : 'neutral'} />;
      },
    },
    { key: 'updated', label: 'Updated', flex: 0.9, minWidth: 110, value: (v) => pings[v.id]?.updatedAt ?? v.gps.updatedAt },
  ];

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        <Button label={refreshing ? 'Refreshing' : 'Refresh positions'} size="sm" variant="outline" disabled={refreshing} icon={(c) => <RefreshCw size={14} color={c} />} onPress={refresh} />
      </View>
      <GpsMapPlaceholder markers={markers} height={isPhone ? 240 : 380} caption="Simulated GPS view · last known positions" />
      <SimulatedNote>Positions are sample data. Live tracking will come from the GPS/telematics provider once integrated.</SimulatedNote>

      <Section title="Vehicle positions" subtitle={`Last known GPS fix · ${positions.length} of ${onMap.length} shown`}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle, number or location" onReset={query ? () => setQuery('') : undefined} />
        <DataTable
          columns={positionCols}
          rows={paged.pageRows}
          rowKey={(v) => v.id}
          onRowPress={(v) => router.push(`/fleet/${encodeURIComponent(v.id)}`)}
          empty={<EmptyState compact title={onMap.length ? 'No vehicles match' : 'No vehicles to show'} message={onMap.length ? 'Try another search.' : 'Nothing is in this filter right now.'} />}
        />
        <Pager paged={paged} />
      </Section>
    </View>
  );
}
