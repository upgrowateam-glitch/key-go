import React, { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Car, LogIn, LogOut, MapPin, Phone } from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, Grid, PageHeader, Screen, Section, StatTile, StatusBadge } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useResource } from '../../services/mockClient';
import type { StaffSession } from '../../services/auth';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { BookingStatus } from '../../types';

interface DriverTrip {
  id: string;
  status: BookingStatus;
  vehicleName: string;
  vehicleNumber: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  days: number;
}

interface DriverPage {
  driver: {
    id: string;
    name: string;
    phone: string;
    licenseNo: string;
    licenseExpiry: string;
    dutyStatus: 'On Duty' | 'Off Duty' | 'On Trip';
    lastPunchIn: string | null;
    lastPunchOut: string | null;
    commissionPercent: number;
    tripsThisMonth: number;
  };
  trips: DriverTrip[];
}

const loadDriverPage = () => api<DriverPage>('/driver/me');
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

/** What a Driver sees after signing in: duty punch and the trips assigned to them. */
export function DriverHome({ session, notify }: { session: StaffSession; notify: (message: string) => void }) {
  const page = useResource(loadDriverPage);
  if (!page.data) {
    return (
      <Screen>
        <PageHeader eyebrow="Driver" title={`Hi, ${session.name.split(' ')[0]}`} />
        <ResourceState loading={page.loading} error={page.error} onRetry={page.reload} />
      </Screen>
    );
  }
  return <DriverPageView data={page.data} onChange={page.setData} notify={notify} />;
}

function DriverPageView({ data, onChange, notify }: { data: DriverPage; onChange: (d: DriverPage) => void; notify: (m: string) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const [saving, setSaving] = useState(false);
  const { driver, trips } = data;
  const open = trips.filter((t) => t.status === 'Confirmed' || t.status === 'Active').sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  const done = trips.filter((t) => t.status === 'Completed' || t.status === 'Cancelled');
  const onDuty = driver.dutyStatus !== 'Off Duty';

  const punch = async () => {
    setSaving(true);
    try {
      const next = onDuty ? 'Off Duty' : 'On Duty';
      const r = await api<{ dutyStatus: DriverPage['driver']['dutyStatus']; at: string }>('/driver/duty', { method: 'POST', body: { status: next } });
      onChange({ ...data, driver: { ...driver, dutyStatus: r.dutyStatus, ...(next === 'On Duty' ? { lastPunchIn: r.at } : { lastPunchOut: r.at }) } });
      notify(next === 'On Duty' ? 'Punched in. Have a safe day.' : 'Punched out.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <PageHeader eyebrow="Driver" title={`Hi, ${driver.name.split(' ')[0]}`} subtitle="Your duty and assigned trips" />

      <Card tone="primary" style={{ marginTop: 8 }}>
        <View style={styles.dutyRow}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={styles.dutyLabel}>Duty status</Text>
            <Text style={styles.dutyValue}>{driver.dutyStatus}</Text>
            <Text style={styles.dutyMeta}>
              Last punch in {time(driver.lastPunchIn)} · out {time(driver.lastPunchOut)}
            </Text>
          </View>
          <Button
            label={saving ? 'Saving…' : onDuty ? 'Punch out' : 'Punch in'}
            variant={onDuty ? 'secondary' : 'highlight'}
            disabled={saving || driver.dutyStatus === 'On Trip'}
            icon={(c) => (onDuty ? <LogOut size={16} color={c} /> : <LogIn size={16} color={c} />)}
            onPress={punch}
          />
        </View>
        {driver.dutyStatus === 'On Trip' ? <Text style={styles.dutyMeta}>You are on a trip. Your manager marks the trip finished, then you can punch out.</Text> : null}
      </Card>

      <Grid cols={cols(2, 3, 3)} style={{ marginTop: 14 }}>
        <StatTile label="Open trips" value={open.length} icon={(c) => <Car size={16} color={c} />} />
        <StatTile label="Trips this month" value={driver.tripsThisMonth ?? 0} tone="info" icon={(c) => <CalendarClock size={16} color={c} />} />
        <StatTile label="Commission" value={`${driver.commissionPercent ?? 0}%`} hint="On chauffeur trips" tone="success" />
      </Grid>

      <Section title="My trips" subtitle="Confirmed and active bookings you drive">
        {open.length === 0 ? (
          <Card>
            <EmptyState title="No trips assigned" message="When your manager assigns you to a booking, it appears here." icon={(c) => <Car size={22} color={c} />} />
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {open.map((t) => (
              <Card key={t.id}>
                <View style={styles.tripHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tripTitle}>
                      {t.vehicleName} · {t.vehicleNumber}
                    </Text>
                    <Text style={styles.tripMeta}>Booking {t.id}</Text>
                  </View>
                  <StatusBadge status={t.status} />
                </View>
                <View style={styles.line}>
                  <MapPin size={15} color={colors.primaryText} />
                  <Text style={styles.lineText}>{t.pickupLocation}</Text>
                </View>
                <View style={styles.line}>
                  <CalendarClock size={15} color={colors.primaryText} />
                  <Text style={styles.lineText}>
                    {formatDate(t.pickupDate)} {t.pickupTime} → {formatDate(t.returnDate)} {t.returnTime} · {t.days} day{t.days === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={[styles.line, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                  <Text style={styles.lineText}>Customer: {t.customerName}</Text>
                  {t.customerPhone ? (
                    <Button label={`Call ${t.customerPhone}`} size="sm" variant="outline" icon={(c) => <Phone size={14} color={c} />} onPress={() => Linking.openURL(`tel:${t.customerPhone.replace(/\s/g, '')}`)} />
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        )}
      </Section>

      {done.length ? (
        <Section title="Past trips">
          <Card padded={false}>
            {done.slice(0, 20).map((t, i) => (
              <View key={t.id} style={[styles.pastRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tripTitle} numberOfLines={1}>
                    {t.vehicleName} · {t.customerName}
                  </Text>
                  <Text style={styles.tripMeta}>
                    {formatDate(t.pickupDate)} – {formatDate(t.returnDate)}
                  </Text>
                </View>
                <Badge label={t.status} tone={t.status === 'Completed' ? 'success' : 'neutral'} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dutyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
    dutyLabel: { color: colors.onPrimary, opacity: 0.8, fontSize: 12.5 },
    dutyValue: { color: colors.highlight, fontSize: 24, fontWeight: '800', marginTop: 2 },
    dutyMeta: { color: colors.onPrimary, opacity: 0.8, fontSize: 12.5, marginTop: 4 },
    tripHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    tripTitle: { color: colors.txt, fontSize: 15, fontWeight: '700' },
    tripMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    lineText: { color: colors.txt, fontSize: 13.5, flexShrink: 1 },
    pastRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  });
