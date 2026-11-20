import { useRouter } from '@/shims/expo-router';
import { RefreshCw, Satellite } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, Column, DataTable, EmptyState, Section, SegmentedControl, StatusBadge } from '../../components/kit';
import { LiveMap, type LiveMarker } from '../../components/portal/LiveMap';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { isOverdue } from '../../lib/lifecycle';
import { ago, useGpsFeed, type CarPosition } from '../../services/gps';
import type { Vehicle } from '../../types';
import { ListToolbar, Pager, useCommonStyles, usePaged } from '../agreements/listTools';

const FILTERS = ['On rent', 'On time', 'Overdue', 'All vehicles'] as const;
type Filter = (typeof FILTERS)[number];

/** Every car's live location from the GPS tracking server, with rentals and overdue cars highlighted. */
export default function GpsMapTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { bookings, vehicles, today } = useApp();
  const { feed, error, reload } = useGpsFeed();
  const [filter, setFilter] = useState<Filter>('All vehicles');
  const [query, setQuery] = useState('');

  const tracked = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const rentalByVehicle = useMemo(() => new Map(bookings.filter((b) => b.status === 'Active').map((b) => [b.vehicleId, b])), [bookings]);
  const liveByVehicle = useMemo(() => new Map((feed?.cars ?? []).map((c) => [c.vehicleId, c])), [feed]);

  const inFilter = useMemo(
    () =>
      tracked.filter((v) => {
        const b = rentalByVehicle.get(v.id);
        if (filter === 'All vehicles') return true;
        if (!b) return false;
        return filter === 'Overdue' ? isOverdue(b, today) : filter === 'On time' ? !isOverdue(b, today) : true;
      }),
    [tracked, rentalByVehicle, filter, today]
  );

  const markers: LiveMarker[] = useMemo(
    () =>
      inFilter.flatMap((v) => {
        const p = liveByVehicle.get(v.id);
        if (!p || p.lat === null || p.lng === null) return [];
        const b = rentalByVehicle.get(v.id);
        const overdue = !!b && isOverdue(b, today);
        return [
          {
            id: v.id,
            lat: p.lat,
            lng: p.lng,
            title: `${v.vehicleNumber} · ${v.name}`,
            detail: `${b ? (overdue ? 'Overdue · ' : 'On rent · ') : ''}${p.speedKmh ?? 0} km/h · ${ago(p.at)}`,
            tone: overdue ? 'danger' : p.status === 'online' ? 'primary' : 'muted',
            onPress: () => router.push(`/fleet/${encodeURIComponent(v.id)}?tab=gps-tracking` as never),
          } satisfies LiveMarker,
        ];
      }),
    [inFilter, liveByVehicle, rentalByVehicle, today, router]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inFilter.filter((v) => !q || [v.name, v.vehicleNumber, v.code ?? '', v.gpsDeviceId].some((s) => s.toLowerCase().includes(q)));
  }, [inFilter, query]);
  const paged = usePaged(rows, `${filter}|${query}`);
  const live = (v: Vehicle): CarPosition | undefined => liveByVehicle.get(v.id);

  const columns: Column<Vehicle>[] = [
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
    {
      key: 'gps',
      label: 'GPS',
      flex: 1,
      minWidth: 120,
      render: (v) => {
        const p = live(v);
        return !v.gpsDeviceId ? <Badge label="No device" tone="neutral" /> : !p ? <Badge label="Not reporting" tone="warning" /> : <Badge label={p.status === 'online' ? 'Online' : 'Offline'} tone={p.status === 'online' ? 'success' : 'neutral'} />;
      },
    },
    { key: 'speed', label: 'Speed', flex: 0.7, minWidth: 90, align: 'right', value: (v) => (live(v)?.speedKmh === undefined || live(v)?.speedKmh === null ? '—' : `${live(v)!.speedKmh} km/h`) },
    { key: 'updated', label: 'Last report', flex: 0.9, minWidth: 110, value: (v) => (live(v) ? ago(live(v)!.at) : '—') },
  ];

  if (error || (feed && !feed.connected)) {
    return (
      <Card>
        <EmptyState
          title="Live tracking is not connected yet"
          message={error || feed?.message || 'The GPS tracking server is not set up.'}
          icon={(c) => <Satellite size={22} color={c} />}
          action={<Button label="Try again" size="sm" variant="outline" icon={(c) => <RefreshCw size={14} color={c} />} onPress={reload} />}
        />
      </Card>
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        <Button label="Refresh" size="sm" variant="outline" icon={(c) => <RefreshCw size={14} color={c} />} onPress={reload} />
      </View>
      <LiveMap markers={markers} height={isPhone ? 260 : 420} />
      <Text style={[styles.sub, { marginTop: 6 }]}>
        {markers.length} of {inFilter.length} cars on the map · updates every 20 seconds · double-click a car to open it
        {feed?.unmatched.length ? ` · ${feed.unmatched.length} device(s) not linked to a car yet (link them on the car's GPS tab)` : ''}
      </Text>

      <Section title="Vehicle positions" subtitle={`${rows.length} of ${inFilter.length} shown`}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle, number or GPS device" onReset={query ? () => setQuery('') : undefined} />
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(v) => v.id}
          onRowPress={(v) => router.push(`/fleet/${encodeURIComponent(v.id)}?tab=gps-tracking` as never)}
          empty={<EmptyState compact title={inFilter.length ? 'No vehicles match' : 'No vehicles to show'} message={inFilter.length ? 'Try another search.' : 'Nothing is in this filter right now.'} />}
        />
        <Pager paged={paged} />
      </Section>
    </View>
  );
}
