import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CalendarClock, ShieldCheck } from 'lucide-react-native';
import { Badge, Button, ChipGroup, Column, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, Section, SegmentedControl, StatTile, Tone } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { addDays, daysBetween, formatDate, formatINR } from '../../lib/format';
import type { MaintenanceReminderType, Vehicle } from '../../types';
import { FilterGroup, ISO_DATE, ListToolbar, Pager, parseAmount, useCommonStyles, usePaged } from '../agreements/listTools';

const DOC_FILTERS = ['All', 'Insurance', 'PUC'] as const;
type DocFilter = (typeof DOC_FILTERS)[number];
type RenewalState = 'Expired' | 'Due soon' | 'Valid';
const STATE_FILTERS = ['All', 'Expired', 'Due soon', 'Valid'] as const;
type StateFilter = (typeof STATE_FILTERS)[number];
const STATE_TONE: Record<RenewalState, Tone> = { Expired: 'danger', 'Due soon': 'warning', Valid: 'success' };
const DUE_SOON_DAYS = 30;

interface RenewalRow {
  key: string;
  vehicle: Vehicle;
  doc: Exclude<DocFilter, 'All'>;
  reference: string;
  provider: string;
  expiry: string;
  daysLeft: number;
  state: RenewalState;
}
interface RenewForm {
  row: RenewalRow;
  expiry: string;
  reference: string;
  cost: string;
}
type Errors = Partial<Record<'expiry' | 'reference' | 'cost', string>>;

const reminderType = (doc: RenewalRow['doc']): MaintenanceReminderType => (doc === 'Insurance' ? 'Insurance renewal' : 'Emission renewal');

export default function RenewalRemindersTab() {
  const styles = useCommonStyles();
  const { cols, isPhone } = useResponsive();
  const { vehicles, maintenanceReminders, completeReminder, updateVehicle, addMaintenanceRecord, showToast, today } = useApp();

  const [query, setQuery] = useState('');
  const [doc, setDoc] = useState<DocFilter>('All');
  const [state, setState] = useState<StateFilter>('All');
  const [form, setForm] = useState<RenewForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const rows = useMemo<RenewalRow[]>(() => {
    const row = (vehicle: Vehicle, d: RenewalRow['doc'], reference: string, provider: string, expiry: string): RenewalRow => {
      const daysLeft = daysBetween(today, expiry);
      return { key: `${vehicle.id}:${d}`, vehicle, doc: d, reference, provider, expiry, daysLeft, state: daysLeft < 0 ? 'Expired' : daysLeft <= DUE_SOON_DAYS ? 'Due soon' : 'Valid' };
    };
    return vehicles
      .filter((v) => v.status !== 'Sold')
      .flatMap((v) => [row(v, 'Insurance', v.insurancePolicyNo, v.insuranceProvider, v.insuranceExpiry), row(v, 'PUC', v.pucCertificateNo, 'PUC certificate', v.pucExpiry)])
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [vehicles, today]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (doc === 'All' || r.doc === doc) &&
        (state === 'All' || r.state === state) &&
        (!q || [r.vehicle.name, r.vehicle.vehicleNumber, r.reference, r.provider].some((s) => s.toLowerCase().includes(q)))
    );
  }, [rows, doc, state, query]);
  const paged = usePaged(filtered, `${doc}|${state}|${query}`);

  const filtersActive = doc !== 'All' || state !== 'All' || !!query;
  const reset = () => {
    setDoc('All');
    setState('All');
    setQuery('');
  };
  const openRenew = (row: RenewalRow) => {
    setErrors({});
    // Renew from the old expiry, or from today when it has already lapsed.
    const base = row.daysLeft < 0 ? today : row.expiry;
    setForm({ row, expiry: addDays(base, row.doc === 'Insurance' ? 365 : 180), reference: row.reference, cost: '' });
  };
  const submit = () => {
    if (!form) return;
    const e: Errors = {};
    const cost = form.cost.trim() ? parseAmount(form.cost) : 0;
    if (!ISO_DATE.test(form.expiry)) e.expiry = 'Use YYYY-MM-DD';
    else if (daysBetween(today, form.expiry) <= 0) e.expiry = 'The new expiry must be in the future';
    if (form.reference.trim().length < 3) e.reference = form.row.doc === 'Insurance' ? 'Enter the policy number' : 'Enter the certificate number';
    if (!(cost >= 0)) e.cost = 'Enter a number';
    setErrors(e);
    if (Object.keys(e).length) return;
    const { vehicle, doc: d } = form.row;
    updateVehicle(
      vehicle.id,
      d === 'Insurance' ? { insuranceExpiry: form.expiry, insurancePolicyNo: form.reference.trim() } : { pucExpiry: form.expiry, pucCertificateNo: form.reference.trim() }
    );
    maintenanceReminders.filter((r) => r.vehicleId === vehicle.id && r.type === reminderType(d) && r.status !== 'Done').forEach((r) => completeReminder(r.id));
    if (cost > 0) {
      addMaintenanceRecord({
        id: `MNT-${Math.floor(500 + Math.random() * 9000)}`,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        vehicleNumber: vehicle.vehicleNumber,
        serviceType: d === 'Insurance' ? 'Insurance renewal' : 'PUC emission test',
        category: reminderType(d),
        cost: Math.round(cost),
        vendorName: d === 'Insurance' ? form.row.provider : 'PUC centre',
        date: today,
        status: 'Completed',
        nextServiceKm: 0,
      });
    }
    showToast(`${d} renewed for ${vehicle.vehicleNumber}`);
    setForm(null);
  };

  const columns: Column<RenewalRow>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.4,
      minWidth: 170,
      render: (r) => (
        <View>
          <Text style={styles.strong} numberOfLines={1}>
            {r.vehicle.name}
          </Text>
          <Text style={styles.sub}>{r.vehicle.vehicleNumber}</Text>
        </View>
      ),
    },
    { key: 'doc', label: 'Document', flex: 0.7, minWidth: 90, render: (r) => <Badge label={r.doc} tone={r.doc === 'Insurance' ? 'info' : 'violet'} /> },
    {
      key: 'reference',
      label: 'Reference',
      flex: 1.3,
      minWidth: 150,
      render: (r) => (
        <View>
          <Text style={styles.body} numberOfLines={1}>
            {r.reference}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {r.provider}
          </Text>
        </View>
      ),
    },
    { key: 'expiry', label: 'Expiry', flex: 0.8, minWidth: 110, value: (r) => formatDate(r.expiry) },
    { key: 'left', label: 'Days left', flex: 0.7, minWidth: 90, align: 'right', value: (r) => (r.daysLeft < 0 ? `${-r.daysLeft} overdue` : r.daysLeft) },
    { key: 'state', label: 'Status', flex: 0.7, minWidth: 90, render: (r) => <Badge label={r.state} tone={STATE_TONE[r.state]} /> },
    { key: 'action', label: 'Action', flex: 0.7, minWidth: 100, render: (r) => <Button label="Renew" size="sm" variant={r.state === 'Valid' ? 'ghost' : 'outline'} onPress={() => openRenew(r)} /> },
  ];

  return (
    <View>
      <Grid cols={cols(1, 3, 3)}>
        <StatTile label="Expired" value={rows.filter((r) => r.state === 'Expired').length} tone="danger" hint="Do not rent out until renewed" icon={(c) => <AlertTriangle size={16} color={c} />} onPress={() => setState('Expired')} />
        <StatTile label={`Due in ${DUE_SOON_DAYS} days`} value={rows.filter((r) => r.state === 'Due soon').length} tone="warning" icon={(c) => <CalendarClock size={16} color={c} />} onPress={() => setState('Due soon')} />
        <StatTile label="Valid" value={rows.filter((r) => r.state === 'Valid').length} tone="success" icon={(c) => <ShieldCheck size={16} color={c} />} onPress={() => setState('Valid')} />
      </Grid>

      <Section title="Insurance and PUC renewals" subtitle="Soonest expiry first. Renewing updates the vehicle and closes any matching reminder.">
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle, number, policy or provider" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Document">
            <SegmentedControl options={DOC_FILTERS} value={doc} onChange={setDoc} />
          </FilterGroup>
          <FilterGroup label="Status">
            <ChipGroup options={STATE_FILTERS} value={state} onChange={setState} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(r) => r.key}
          empty={
            <EmptyState
              compact
              title={rows.length ? 'No renewals match' : 'No vehicles'}
              message={rows.length ? 'Try another search or filter.' : 'Add vehicles to track their renewals.'}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          }
        />
        <Pager paged={paged} />
      </Section>

      <FormSheet
        visible={!!form}
        title={form ? `Renew ${form.row.doc === 'PUC' ? 'PUC' : 'insurance'}` : ''}
        onClose={() => setForm(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setForm(null)} />
            <Button label="Save renewal" onPress={submit} />
          </>
        }>
        {form ? (
          <>
            <Text style={styles.title}>
              {form.row.vehicle.name} · {form.row.vehicle.vehicleNumber}
            </Text>
            <Text style={[styles.sub, { marginBottom: 14 }]}>Current expiry {formatDate(form.row.expiry)}</Text>
            <FormRow>
              <Field label="New expiry" required value={form.expiry} onChangeText={(expiry) => setForm({ ...form, expiry })} placeholder="YYYY-MM-DD" error={errors.expiry} />
              <Field label={form.row.doc === 'Insurance' ? 'Policy number' : 'Certificate number'} required value={form.reference} onChangeText={(reference) => setForm({ ...form, reference })} error={errors.reference} />
            </FormRow>
            <Field label="Renewal cost (₹)" keyboardType="number-pad" value={form.cost} onChangeText={(cost) => setForm({ ...form, cost })} placeholder="Optional" hint={form.cost && parseAmount(form.cost) > 0 ? `${formatINR(Math.round(parseAmount(form.cost)))} will be logged as a maintenance expense` : 'Leave empty to skip logging a cost'} error={errors.cost} />
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}
