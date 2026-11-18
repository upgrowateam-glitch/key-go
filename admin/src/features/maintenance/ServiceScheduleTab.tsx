import { useRouter } from '@/shims/expo-router';
import { CheckCircle2, Plus, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, FormRow, FormSheet, Grid, Section, SegmentedControl, StatusBadge, Tone } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { daysBetween, formatDate, formatKm } from '../../lib/format';
import { completeScheduledService, isScheduledService, loadScheduledServices, scheduleService } from '../../services/maintenance';
import { useResource } from '../../services/mockClient';
import { useThemedStyles, type ThemeColors } from '../../theme';
import type { MaintenanceReminder, MaintenanceReminderType, Vehicle } from '../../types';
import { FilterGroup, ISO_DATE, ListToolbar, parseAmount, useCommonStyles } from '../agreements/listTools';
import { REMINDER_TYPES } from './LogMaintenanceSheet';

const TYPE_FILTERS = ['All', ...REMINDER_TYPES] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];
const BOARD_COLUMNS: MaintenanceReminder['status'][] = ['Overdue', 'Due soon', 'Scheduled', 'Done'];
const COLUMN_TONE: Record<MaintenanceReminder['status'], Tone> = { Overdue: 'danger', 'Due soon': 'warning', Scheduled: 'info', Done: 'success' };

interface ScheduleForm {
  vehicleId: string;
  type: MaintenanceReminderType;
  dueDate: string;
  dueKm: string;
}
type Errors = Partial<Record<keyof ScheduleForm, string>>;

export default function ServiceScheduleTab() {
  const common = useCommonStyles();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { vehicles, maintenanceReminders, completeReminder, showToast, today } = useApp();
  const res = useResource(loadScheduledServices);

  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('All');
  const [showDone, setShowDone] = useState<'Open' | 'Include done'>('Open');
  const [form, setForm] = useState<ScheduleForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDone, setConfirmDone] = useState<MaintenanceReminder | null>(null);

  const fleet = vehicles.filter((v) => v.status !== 'Sold');
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  const reminders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...maintenanceReminders, ...(res.data ?? [])]
      .filter((r) => type === 'All' || r.type === type)
      .map((r) => ({ ...r, vehicle: vehicleById.get(r.vehicleId) }))
      .filter((r) => !q || [r.type, r.vehicle?.name ?? '', r.vehicle?.vehicleNumber ?? ''].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [maintenanceReminders, res.data, type, query, vehicleById]);

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;

  const boardCols = showDone === 'Open' ? BOARD_COLUMNS.filter((c) => c !== 'Done') : BOARD_COLUMNS;
  const visible = reminders.filter((r) => boardCols.includes(r.status));
  const filtersActive = type !== 'All' || showDone !== 'Open' || !!query;
  const reset = () => {
    setType('All');
    setShowDone('Open');
    setQuery('');
  };
  const openForm = () => {
    setErrors({});
    setForm({ vehicleId: fleet[0]?.id ?? '', type: 'Service', dueDate: '', dueKm: '' });
  };
  const submit = () => {
    if (!form) return;
    const e: Errors = {};
    const km = form.dueKm.trim() ? parseAmount(form.dueKm) : undefined;
    if (!form.vehicleId) e.vehicleId = 'Select a vehicle';
    if (!ISO_DATE.test(form.dueDate)) e.dueDate = 'Use YYYY-MM-DD';
    else if (daysBetween(today, form.dueDate) < 0) e.dueDate = 'Pick today or a later date';
    if (km !== undefined && !(km > 0)) e.dueKm = 'Enter a km reading';
    setErrors(e);
    if (Object.keys(e).length) return;
    scheduleService({ vehicleId: form.vehicleId, type: form.type, dueDate: form.dueDate, dueKm: km }).then(
      (d) => {
        res.setData(d);
        setForm(null);
        showToast('Service scheduled');
      },
      (err: Error) => showToast(err.message)
    );
  };
  const markDone = () => {
    if (!confirmDone) return;
    if (isScheduledService(confirmDone.id)) {
      completeScheduledService(confirmDone.id).then(
        (d) => {
          res.setData(d);
          showToast('Reminder marked as done');
        },
        (err: Error) => showToast(err.message)
      );
    } else {
      completeReminder(confirmDone.id);
    }
    setConfirmDone(null);
  };
  const confirmVehicle = confirmDone ? vehicleById.get(confirmDone.vehicleId) : undefined;

  return (
    <View>
      <Section
        title="Service schedule"
        subtitle="Oil change, brake pads, service, insurance and emission renewals"
        style={{ marginTop: 0 }}
        action={<Button label="Schedule service" size="sm" icon={(c) => <Plus size={14} color={c} />} disabled={!fleet.length} onPress={openForm} />}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle, number or service type" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Type">
            <ChipGroup options={TYPE_FILTERS} value={type} onChange={setType} scroll={isPhone} />
          </FilterGroup>
          <SegmentedControl options={['Open', 'Include done'] as const} value={showDone} onChange={setShowDone} />
        </ListToolbar>
        {visible.length === 0 ? (
          <Card>
            <EmptyState
              title="No reminders"
              message={type === 'All' ? 'Nothing is due. New reminders appear as vehicles approach service intervals.' : `No open ${type.toLowerCase()} reminders.`}
              icon={(c) => <Wrench size={22} color={c} />}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          </Card>
        ) : (
          <Grid cols={isPhone ? 1 : Math.min(boardCols.length, cols(1, 2, boardCols.length))}>
            {boardCols.map((col) => {
              const items = reminders.filter((r) => r.status === col);
              return (
                <View key={col} style={styles.boardCol}>
                  <View style={styles.boardHead}>
                    <Badge label={col} tone={COLUMN_TONE[col]} />
                    <Text style={styles.boardCount}>{items.length}</Text>
                  </View>
                  {items.length === 0 ? (
                    <Text style={styles.boardEmpty}>Nothing here</Text>
                  ) : (
                    items.map((r) => (
                      <ReminderCard key={r.id} reminder={r} vehicle={r.vehicle} today={today} onDone={() => setConfirmDone(r)} onOpenVehicle={() => router.push(`/fleet/${encodeURIComponent(r.vehicleId)}`)} />
                    ))
                  )}
                </View>
              );
            })}
          </Grid>
        )}
      </Section>

      <FormSheet
        visible={!!form}
        title="Schedule service"
        onClose={() => setForm(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setForm(null)} />
            <Button label="Schedule" onPress={submit} />
          </>
        }>
        {form ? (
          <>
            <Text style={common.label}>Vehicle</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup
                options={fleet.map((v) => v.id)}
                value={form.vehicleId}
                onChange={(vehicleId) => setForm({ ...form, vehicleId })}
                labels={Object.fromEntries(fleet.map((v) => [v.id, `${v.name} · ${v.vehicleNumber}`]))}
                scroll
              />
              {errors.vehicleId ? <Text style={common.error}>{errors.vehicleId}</Text> : null}
            </View>
            <Text style={common.label}>Type</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup options={REMINDER_TYPES} value={form.type} onChange={(t) => setForm({ ...form, type: t })} />
            </View>
            <FormRow>
              <Field label="Due date" required value={form.dueDate} onChangeText={(dueDate) => setForm({ ...form, dueDate })} placeholder="YYYY-MM-DD" error={errors.dueDate} />
              <Field label="Or at odometer (km)" keyboardType="number-pad" value={form.dueKm} onChangeText={(dueKm) => setForm({ ...form, dueKm })} placeholder="Optional" error={errors.dueKm} />
            </FormRow>
          </>
        ) : null}
      </FormSheet>

      <ConfirmDialog
        visible={!!confirmDone}
        title="Mark reminder as done?"
        message={confirmDone ? `${confirmDone.type} for ${confirmVehicle ? `${confirmVehicle.name} (${confirmVehicle.vehicleNumber})` : confirmDone.vehicleId}, due ${formatDate(confirmDone.dueDate)}.` : undefined}
        confirmLabel="Mark done"
        onConfirm={markDone}
        onCancel={() => setConfirmDone(null)}
      />
    </View>
  );
}

function ReminderCard({
  reminder: r,
  vehicle,
  today,
  onDone,
  onOpenVehicle,
}: {
  reminder: MaintenanceReminder;
  vehicle?: Vehicle;
  today: string;
  onDone: () => void;
  onOpenVehicle: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const d = daysBetween(today, r.dueDate);
  const when = r.status === 'Done' ? `Due ${formatDate(r.dueDate)}` : d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`;
  return (
    <View style={styles.reminder}>
      <Text style={styles.reminderType}>{r.type}</Text>
      <Text style={styles.reminderVehicle} accessibilityRole="link" onPress={onOpenVehicle} numberOfLines={1}>
        {vehicle ? `${vehicle.name} · ${vehicle.vehicleNumber}` : r.vehicleId}
      </Text>
      <Text style={[styles.cellSub, d < 0 && r.status !== 'Done' && styles.overdueText]}>
        {when}
        {r.status !== 'Done' ? ` · ${formatDate(r.dueDate, false)}` : ''}
        {r.dueKm ? ` · or ${formatKm(r.dueKm)}` : ''}
      </Text>
      {r.status !== 'Done' ? (
        <Button label="Mark done" variant="outline" size="sm" onPress={onDone} icon={(c) => <CheckCircle2 size={14} color={c} />} style={{ marginTop: 10 }} />
      ) : (
        <View style={{ marginTop: 8 }}>
          <StatusBadge status="Done" />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    boardCol: { backgroundColor: colors.bg2, borderRadius: 16, padding: 10, gap: 8, minHeight: 120 },
    boardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 2 },
    boardCount: { color: colors.muted, fontSize: 12, fontWeight: '800' },
    boardEmpty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: 16 },
    reminder: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12 },
    reminderType: { color: colors.txt, fontSize: 14, fontWeight: '800' },
    reminderVehicle: { color: colors.primaryText, fontSize: 12, fontWeight: '700', marginTop: 3 },
    overdueText: { color: colors.danger, fontWeight: '700' },
    cellSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  });
