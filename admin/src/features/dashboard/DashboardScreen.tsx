import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, ArrowRight, CalendarCheck, Car, ClipboardList, Clock, CreditCard, Gauge, IndianRupee, Plus, TrendingDown, Wallet, Wrench } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    Badge,
    BarChart,
    Button,
    Card,
    DonutChart,
    EmptyState,
    Grid,
    HBarChart,
    ListRow,
    PageHeader,
    Screen,
    Section,
    SplitView,
    StatTile,
    StatusBadge,
} from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { addDays, daysBetween, formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { isOverdue, nextAction } from '../../lib/lifecycle';
import { EXPENSE_CATEGORIES, fetchPayments, outstandingFor } from '../../services/finance';
import { useResource } from '../../services/mockClient';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking, MaintenanceReminder } from '../../types';
import { sumCategories, totalExpense, totalIncome, TREND_MONTHS, useLedger } from '../finance/useLedger';

const UTILIZATION_DAYS = 30;
const RENEWAL_TYPES: MaintenanceReminder['type'][] = ['Insurance renewal', 'Emission renewal'];

/** Days of this booking inside the window, counting both ends. */
function occupiedDays(b: Booking, start: string, end: string) {
  const from = b.pickupDate > start ? b.pickupDate : start;
  const to = b.returnDate < end ? b.returnDate : end;
  return from > to ? 0 : daysBetween(from, to) + 1;
}

export default function OpsDashboardScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { vehicles, bookings, maintenanceReminders, today } = useApp();
  const { entries, extrasLoading, error, reload } = useLedger();
  const pay = useResource(fetchPayments);

  const fleet = vehicles.filter((v) => v.status !== 'Sold');
  const count = (s: string) => vehicles.filter((v) => v.status === s).length;
  const utilization = fleet.length ? Math.round(((count('On Rent') + count('Reserved')) / fleet.length) * 100) : 0;

  const month = today.slice(0, 7);
  const monthEntries = entries.filter((f) => f.date.startsWith(month));
  const income = totalIncome(monthEntries);
  const expense = totalExpense(monthEntries);
  const outstanding = bookings.reduce((s, b) => s + outstandingFor(b, pay.data ?? []), 0);
  const unpaidCount = bookings.filter((b) => outstandingFor(b, pay.data ?? []) > 0).length;

  // Workflow queue: every booking that is waiting on staff
  const queue = bookings
    .filter((b) => b.status !== 'Cancelled' && b.status !== 'Completed')
    .map((b) => ({ b, action: nextAction(b) }))
    .filter((x) => x.action)
    .sort((a, z) => a.b.pickupDate.localeCompare(z.b.pickupDate));

  // Alerts
  const overdue = bookings.filter((b) => isOverdue(b, today));
  const expiring = fleet.flatMap((v) => {
    const out: { id: string; text: string; tone: 'danger' | 'warning'; vehicleId: string }[] = [];
    const ins = daysBetween(today, v.insuranceExpiry);
    const puc = daysBetween(today, v.pucExpiry);
    if (ins <= 30) out.push({ id: `${v.id}-ins`, vehicleId: v.id, text: `${v.name}: insurance ${ins < 0 ? 'expired' : `expires in ${ins} days`}`, tone: ins < 0 ? 'danger' : 'warning' });
    if (puc <= 30) out.push({ id: `${v.id}-puc`, vehicleId: v.id, text: `${v.name}: PUC ${puc < 0 ? 'expired' : `expires in ${puc} days`}`, tone: puc < 0 ? 'danger' : 'warning' });
    return out;
  });
  const lowTag = fleet.filter((v) => v.fastagBalance < 500);
  const dueService = maintenanceReminders.filter((r) => r.status === 'Overdue' || r.status === 'Due soon');

  // Today and what is coming
  const live = bookings.filter((b) => b.status !== 'Cancelled');
  const todays = live.filter((b) => b.pickupDate === today || b.returnDate === today || b.createdAt === today);
  const horizon = addDays(today, 7);
  const upcomingPickups = live
    .filter((b) => (b.status === 'Confirmed' || b.status === 'Quoted' || b.status === 'Pending') && b.pickupDate >= today && b.pickupDate <= horizon)
    .sort((a, z) => a.pickupDate.localeCompare(z.pickupDate));
  const recent = bookings
    .slice()
    .sort((a, z) => z.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const openReminders = maintenanceReminders.filter((r) => r.status !== 'Done').sort((a, z) => a.dueDate.localeCompare(z.dueDate));
  const upcomingService = openReminders.filter((r) => !RENEWAL_TYPES.includes(r.type)).slice(0, 4);
  const renewals = openReminders.filter((r) => RENEWAL_TYPES.includes(r.type)).slice(0, 4);
  const vehicleName = (id: string) => vehicles.find((v) => v.id === id)?.name ?? id;

  // Share of the last 30 days each vehicle was out, from bookings on file
  const windowStart = addDays(today, -(UTILIZATION_DAYS - 1));
  const vehicleUtilization = useMemo(
    () =>
      vehicles
        .filter((v) => v.status !== 'Sold')
        .map((v) => {
          const days = bookings
            .filter((b) => b.vehicleId === v.id && (b.status === 'Active' || b.status === 'Completed'))
            .reduce((s, b) => s + occupiedDays(b, windowStart, today), 0);
          return { label: v.name, sublabel: v.vehicleNumber, value: Math.min(100, Math.round((days / UTILIZATION_DAYS) * 100)) };
        })
        .sort((a, z) => z.value - a.value),
    [vehicles, bookings, windowStart, today]
  );
  const categories = Array.from(new Set(fleet.map((v) => v.type)));
  const categoryOut = categories.map((c) => fleet.filter((v) => v.type === c && (v.status === 'On Rent' || v.status === 'Reserved')).length);
  const categoryFree = categories.map((c, i) => fleet.filter((v) => v.type === c).length - categoryOut[i]);

  const months = TREND_MONTHS.map((m) => m.key);
  const sum = (m: string, dir: 'in' | 'out') => {
    const list = entries.filter((f) => f.date.startsWith(m));
    return (dir === 'in' ? totalIncome(list) : totalExpense(list)) / 1000;
  };
  const expenseSplit = EXPENSE_CATEGORIES.map((c) => ({ label: c, value: sumCategories(monthEntries, [c]) })).filter((i) => i.value > 0);

  const open = (href: string) => router.push(href.startsWith('/') ? href : `/${href}`);
  const openBooking = (id: string) => router.push(`/bookings/${encodeURIComponent(id)}`);

  const header = (
    <PageHeader
      eyebrow="Admin & staff"
      title="Operations dashboard"
      subtitle={`Today · ${formatDate(today)}`}
      actions={
        <>
          <Button label="New booking" icon={(c) => <Plus size={16} color={c} />} onPress={() => open('/bookings?tab=create-booking')} />
          <Button label="Add vehicle" variant="outline" icon={(c) => <Car size={16} color={c} />} onPress={() => open('/fleet')} />
          <Button label="Staff punch" variant="outline" icon={(c) => <Clock size={16} color={c} />} onPress={() => open('/people?tab=attendance')} />
          <Button label="Inspect car" variant="outline" icon={(c) => <ClipboardList size={16} color={c} />} onPress={() => open('/inspections')} />
        </>
      }
    />
  );

  if (error || pay.error || extrasLoading || (pay.loading && !pay.data)) {
    return (
      <Screen>
        {header}
        <ResourceState
          loading={extrasLoading || pay.loading}
          error={error ?? pay.error}
          onRetry={() => {
            reload();
            pay.reload();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      <Section title={`Fleet · ${vehicles.length} vehicles`} subtitle="Current status of every vehicle" style={{ marginTop: 8 }}>
        <Grid cols={cols(2, 3, 5)}>
          <StatTile label="Available" value={count('Available')} tone="success" icon={(c) => <Car size={16} color={c} />} onPress={() => open('/fleet')} />
          <StatTile label="Reserved" value={count('Reserved')} tone="info" icon={(c) => <CalendarCheck size={16} color={c} />} onPress={() => open('/fleet')} />
          <StatTile label="Rented" value={count('On Rent')} hint={`${overdue.length} overdue`} tone={overdue.length ? 'danger' : 'violet'} icon={(c) => <Gauge size={16} color={c} />} onPress={() => open('/tracking')} />
          <StatTile label="Maintenance" value={count('Maintenance')} tone="warning" icon={(c) => <Wrench size={16} color={c} />} onPress={() => open('/maintenance')} />
          <StatTile label="Sold" value={count('Sold')} tone="neutral" icon={(c) => <IndianRupee size={16} color={c} />} onPress={() => open('/fleet')} />
        </Grid>
      </Section>

      <Grid cols={cols(2, 3, 5)} style={{ marginTop: 12 }}>
        <StatTile emphasis label="Fleet utilization" value={`${utilization}%`} hint={`${count('On Rent')} on rent · ${count('Reserved')} reserved`} icon={(c) => <Gauge size={16} color={c} />} />
        <StatTile label="Rental income" value={formatINRCompact(income)} hint="This month, rentals + fines" tone="primary" icon={(c) => <IndianRupee size={16} color={c} />} onPress={() => open('/finance')} />
        <StatTile label="Expenses" value={formatINRCompact(expense)} hint="This month" tone="warm" icon={(c) => <TrendingDown size={16} color={c} />} onPress={() => open('/finance?tab=expenses')} />
        <StatTile label="Outstanding payments" value={formatINRCompact(outstanding)} hint={`${unpaidCount} bookings with a balance`} tone={outstanding ? 'warning' : 'success'} icon={(c) => <Wallet size={16} color={c} />} onPress={() => open('/finance?tab=payments-and-refunds')} />
        <StatTile label="Needs attention" value={queue.length + overdue.length + expiring.length} hint="Tasks, overdue & expiries" tone="warning" icon={(c) => <AlertTriangle size={16} color={c} />} />
      </Grid>

      <SplitView
        sideWidth={400}
        main={
          <View>
            <Section title="Rental workflow queue" subtitle="Bookings waiting on the next step" action={<Button label="All bookings" size="sm" variant="ghost" onPress={() => open('/bookings')} />}>
              <Card padded={false}>
                {queue.length === 0 ? (
                  <EmptyState title="All caught up" message="No bookings are waiting on staff right now." compact />
                ) : (
                  queue.slice(0, 6).map(({ b, action }) => (
                    <TouchableOpacity key={b.id} accessibilityRole="button" style={styles.queueRow} onPress={() => router.push(action!.href)}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.queueTitle} numberOfLines={1}>
                          {b.id} · {b.customerName}
                        </Text>
                        <Text style={styles.queueSub} numberOfLines={1}>
                          {b.vehicleName} · pickup {formatDate(b.pickupDate, false)} {b.pickupTime}
                        </Text>
                      </View>
                      {!isPhone ? <StatusBadge status={b.status} /> : null}
                      <View style={styles.queueAction}>
                        <Text style={styles.queueActionText}>{action!.label}</Text>
                        <ArrowRight size={14} color={colors.primaryText} />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </Card>
            </Section>

            <Grid cols={cols(1, 2, 2)} gap={16}>
              <Section title="Today's bookings" subtitle={`Pickups, returns and new bookings · ${formatDate(today, false)}`}>
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {todays.length === 0 ? (
                    <EmptyState compact title="Nothing today" message="No pickups, returns or new bookings today." />
                  ) : (
                    todays.map((b) => (
                      <ListRow
                        key={b.id}
                        title={`${b.id} · ${b.customerName}`}
                        subtitle={b.pickupDate === today ? `Pickup ${b.pickupTime} · ${b.vehicleName}` : b.returnDate === today ? `Return ${b.returnTime} · ${b.vehicleName}` : `Booked today · ${b.vehicleName}`}
                        right={<StatusBadge status={b.status} />}
                        onPress={() => openBooking(b.id)}
                      />
                    ))
                  )}
                </Card>
              </Section>
              <Section title="Upcoming pickups" subtitle="Next 7 days">
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                  {upcomingPickups.length === 0 ? (
                    <EmptyState compact title="No pickups" message="No pickups in the next 7 days." />
                  ) : (
                    upcomingPickups.map((b) => (
                      <ListRow key={b.id} title={`${b.id} · ${b.customerName}`} subtitle={`${formatDate(b.pickupDate, false)} ${b.pickupTime} · ${b.vehicleName}`} right={<StatusBadge status={b.status} />} onPress={() => openBooking(b.id)} />
                    ))
                  )}
                </Card>
              </Section>
            </Grid>

            <Section title="Revenue vs expenses" subtitle="Last three months (₹ thousands)" action={<Button label="Finance" size="sm" variant="ghost" onPress={() => open('/finance')} />}>
              <Card>
                <BarChart
                  labels={TREND_MONTHS.map((m) => m.label)}
                  series={[
                    { name: 'Income', values: months.map((m) => Math.round(sum(m, 'in'))) },
                    { name: 'Expenses', values: months.map((m) => Math.round(sum(m, 'out'))) },
                  ]}
                  height={170}
                />
              </Card>
            </Section>

            <Section title="Vehicle utilization" subtitle={`Share of the last ${UTILIZATION_DAYS} days out on rent, from bookings on file`} action={<Button label="Tracking" size="sm" variant="ghost" onPress={() => open('/tracking?tab=utilization')} />}>
              <Grid cols={cols(1, 2, 2)} gap={16}>
                <Card>
                  {vehicleUtilization.length ? <HBarChart items={vehicleUtilization} formatValue={(v) => `${v}%`} /> : <EmptyState compact title="No vehicles" message="Add vehicles to see utilization." />}
                </Card>
                <Card>
                  <Text style={styles.queueTitle}>By category, right now</Text>
                  <Text style={[styles.queueSub, { marginBottom: 12 }]}>Vehicles on rent or reserved vs free</Text>
                  <BarChart
                    labels={categories}
                    series={[
                      { name: 'Out', values: categoryOut, color: colors.chart[0] },
                      { name: 'Free', values: categoryFree, color: colors.chart[1] },
                    ]}
                    height={150}
                  />
                </Card>
              </Grid>
            </Section>

            <Section title="Recent bookings" action={<Button label="All bookings" size="sm" variant="ghost" onPress={() => open('/bookings')} />}>
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {recent.length === 0 ? (
                  <EmptyState compact title="No bookings yet" message="New bookings will appear here." />
                ) : (
                  recent.map((b) => (
                    <ListRow key={b.id} title={`${b.id} · ${b.customerName}`} subtitle={`${b.vehicleName} · booked ${formatDate(b.createdAt, false)} · ${formatINR(b.totalAmount)}`} right={<StatusBadge status={b.status} />} onPress={() => openBooking(b.id)} />
                  ))
                )}
              </Card>
            </Section>
          </View>
        }
        side={
          <View>
            <Section title="Alerts" subtitle="Overdue returns, expiries & balances">
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {overdue.length + expiring.length + lowTag.length + dueService.length === 0 ? <EmptyState compact title="No alerts" message="Nothing needs attention right now." /> : null}
                {overdue.map((b) => (
                  <ListRow key={b.id} title={`${b.vehicleName} return overdue`} subtitle={`${b.customerName} · due ${formatDate(b.returnDate, false)} ${b.returnTime}`} right={<Badge label="Overdue" tone="danger" />} onPress={() => openBooking(b.id)} />
                ))}
                {expiring.map((e) => (
                  <ListRow key={e.id} title={e.text} right={<Badge label={e.tone === 'danger' ? 'Expired' : 'Due soon'} tone={e.tone} />} onPress={() => router.push(`/fleet/${e.vehicleId}`)} />
                ))}
                {lowTag.map((v) => (
                  <ListRow key={`${v.id}-tag`} title={`${v.name}: FASTag ${formatINR(v.fastagBalance)}`} subtitle="Balance below ₹500" left={<CreditCard size={16} color={colors.warmText} />} onPress={() => open('/fastag')} />
                ))}
                {dueService.length ? (
                  <ListRow
                    title={`${dueService.length} maintenance reminders due`}
                    subtitle="Oil, brakes, service, insurance & emission"
                    left={<ClipboardList size={16} color={colors.warmText} />}
                    onPress={() => open('/maintenance')}
                    style={{ borderBottomWidth: 0 }}
                  />
                ) : null}
              </Card>
            </Section>
            <Section title="Fleet status">
              <Card>
                <DonutChart
                  size={130}
                  centerValue={String(vehicles.length)}
                  centerLabel="vehicles"
                  items={[
                    { label: 'Available', value: count('Available'), color: colors.status.available.text },
                    { label: 'Reserved', value: count('Reserved'), color: colors.status.reserved.text },
                    { label: 'On rent', value: count('On Rent'), color: colors.status.onRent.text },
                    { label: 'Maintenance', value: count('Maintenance'), color: colors.status.maintenance.text },
                    { label: 'Sold', value: count('Sold'), color: colors.status.sold.text },
                  ]}
                />
              </Card>
            </Section>
            <Section title="Expenses this month">
              <Card>
                {expenseSplit.length ? <DonutChart size={130} items={expenseSplit} centerValue={formatINRCompact(expense)} centerLabel="Total" formatValue={formatINRCompact} /> : <EmptyState compact title="No expenses" message="Nothing recorded this month." />}
              </Card>
            </Section>
            <Section title="Upcoming maintenance" action={<Button label="Schedule" size="sm" variant="ghost" onPress={() => open('/maintenance?tab=service-schedule')} />}>
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {upcomingService.length === 0 ? (
                  <EmptyState compact title="Nothing due" message="No open service reminders." />
                ) : (
                  upcomingService.map((r) => <ReminderRow key={r.id} reminder={r} vehicle={vehicleName(r.vehicleId)} onPress={() => open('/maintenance?tab=service-schedule')} />)
                )}
              </Card>
            </Section>
            <Section title="Renewal reminders" action={<Button label="Renewals" size="sm" variant="ghost" onPress={() => open('/maintenance?tab=renewal-reminders')} />}>
              <Card padded={false} style={{ paddingHorizontal: 16 }}>
                {renewals.length === 0 ? (
                  <EmptyState compact title="Nothing due" message="No insurance or emission renewals open." />
                ) : (
                  renewals.map((r) => <ReminderRow key={r.id} reminder={r} vehicle={vehicleName(r.vehicleId)} onPress={() => open('/maintenance?tab=renewal-reminders')} />)
                )}
              </Card>
            </Section>
          </View>
        }
      />
    </Screen>
  );
}

function ReminderRow({ reminder: r, vehicle, onPress }: { reminder: MaintenanceReminder; vehicle: string; onPress: () => void }) {
  const tone = r.status === 'Overdue' ? 'danger' : r.status === 'Due soon' ? 'warning' : 'info';
  return <ListRow title={`${r.type} · ${vehicle}`} subtitle={`Due ${formatDate(r.dueDate, false)}${r.dueKm ? ` or ${r.dueKm.toLocaleString('en-IN')} km` : ''}`} right={<Badge label={r.status} tone={tone} />} onPress={onPress} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    queueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    queueTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    queueSub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    queueAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    queueActionText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '700',
    },
  });
