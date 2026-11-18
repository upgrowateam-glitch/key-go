import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, ClipboardCheck, ClipboardList, FileSignature, LogIn, LogOut, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, EmptyState, Grid, Section, StatTile, VehiclePhoto } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { daysBetween, formatDate, formatINR } from '../../lib/format';
import { isOverdue } from '../../lib/lifecycle';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking, InspectionRecord, Vehicle } from '../../types';
import { FilterGroup, ListToolbar, Pager, usePaged } from '../agreements/listTools';

const SORTS = ['Soonest first', 'Latest first', 'Customer A-Z'] as const;
type Sort = (typeof SORTS)[number];

export function InspectionThumb({ vehicle }: { vehicle?: Vehicle }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.thumb}>
      <VehiclePhoto source={vehicle?.imageAsset} style={{ width: '100%', height: '100%' }} radius={0} />
    </View>
  );
}

function QueueRow({ booking: b, vehicle, type, last }: { booking: Booking; vehicle?: Vehicle; type: InspectionRecord['type']; last: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { today } = useApp();
  const date = type === 'Pickup' ? b.pickupDate : b.returnDate;
  const time = type === 'Pickup' ? b.pickupTime : b.returnTime;
  const delta = daysBetween(today, date);
  const overdue = type === 'Return' && isOverdue(b, today);
  const when = delta === 0 ? 'Today' : delta === 1 ? 'Tomorrow' : delta < 0 ? `${-delta}d ago` : `in ${delta}d`;
  return (
    <View style={[styles.queueRow, isPhone && { flexDirection: 'column', alignItems: 'stretch' }, last && { borderBottomWidth: 0 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <InspectionThumb vehicle={vehicle} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={styles.strong}>{b.id}</Text>
            {overdue ? <Badge label="Overdue" tone="danger" /> : <Badge label={when} tone={delta <= 0 ? 'highlight' : 'neutral'} />}
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {b.vehicleName} · {b.vehicleNumber}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {b.customerName} · {type} {formatDate(date, false)}, {time}
          </Text>
        </View>
      </View>
      <Button
        label={type === 'Pickup' ? 'Start pickup inspection' : 'Start return inspection'}
        size="sm"
        variant={type === 'Pickup' ? 'primary' : 'secondary'}
        icon={(c) => (type === 'Pickup' ? <LogOut size={14} color={c} /> : <LogIn size={14} color={c} />)}
        onPress={() => router.push(`/bookings/${encodeURIComponent(b.id)}/inspection?type=${type}`)}
      />
    </View>
  );
}

function Queue({ title, subtitle, type, items, emptyMsg }: { title: string; subtitle: string; type: InspectionRecord['type']; items: Booking[]; emptyMsg: string }) {
  const { vehicles } = useApp();
  const { isPhone } = useResponsive();
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('Soonest first');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dateOf = (b: Booking) => (type === 'Pickup' ? b.pickupDate : b.returnDate);
    return items
      .filter((b) => !q || [b.id, b.customerName, b.vehicleName, b.vehicleNumber].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'Customer A-Z' ? a.customerName.localeCompare(b.customerName) : sort === 'Latest first' ? dateOf(b).localeCompare(dateOf(a)) : dateOf(a).localeCompare(dateOf(b))));
  }, [items, query, sort, type]);
  const paged = usePaged(shown, `${query}|${sort}`);
  const filtersActive = !!query || sort !== 'Soonest first';
  const reset = () => {
    setQuery('');
    setSort('Soonest first');
  };

  return (
    <Section title={`${title} (${items.length})`} subtitle={subtitle}>
      <ListToolbar query={query} onQuery={setQuery} placeholder="Booking, customer or vehicle" onReset={filtersActive ? reset : undefined}>
        <FilterGroup label="Sort by">
          <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
        </FilterGroup>
      </ListToolbar>
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {shown.length === 0 ? (
          <EmptyState
            compact
            title={items.length ? 'No inspections match' : 'Nothing due'}
            message={items.length ? 'Try another search.' : emptyMsg}
            icon={(c) => <ClipboardCheck size={22} color={c} />}
            action={filtersActive ? <Button label="Reset" variant="outline" size="sm" onPress={reset} /> : undefined}
          />
        ) : (
          paged.pageRows.map((b, i) => <QueueRow key={b.id} booking={b} vehicle={vehicleById.get(b.vehicleId)} type={type} last={i === paged.pageRows.length - 1} />)
        )}
      </Card>
      <Pager paged={paged} />
    </Section>
  );
}

export function PickupInspectionTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cols } = useResponsive();
  const { bookings, inspections, today } = useApp();

  const due = useMemo(() => bookings.filter((b) => b.status === 'Confirmed' && !!b.agreementId && !b.pickupInspectionId), [bookings]);
  const needAgreement = bookings.filter((b) => b.status === 'Confirmed' && !b.agreementId).length;
  const month = today.slice(0, 7);
  const pickups = inspections.filter((r) => r.type === 'Pickup');
  const preExisting = pickups.reduce((s, r) => s + r.damageMarks.length, 0);

  return (
    <View>
      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Due for pickup" value={due.length} hint="Agreement signed" emphasis icon={(c) => <LogOut size={16} color={c} />} />
        <StatTile label="Need agreement first" value={needAgreement} hint="Confirmed bookings" tone="highlight" icon={(c) => <FileSignature size={16} color={c} />} />
        <StatTile label="Pickups this month" value={pickups.filter((r) => r.date.startsWith(month)).length} hint={`${pickups.length} on record`} tone="info" icon={(c) => <ClipboardList size={16} color={c} />} />
        <StatTile label="Pre-existing damage" value={preExisting} hint="Marks recorded at pickup" tone="warning" icon={(c) => <Wrench size={16} color={c} />} />
      </Grid>
      {needAgreement > 0 ? (
        <Card tone="highlight" style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <FileSignature size={18} color={colors.onHighlight} />
          <Text style={[styles.strong, { flex: 1, minWidth: 180, color: colors.onHighlight }]}>
            {needAgreement} confirmed booking{needAgreement > 1 ? 's need' : ' needs'} a signed agreement before pickup inspection.
          </Text>
          <Button label="Open agreements" variant="outline" size="sm" onPress={() => router.push('/agreements')} />
        </Card>
      ) : null}
      <Queue
        title="Due for pickup inspection"
        subtitle="Confirmed bookings with a signed agreement — inspect before handing over the keys"
        type="Pickup"
        items={due}
        emptyMsg="No confirmed bookings are waiting for handover."
      />
    </View>
  );
}

export function ReturnInspectionTab() {
  const { cols } = useResponsive();
  const { bookings, inspections, today } = useApp();
  const due = useMemo(() => bookings.filter((b) => b.status === 'Active' && !b.returnInspectionId), [bookings]);
  const overdue = due.filter((b) => isOverdue(b, today)).length;
  const settle = bookings.filter((b) => b.status === 'Active' && !!b.returnInspectionId);
  const returns = inspections.filter((r) => r.type === 'Return');
  const damageTotal = returns.reduce((s, r) => s + r.estimatedDamageCost, 0);
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);

  return (
    <View>
      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Due for return" value={due.length} hint="Vehicles on rent" emphasis icon={(c) => <LogIn size={16} color={c} />} />
        <StatTile label="Overdue" value={overdue} tone={overdue ? 'danger' : 'success'} hint={overdue ? 'Past the return date' : 'All on time'} icon={(c) => <AlertTriangle size={16} color={c} />} />
        <StatTile label="Awaiting settlement" value={settle.length} hint="Return inspection done" tone="info" icon={(c) => <ClipboardCheck size={16} color={c} />} />
        <StatTile label="Damage recorded" value={formatINR(damageTotal)} hint="From return inspections" tone="danger" icon={(c) => <Wrench size={16} color={c} />} />
      </Grid>
      <Queue title="Due for return inspection" subtitle="Vehicles currently on rent — inspect on return, then settle" type="Return" items={due} emptyMsg="No vehicles are out on rent right now." />
      {settle.length ? (
        <Section title={`Awaiting settlement (${settle.length})`} subtitle="Return inspection saved — settle charges on the booking">
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {settle.map((b, i) => (
              <View key={b.id} style={[styles.queueRow, i === settle.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.strong}>{b.id}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {b.customerName} · {b.vehicleName} · damage {formatINR(b.damageCharges ?? 0)}
                  </Text>
                </View>
                <Button label="Settle rental" size="sm" variant="outline" onPress={() => router.push(`/bookings/${encodeURIComponent(b.id)}`)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strong: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    thumb: {
      width: 64,
      height: 40,
      borderRadius: 8,
      backgroundColor: colors.bg2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    queueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
  });
