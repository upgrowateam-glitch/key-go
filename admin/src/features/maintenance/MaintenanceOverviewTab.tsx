import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, CalendarClock, CheckCircle2, IndianRupee, Plus, ShieldAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, DonutChart, EmptyState, Grid, HBarChart, Section, StatTile, Tone } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { daysBetween, formatDate, formatINRCompact } from '../../lib/format';
import { loadScheduledServices } from '../../services/maintenance';
import { useResource } from '../../services/mockClient';
import type { MaintenanceReminder } from '../../types';
import { useCommonStyles } from '../agreements/listTools';
import { LogMaintenanceSheet, REMINDER_TYPES } from './LogMaintenanceSheet';

const TONE: Record<MaintenanceReminder['status'], Tone> = { Overdue: 'danger', 'Due soon': 'warning', Scheduled: 'info', Done: 'success' };

export default function MaintenanceOverviewTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { cols } = useResponsive();
  const { vehicles, maintenanceLogs, maintenanceReminders, today } = useApp();
  const scheduled = useResource(loadScheduledServices);
  const [open, setOpen] = useState(false);

  const reminders = useMemo(() => [...maintenanceReminders, ...(scheduled.data ?? [])], [maintenanceReminders, scheduled.data]);
  const counts = useMemo(() => {
    const c: Record<MaintenanceReminder['status'], number> = { Overdue: 0, 'Due soon': 0, Scheduled: 0, Done: 0 };
    reminders.forEach((r) => (c[r.status] += 1));
    return c;
  }, [reminders]);
  const totalSpend = maintenanceLogs.reduce((s, m) => s + m.cost, 0);
  const byVehicle = useMemo(() => {
    const map = new Map<string, { label: string; sublabel: string; value: number }>();
    maintenanceLogs.forEach((m) => {
      const cur = map.get(m.vehicleId) ?? { label: m.vehicleName, sublabel: m.vehicleNumber, value: 0 };
      cur.value += m.cost;
      map.set(m.vehicleId, cur);
    });
    return [...map.values()].sort((a, b) => b.value - a.value);
  }, [maintenanceLogs]);
  const byCategory = useMemo(
    () => REMINDER_TYPES.map((t) => ({ label: t, value: maintenanceLogs.filter((m) => m.category === t).reduce((s, m) => s + m.cost, 0) })).filter((i) => i.value > 0),
    [maintenanceLogs]
  );
  const upcoming = reminders
    .filter((r) => r.status !== 'Done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const expiring = vehicles.filter((v) => v.status !== 'Sold').flatMap((v) => [v.insuranceExpiry, v.pucExpiry]).filter((d) => daysBetween(today, d) <= 30).length;

  if (scheduled.error) return <ResourceState error={scheduled.error} onRetry={scheduled.reload} />;
  if (scheduled.loading && !scheduled.data) return <ResourceState loading />;

  return (
    <View>
      <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
        <Button label="Log maintenance" icon={(c) => <Plus size={16} color={c} />} onPress={() => setOpen(true)} />
      </View>
      <Grid cols={cols(2, 3, 5)}>
        <StatTile label="Maintenance spend" value={formatINRCompact(totalSpend)} hint={`${maintenanceLogs.length} records`} emphasis icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Overdue" value={counts.Overdue} tone="danger" hint="Needs action now" icon={(c) => <AlertTriangle size={16} color={c} />} onPress={() => router.replace('/maintenance?tab=service-schedule')} />
        <StatTile label="Due soon" value={counts['Due soon']} tone="warning" hint="Within the next few weeks" icon={(c) => <CalendarClock size={16} color={c} />} onPress={() => router.replace('/maintenance?tab=service-schedule')} />
        <StatTile label="Scheduled" value={counts.Scheduled} tone="info" hint={`${counts.Done} done`} icon={(c) => <CheckCircle2 size={16} color={c} />} onPress={() => router.replace('/maintenance?tab=service-schedule')} />
        <StatTile label="Renewals in 30 days" value={expiring} tone={expiring ? 'warning' : 'success'} hint="Insurance and PUC" icon={(c) => <ShieldAlert size={16} color={c} />} onPress={() => router.replace('/maintenance?tab=renewal-reminders')} />
      </Grid>

      <Section title="Next up" subtitle="The five nearest open reminders">
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {upcoming.length === 0 ? (
            <EmptyState compact title="Nothing due" message="New reminders appear as vehicles approach service intervals." />
          ) : (
            upcoming.map((r) => {
              const v = vehicles.find((x) => x.id === r.vehicleId);
              return (
                <View key={r.id} style={styles.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.strong}>{r.type}</Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {v ? `${v.name} · ${v.vehicleNumber}` : r.vehicleId} · {formatDate(r.dueDate)}
                    </Text>
                  </View>
                  <Badge label={r.status} tone={TONE[r.status]} />
                </View>
              );
            })
          )}
        </Card>
      </Section>

      <Section title="Maintenance cost" subtitle="All recorded maintenance, including scheduled work">
        <Grid cols={cols(1, 2, 2)}>
          <Card>
            <Text style={styles.chartTitle}>By vehicle</Text>
            {byVehicle.length ? <HBarChart items={byVehicle} formatValue={formatINRCompact} /> : <EmptyState compact title="No costs yet" />}
          </Card>
          <Card>
            <Text style={styles.chartTitle}>By category</Text>
            {byCategory.length ? <DonutChart items={byCategory} centerValue={formatINRCompact(totalSpend)} centerLabel="total" formatValue={formatINRCompact} /> : <EmptyState compact title="No costs yet" />}
          </Card>
        </Grid>
      </Section>

      <LogMaintenanceSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
