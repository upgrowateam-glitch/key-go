import React from 'react';
import { Text, View } from 'react-native';
import { Clock, Cpu, Gauge, KeyRound, Link2, MapPin, Navigation, RefreshCw, Satellite, Settings2, Smartphone, Wifi } from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, Section } from '../../../components/kit';
import { LiveMap } from '../../../components/portal/LiveMap';
import { useApp } from '../../../context/AppContext';
import { ago, useGpsFeed } from '../../../services/gps';
import type { FleetExtras } from '../../../services/fleet';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { InfoTile, SectionHeader } from '../ui';

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
      <SectionHeader icon={Settings2} title="GPS settings" subtitle="Change these with Edit vehicle" tone="violet" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <InfoTile icon={Cpu} label="GPS device ID" value={v.gpsDeviceId || 'Not set'} tone="violet" />
        <InfoTile icon={Satellite} label="GPS company" value={v.gpsProvider || 'Not set'} tone="violet" />
        <InfoTile icon={Smartphone} label="GPS SIM number" value={v.gpsSim || 'Not set'} tone="violet" />
      </View>
      <Text style={[styles.hint, { marginTop: 10 }]}>Change these with Edit vehicle. The device ID must match the device in the GPS tracking server.</Text>
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
        <SectionHeader
          icon={Navigation}
          title="Live position"
          subtitle="From the GPS tracking server, refreshed every 20 seconds"
          tone="info"
          action={
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {live ? <Badge label={live.status === 'online' ? 'Online' : 'Offline'} tone={live.status === 'online' ? 'success' : 'neutral'} /> : null}
              <Button label="Refresh" size="sm" variant="outline" icon={(c) => <RefreshCw size={14} color={c} />} onPress={reload} />
            </View>
          }
        />
        {live ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <InfoTile icon={MapPin} label="Coordinates" value={hasFix ? `${live.lat!.toFixed(5)}, ${live.lng!.toFixed(5)}` : 'No fix yet'} tone="info" />
            <InfoTile icon={Gauge} label="Speed" value={live.speedKmh === null ? '—' : `${live.speedKmh} km/h`} tone="info" />
            <InfoTile icon={KeyRound} label="Ignition" value={live.ignition === null ? 'Not reported' : live.ignition ? 'On' : 'Off'} tone={live.ignition ? 'success' : 'primary'} />
            <InfoTile icon={Clock} label="Last report" value={ago(live.at)} />
            <InfoTile icon={Wifi} label="Device name in GPS server" value={live.name} />
          </View>
        ) : (
          <EmptyState
            compact
            title={v.gpsDeviceId ? 'No signal from this device' : 'No GPS device yet'}
            message={v.gpsDeviceId ? `No device with ID "${v.gpsDeviceId}" is sending locations. Check the ID, or that the device/phone is switched on.` : 'This car has no GPS device ID yet. Add it with Edit vehicle.'}
            icon={(c) => <Satellite size={22} color={c} />}
          />
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
