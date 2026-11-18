import { useRouter } from '@/shims/expo-router';
import { Bell, Plus, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, ChipGroup, Column, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, ListRow, Section, StatTile, StatusBadge } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate, formatINR, formatKm } from '../../../lib/format';
import { useThemedStyles } from '../../../theme';
import { MaintenanceRecord, MaintenanceReminder, MaintenanceReminderType, Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { ListPager, usePaged } from '../ListPager';
import { ISO_DATE, num } from '../shared';

const CATEGORIES: readonly MaintenanceReminderType[] = ['Service', 'Oil change', 'Brake pad', 'Insurance renewal', 'Emission renewal'];
const STATUSES: readonly MaintenanceRecord['status'][] = ['Scheduled', 'In Progress', 'Completed'];
const STATUS_FILTERS = ['All', ...STATUSES] as const;

const COLUMNS: Column<MaintenanceRecord>[] = [
  { key: 'date', label: 'Date', flex: 0.8, minWidth: 100, value: (r) => formatDate(r.date) },
  { key: 'service', label: 'Service', flex: 2, minWidth: 220, value: (r) => r.serviceType },
  { key: 'vendor', label: 'Vendor', flex: 1.4, minWidth: 160, value: (r) => r.vendorName },
  { key: 'next', label: 'Next at', flex: 0.8, minWidth: 100, align: 'right', value: (r) => (r.nextServiceKm ? formatKm(r.nextServiceKm) : '—') },
  { key: 'cost', label: 'Cost', flex: 0.8, minWidth: 90, align: 'right', value: (r) => formatINR(r.cost) },
  { key: 'status', label: 'Status', flex: 0.9, minWidth: 110, render: (r) => <StatusBadge status={r.status} /> },
];

export function MaintenanceTab({ v }: { v: Vehicle }) {
  const router = useRouter();
  const { cols } = useResponsive();
  const { maintenanceLogs, maintenanceReminders, completeReminder } = useApp();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('All');
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState<MaintenanceReminder | null>(null);

  const logs = maintenanceLogs.filter((m) => m.vehicleId === v.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const reminders = maintenanceReminders.filter((r) => r.vehicleId === v.id && r.status !== 'Done').sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const paged = usePaged(logs.filter((m) => status === 'All' || m.status === status));
  const spent = logs.filter((m) => m.status === 'Completed').reduce((s, m) => s + m.cost, 0);
  const next = logs.map((m) => m.nextServiceKm).find((km) => km > 0);

  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label="Maintenance spend" value={formatINR(spent)} tone="primary" icon={(c) => <Wrench size={16} color={c} />} hint="Completed work" />
        <StatTile label="Service records" value={logs.length} tone="neutral" />
        <StatTile label="Open reminders" value={reminders.length} tone={reminders.length ? 'warning' : 'success'} icon={(c) => <Bell size={16} color={c} />} />
        <StatTile label="Next service at" value={next ? formatKm(next) : '—'} tone="info" hint={`Now ${formatKm(v.odometerKm)}`} />
      </Grid>

      <Section title="Reminders" style={{ marginTop: 8 }}>
        <Card style={{ paddingVertical: 4 }}>
          {reminders.length === 0 ? (
            <EmptyState compact title="No open reminders" message="Service and renewal reminders for this vehicle appear here." />
          ) : (
            reminders.map((r, i) => (
              <ListRow
                key={r.id}
                title={r.type}
                subtitle={`Due ${formatDate(r.dueDate)}${r.dueKm ? ` or at ${formatKm(r.dueKm)}` : ''}`}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <StatusBadge status={r.status} />
                    <Button label="Mark done" variant="ghost" size="sm" onPress={() => setCompleting(r)} />
                  </View>
                }
                style={i === reminders.length - 1 ? { borderBottomWidth: 0 } : undefined}
              />
            ))
          )}
        </Card>
      </Section>

      <Section
        title="Maintenance history"
        subtitle={`${logs.length} record${logs.length === 1 ? '' : 's'}`}
        action={
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="All maintenance" variant="ghost" size="sm" onPress={() => router.push('/maintenance' as any)} />
            {v.status === 'Sold' ? null : <Button label="Add record" variant="outline" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setAdding(true)} />}
          </View>
        }>
        <View style={{ marginBottom: 10 }}>
          <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll />
        </View>
        <DataTable columns={COLUMNS} rows={paged.rows} rowKey={(r) => r.id} empty={<EmptyState compact title="No maintenance records" message="Add a record when this vehicle is serviced." />} />
        <ListPager paged={paged} />
      </Section>

      {adding ? <RecordSheet v={v} onClose={() => setAdding(false)} /> : null}
      <ConfirmDialog
        visible={completing !== null}
        title="Mark this reminder as done?"
        message={completing ? `${completing.type}, due ${formatDate(completing.dueDate)}, will be closed.` : undefined}
        confirmLabel="Mark done"
        onConfirm={() => {
          if (completing) completeReminder(completing.id);
          setCompleting(null);
        }}
        onCancel={() => setCompleting(null)}
      />
    </View>
  );
}

function RecordSheet({ v, onClose }: { v: Vehicle; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { today, addMaintenanceRecord } = useApp();
  const [serviceType, setServiceType] = useState('');
  const [category, setCategory] = useState<MaintenanceReminderType>('Service');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(today);
  const [cost, setCost] = useState('');
  const [nextKm, setNextKm] = useState('');
  const [status, setStatus] = useState<MaintenanceRecord['status']>('Completed');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const submit = () => {
    const e: Record<string, string | undefined> = {};
    if (!serviceType.trim()) e.serviceType = 'Describe the work';
    if (!vendor.trim()) e.vendor = 'Enter the vendor';
    if (!ISO_DATE.test(date)) e.date = 'Use YYYY-MM-DD';
    if (!(num(cost) >= 0)) e.cost = 'Enter the cost';
    if (nextKm && !(num(nextKm) >= 0)) e.nextKm = 'Enter a number';
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    addMaintenanceRecord({
      id: `MNT-${Date.now().toString(36).toUpperCase()}`,
      vehicleId: v.id,
      vehicleName: v.name,
      vehicleNumber: v.vehicleNumber,
      serviceType: serviceType.trim(),
      category,
      cost: Math.round(num(cost)),
      vendorName: vendor.trim(),
      date,
      status,
      nextServiceKm: nextKm ? Math.round(num(nextKm)) : 0,
    });
    onClose();
  };

  return (
    <FormSheet
      visible
      title={`Add record · ${v.vehicleNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} />
          <Button label="Add record" onPress={submit} />
        </>
      }>
      <Field label="Work done" required value={serviceType} onChangeText={setServiceType} placeholder="e.g. Engine oil & filter change" error={errors.serviceType} />
      <Text style={styles.label}>Category</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={CATEGORIES} value={category} onChange={setCategory} />
      </View>
      <Text style={styles.label}>Status</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={STATUSES} value={status} onChange={setStatus} />
      </View>
      <FormRow>
        <Field label="Vendor" required value={vendor} onChangeText={setVendor} error={errors.vendor} />
        <Field label="Date" required value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={errors.date} />
      </FormRow>
      <FormRow>
        <Field label="Cost (₹)" required value={cost} onChangeText={setCost} keyboardType="number-pad" error={errors.cost} />
        <Field label="Next service at (km)" value={nextKm} onChangeText={setNextKm} keyboardType="number-pad" placeholder="Optional" error={errors.nextKm} />
      </FormRow>
    </FormSheet>
  );
}
