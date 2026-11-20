import React from 'react';
import { Text, View } from 'react-native';
import { Link2, RefreshCw, Satellite } from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, KeyValueGrid, Section } from '../../../components/kit';
import { LiveMap } from '../../../components/portal/LiveMap';
import { useApp } from '../../../context/AppContext';
import { ago, useGpsFeed } from '../../../services/gps';
import type { FleetExtras } from '../../../services/fleet';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';

/** The car's GPS settings and its live position from the GPS tracking server (Traccar). */
export function GpsTab({ v }: { v: Vehicle; extras: FleetExtras; onChanged: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const { updateVehicle, showToast } = useApp();
  const { feed, error, reload } = useGpsFeed();
  const live = feed?.cars.find((c) => c.vehicleId === v.id);
  const hasFix = live && live.lat !== null && live.lng !== null;

  const settings = (
    <Card>
      <Text style={styles.cardTitle}>GPS settings</Text>
      <KeyValueGrid
        items={[
          { label: 'GPS device ID', value: v.gpsDeviceId || 'Not set' },
          { label: 'GPS company', value: v.gpsProvider || 'Not set' },
          { label: 'GPS SIM number', value: v.gpsSim || 'Not set' },
        ]}
      />
      <Text style={[styles.hint, { marginTop: 8 }]}>Change these with Edit vehicle. The device ID must match the device in the GPS tracking server.</Text>
    </Card>
  );

  if (!feed && !error) return <View style={{ gap: 12 }}>{settings}</View>;

  if (error || !feed?.connected) {
    return (
      <View style={{ gap: 12 }}>
        <Card>
          <EmptyState
            title="Live tracking is not connected yet"
            message={error || feed?.message || 'The GPS tracking server is not set up.'}
            icon={(c) => <Satellite size={22} color={c} />}
            action={<Button label="Try again" size="sm" variant="outline" icon={(c) => <RefreshCw size={14} color={c} />} onPress={reload} />}
          />
        </Card>
        {settings}
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {hasFix ? (
        <LiveMap height={300} markers={[{ id: v.id, lat: live!.lat!, lng: live!.lng!, title: v.vehicleNumber, detail: `${live!.speedKmh ?? 0} km/h · ${ago(live!.at)}`, tone: live!.status === 'online' ? 'primary' : 'muted' }]} />
      ) : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Live position</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {live ? <Badge label={live.status === 'online' ? 'Online' : 'Offline'} tone={live.status === 'online' ? 'success' : 'neutral'} /> : null}
            <Button label="Refresh" size="sm" variant="outline" icon={(c) => <RefreshCw size={14} color={c} />} onPress={reload} />
          </View>
        </View>
        {live ? (
          <KeyValueGrid
            items={[
              { label: 'Coordinates', value: hasFix ? `${live.lat!.toFixed(5)}, ${live.lng!.toFixed(5)}` : 'No fix yet' },
              { label: 'Speed', value: live.speedKmh === null ? '—' : `${live.speedKmh} km/h` },
              { label: 'Ignition', value: live.ignition === null ? 'Not reported' : live.ignition ? 'On' : 'Off' },
              { label: 'Last report', value: ago(live.at) },
              { label: 'Device name in GPS server', value: live.name },
            ]}
          />
        ) : (
          <Text style={styles.hint}>
            {v.gpsDeviceId ? `No device with ID "${v.gpsDeviceId}" is sending locations. Check the ID, or that the device/phone is switched on.` : 'This car has no GPS device ID yet.'}
          </Text>
        )}
      </Card>
      {settings}
      {!live && feed.unmatched.length ? (
        <Section title="Devices not linked to a car" subtitle="These are sending locations. Link one to this car if it is fitted here.">
          <Card padded={false}>
            {feed.unmatched.map((d, i) => (
              <View key={d.deviceId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle}>{d.name}</Text>
                  <Text style={styles.hint}>
                    ID {d.deviceId} · {d.status} · {ago(d.at)}
                  </Text>
                </View>
                <Button
                  label="Link to this car"
                  size="sm"
                  icon={(c) => <Link2 size={14} color={c} />}
                  onPress={() => {
                    updateVehicle(v.id, { gpsDeviceId: d.deviceId });
                    showToast(`${v.vehicleNumber} linked to GPS device ${d.deviceId}`);
                    setTimeout(reload, 1500);
                  }}
                />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </View>
  );
}
