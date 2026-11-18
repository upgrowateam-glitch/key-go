import React, { ReactNode, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, Grid, ListRow, StatTile, toneColors, type Tone } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles } from '../../theme';
import { daysBetween, formatDate, formatINR } from '../../lib/format';
import { isOverdue, reminderState } from '../../lib/lifecycle';
import type { MaintenanceReminder, MaintenanceReminderType, NotificationType, Vehicle } from '../../types';
import { dueBadge, makeStyles, TYPE_META } from './shared';

const EMI_DUE_DATE = '2026-10-01';
const RENEWAL_WINDOW_DAYS = 60;

const REMINDER_FILTERS = ['All', 'Booking', 'Pickup', 'Return', 'Insurance', 'PUC', 'Service', 'EMI'] as const;
type ReminderFilter = (typeof REMINDER_FILTERS)[number];

interface RenewalItem {
  id: string;
  vehicle: Vehicle;
  dueDate: string;
  detail: string;
}

export default function RemindersTab() {
  const { bookings, vehicles, maintenanceReminders, today, completeReminder } = useApp();
  const { cols } = useResponsive();
  const colors = useThemeColors();
  const [filter, setFilter] = useState<ReminderFilter>('All');
  const [query, setQuery] = useState('');
  const [completing, setCompleting] = useState<MaintenanceReminder | null>(null);
  const q = query.trim().toLowerCase();
  const hit = (...parts: (string | undefined)[]) => !q || parts.join(' ').toLowerCase().includes(q);
  const show = (key: ReminderFilter) => filter === 'All' || filter === key;

  const bookingReminders = useMemo(
    () =>
      bookings
        .map((b) => ({ b, state: reminderState(b, today) }))
        .filter((x) => x.state !== 'none' && x.b.status !== 'Cancelled' && x.b.status !== 'Completed')
        .sort((a, b) => (a.b.pickupDate < b.b.pickupDate ? -1 : 1)),
    [bookings, today]
  );

  const returns = useMemo(
    () => bookings.filter((b) => b.status === 'Active').sort((a, b) => (a.returnDate < b.returnDate ? -1 : 1)),
    [bookings]
  );

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const renewals = (field: 'insuranceExpiry' | 'pucExpiry', reminderType: MaintenanceReminderType): RenewalItem[] => {
    const map = new Map<string, RenewalItem>();
    vehicles
      .filter((v) => v.status !== 'Sold')
      .forEach((v) => {
        if (field === 'pucExpiry' && v.pucCertificateNo.toLowerCase().startsWith('exempt')) return;
        const due = v[field];
        if (daysBetween(today, due) <= RENEWAL_WINDOW_DAYS) {
          map.set(v.id, {
            id: `${field}-${v.id}`,
            vehicle: v,
            dueDate: due,
            detail: field === 'insuranceExpiry' ? `${v.insuranceProvider} · ${v.insurancePolicyNo}` : `PUC ${v.pucCertificateNo}`,
          });
        }
      });
    maintenanceReminders
      .filter((r) => r.type === reminderType && r.status !== 'Done')
      .forEach((r) => {
        const v = vehicleById.get(r.vehicleId);
        if (!v || v.status === 'Sold') return;
        const existing = map.get(v.id);
        if (existing && existing.dueDate <= r.dueDate) return;
        if (!existing && daysBetween(today, r.dueDate) > RENEWAL_WINDOW_DAYS) return;
        map.set(v.id, {
          id: r.id,
          vehicle: v,
          dueDate: r.dueDate,
          detail: field === 'insuranceExpiry' ? `${v.insuranceProvider} · ${v.insurancePolicyNo}` : `PUC ${v.pucCertificateNo}`,
        });
      });
    return Array.from(map.values()).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  };

  const hitVehicle = (r: RenewalItem) => hit(r.vehicle.name, r.vehicle.vehicleNumber, r.detail);
  const insurance = renewals('insuranceExpiry', 'Insurance renewal').filter(hitVehicle);
  const emission = renewals('pucExpiry', 'Emission renewal').filter(hitVehicle);
  const confirmations = bookings
    .filter((b) => (b.status === 'Quoted' || b.status === 'Pending') && hit(b.customerName, b.vehicleName, b.id))
    .sort((a, b) => (a.pickupDate < b.pickupDate ? -1 : 1));
  const pickups = bookingReminders.filter((x) => hit(x.b.customerName, x.b.vehicleName, x.b.id));
  const dueReturns = returns.filter((b) => hit(b.customerName, b.vehicleName, b.id, b.vehicleNumber));

  const service = maintenanceReminders
    .filter((r) => (r.type === 'Oil change' || r.type === 'Brake pad' || r.type === 'Service') && r.status !== 'Done')
    .filter((r) => hit(r.type, vehicleById.get(r.vehicleId)?.name, vehicleById.get(r.vehicleId)?.vehicleNumber))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));

  const emiVehicles = vehicles.filter((v) => v.loanDetails && v.status !== 'Sold' && hit(v.name, v.vehicleNumber, v.loanDetails.bankName));
  const emiTotal = emiVehicles.reduce((s, v) => s + (v.loanDetails?.emiAmount ?? 0), 0);

  return (
    <View>
      <Grid cols={cols(2, 4, 7)}>
        <StatTile label="Booking" value={confirmations.length} tone="primary" icon={(c) => TYPE_META.booking.icon(c)} />
        <StatTile label="Pickup" value={pickups.length} tone="primary" icon={(c) => TYPE_META.booking.icon(c)} />
        <StatTile label="Returns" value={dueReturns.length} tone="violet" icon={(c) => TYPE_META.return.icon(c)} />
        <StatTile label="Insurance" value={insurance.length} tone="info" icon={(c) => TYPE_META.insurance.icon(c)} />
        <StatTile label="PUC" value={emission.length} tone="success" icon={(c) => TYPE_META.emission.icon(c)} />
        <StatTile label="Service" value={service.length} tone="warning" icon={(c) => TYPE_META.service.icon(c)} />
        <StatTile label="EMI due 1 Oct" value={emiVehicles.length} tone="warm" icon={(c) => TYPE_META.emi.icon(c)} />
      </Grid>

      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Search customer, vehicle or booking" left={<Search size={16} color={colors.muted} />} style={{ marginBottom: 10 }} />
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={REMINDER_FILTERS} value={filter} onChange={setFilter} scroll />
      </View>

      <Grid cols={cols(1, 1, filter === 'All' ? 2 : 1)} gap={16}>
        {show('Booking') ? <ReminderCard title="Booking reminders" subtitle="Quotes and pending bookings waiting for confirmation" type="booking" count={confirmations.length}>
          {confirmations.map((b) => (
            <ListRow
              key={b.id}
              title={`${b.customerName} · ${b.vehicleName}`}
              subtitle={`${b.id} · ${b.status}\nPickup ${formatDate(b.pickupDate)}, ${b.pickupTime}`}
              right={<Badge label={b.status} tone="warning" />}
            />
          ))}
        </ReminderCard> : null}

        {show('Pickup') ? <ReminderCard title="Pickup reminders" subtitle="Pickup reminder is sent 2 days before pickup (T-2)" type="booking" count={pickups.length}>
          {pickups.map(({ b, state }) => (
            <ListRow
              key={b.id}
              title={`${b.customerName} · ${b.vehicleName}`}
              subtitle={`${b.id} · Pickup ${formatDate(b.pickupDate)}, ${b.pickupTime}\nT-2 reminder ${b.reminderScheduledFor ? formatDate(b.reminderScheduledFor) : '—'}`}
              right={<Badge label={state === 'sent' ? 'Sent' : 'Scheduled'} tone={state === 'sent' ? 'success' : 'info'} />}
            />
          ))}
        </ReminderCard> : null}

        {show('Return') ? <ReminderCard title="Return reminders" subtitle="Active rentals and their return times" type="return" count={dueReturns.length}>
          {dueReturns.map((b) => {
            const overdue = isOverdue(b, today);
            const badge = overdue ? { label: 'Overdue', tone: 'danger' as Tone } : dueBadge(today, b.returnDate);
            return (
              <ListRow
                key={b.id}
                title={`${b.customerName} · ${b.vehicleName}`}
                subtitle={`${b.id} · ${b.vehicleNumber}\nReturn ${formatDate(b.returnDate)}, ${b.returnTime}`}
                right={<Badge label={badge.label} tone={badge.tone} />}
              />
            );
          })}
        </ReminderCard> : null}

        {show('Insurance') ? <ReminderCard title="Insurance renewal" subtitle={`Policies expired or expiring within ${RENEWAL_WINDOW_DAYS} days`} type="insurance" count={insurance.length}>
          {insurance.map((r) => {
            const badge = dueBadge(today, r.dueDate);
            return (
              <ListRow
                key={r.id}
                title={`${r.vehicle.name} · ${r.vehicle.vehicleNumber}`}
                subtitle={`${r.detail}\nExpires ${formatDate(r.dueDate)}`}
                right={<Badge label={badge.label} tone={badge.tone} />}
              />
            );
          })}
        </ReminderCard> : null}

        {show('PUC') ? <ReminderCard title="PUC renewal" subtitle={`Certificates expired or expiring within ${RENEWAL_WINDOW_DAYS} days`} type="emission" count={emission.length}>
          {emission.map((r) => {
            const badge = dueBadge(today, r.dueDate);
            return (
              <ListRow
                key={r.id}
                title={`${r.vehicle.name} · ${r.vehicle.vehicleNumber}`}
                subtitle={`${r.detail}\nExpires ${formatDate(r.dueDate)}`}
                right={<Badge label={badge.label} tone={badge.tone} />}
              />
            );
          })}
        </ReminderCard> : null}

        {show('Service') ? <ReminderCard title="Service reminders" subtitle="Oil change, brake pads and periodic service" type="service" count={service.length}>
          {service.map((r) => {
            const v = vehicleById.get(r.vehicleId);
            const badge = dueBadge(today, r.dueDate);
            const kmPart = r.dueKm ? ` or ${r.dueKm.toLocaleString('en-IN')} km${v ? ` (now ${v.odometerKm.toLocaleString('en-IN')} km)` : ''}` : '';
            return (
              <ListRow
                key={r.id}
                title={`${r.type} · ${v?.name ?? r.vehicleId}`}
                subtitle={`${v?.vehicleNumber ?? ''}\nDue ${formatDate(r.dueDate)}${kmPart}`}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Badge label={badge.label} tone={badge.tone} />
                    <Button label="Mark done" size="sm" variant="ghost" onPress={() => setCompleting(r)} />
                  </View>
                }
              />
            );
          })}
        </ReminderCard> : null}

        {show('EMI') ? <ReminderCard
          title="Loan EMI"
          subtitle={`Next EMI due ${formatDate(EMI_DUE_DATE)} · total ${formatINR(emiTotal)}`}
          type="emi"
          count={emiVehicles.length}>
          {emiVehicles.map((v) => {
            const loan = v.loanDetails!;
            const badge = dueBadge(today, EMI_DUE_DATE);
            return (
              <ListRow
                key={v.id}
                title={`${v.name} · ${formatINR(loan.emiAmount)}`}
                subtitle={`${loan.bankName} · ${loan.accountNo}\n${loan.paidMonths}/${loan.tenureMonths} paid · due ${formatDate(EMI_DUE_DATE)}`}
                right={<Badge label={badge.label} tone={badge.tone} />}
              />
            );
          })}
        </ReminderCard> : null}
      </Grid>
      <ConfirmDialog
        visible={!!completing}
        title={`Mark ${completing?.type ?? 'reminder'} as done?`}
        message={`${completing ? vehicleById.get(completing.vehicleId)?.name ?? '' : ''} will no longer show this reminder.`}
        confirmLabel="Mark done"
        onCancel={() => setCompleting(null)}
        onConfirm={() => {
          if (completing) completeReminder(completing.id);
          setCompleting(null);
        }}
      />
    </View>
  );
}

function ReminderCard({
  title,
  subtitle,
  type,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  type: NotificationType;
  count: number;
  children: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const meta = TYPE_META[type];
  const tc = toneColors(colors, meta.tone);
  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={[styles.typeIcon, { backgroundColor: tc.bg, borderColor: tc.border }]}>{meta.icon(tc.text, 18)}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.meta}>{subtitle}</Text>
        </View>
        <Badge label={String(count)} tone={count > 0 ? meta.tone : 'neutral'} />
      </View>
      {count === 0 ? <EmptyState title="Nothing due" message="No reminders in this category." compact /> : children}
    </Card>
  );
}
