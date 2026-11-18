import React from 'react';
import { Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { Badge, Button, Card, Column, DataTable, EmptyState, GpsMapPlaceholder, KeyValueGrid, Section, SimulatedNote } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { addGpsEvent, FleetExtras, GpsEvent } from '../../../services/fleet';
import { useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { ListPager, usePaged } from '../ListPager';

/** Places a fix on the stylised map deterministically (no real map projection in the UI phase). */
function pinPosition(lat: number, lng: number) {
  const frac = (n: number) => n - Math.floor(n);
  return { x: 0.2 + frac(lng * 7.3) * 0.6, y: 0.2 + frac(lat * 5.1) * 0.6 };
}

const EVENT_COLUMNS: Column<GpsEvent>[] = [
  { key: 'time', label: 'Time', flex: 1, minWidth: 140, value: (e) => e.time },
  { key: 'event', label: 'Event', flex: 1.4, minWidth: 170, value: (e) => e.event },
  { key: 'area', label: 'Location', flex: 1.6, minWidth: 190, value: (e) => e.area },
];

export function GpsTab({ v, extras, onChanged }: { v: Vehicle; extras: FleetExtras; onChanged: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { today, updateVehicle, showToast } = useApp();
  const pos = pinPosition(v.gps.lat, v.gps.lng);
  const moving = v.gps.speedKmh > 0;
  const paged = usePaged(extras.gpsEvents[v.id] ?? []);

  const refresh = () => {
    const stamp = `${today} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    updateVehicle(v.id, { gps: { ...v.gps, updatedAt: stamp } });
    addGpsEvent(v.id, { time: stamp, event: 'Location refreshed (simulated)', area: v.gps.area });
    onChanged();
    showToast('Location refreshed (simulated)');
  };

  return (
    <View style={{ gap: 12 }}>
      <GpsMapPlaceholder
        height={260}
        markers={[{ id: v.id, label: `${v.vehicleNumber} · ${v.gps.area}`, x: pos.x, y: pos.y, tone: v.status === 'Sold' ? 'neutral' : moving ? 'primary' : 'warning' }]}
        caption={`Last fix ${v.gps.updatedAt} · simulated`}
      />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Last known position</Text>
          <Button label="Refresh" variant="outline" size="sm" icon={(c) => <RefreshCw size={14} color={c} />} onPress={refresh} />
        </View>
        <KeyValueGrid
          items={[
            { label: 'Area', value: v.gps.area },
            { label: 'Coordinates', value: `${v.gps.lat.toFixed(4)}, ${v.gps.lng.toFixed(4)}` },
            { label: 'Speed', value: `${v.gps.speedKmh} km/h` },
            { label: 'Ignition', value: <Badge label={v.gps.ignitionOn ? 'On' : 'Off'} tone={v.gps.ignitionOn ? 'success' : 'neutral'} /> },
            { label: 'Last updated', value: v.gps.updatedAt },
            { label: 'GPS device ID', value: v.gpsDeviceId },
          ]}
        />
      </Card>
      <Section title="Recent events" style={{ marginTop: 8 }}>
        <DataTable columns={EVENT_COLUMNS} rows={paged.rows} rowKey={(e) => e.id} empty={<EmptyState compact title="No GPS events" message="Events appear once the device reports." />} />
        <ListPager paged={paged} />
      </Section>
      <SimulatedNote>GPS data is sample data. Live tracking will come from the telematics provider once integrated.</SimulatedNote>
    </View>
  );
}
