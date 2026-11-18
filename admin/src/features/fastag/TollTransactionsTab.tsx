import { useRouter } from '@/shims/expo-router';
import { Download, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, ChipGroup, Column, DataTable, EmptyState, Field, FormRow, FormSheet, Section } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR } from '../../lib/format';
import { addManualToll } from '../../services/fastag';
import type { FASTagLog } from '../../types';
import { downloadCsv, FilterGroup, ISO_DATE, ListToolbar, Pager, parseAmount, useCommonStyles, usePaged } from '../agreements/listTools';
import { billingState, logDateLabel, useTolls } from './useTolls';

const LOG_FILTERS = ['All', 'Unbilled', 'Billed', 'Company'] as const;
type LogFilter = (typeof LOG_FILTERS)[number];
const SORTS = ['Newest', 'Oldest', 'Highest amount'] as const;
type Sort = (typeof SORTS)[number];
const NO_BOOKING = 'none';

interface TollForm {
  vehicleNumber: string;
  plazaName: string;
  amount: string;
  date: string;
  time: string;
  bookingId: string;
}
type Errors = Partial<Record<keyof TollForm, string>>;

export default function TollTransactionsTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { vehicles, bookings, today, showToast } = useApp();
  const { logs, manual } = useTolls();

  const [query, setQuery] = useState('');
  const [logFilter, setLogFilter] = useState<LogFilter>('All');
  const [sort, setSort] = useState<Sort>('Newest');
  const [form, setForm] = useState<TollForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const vehicleByNumber = useMemo(() => new Map(vehicles.map((v) => [v.vehicleNumber, v])), [vehicles]);
  const fleet = vehicles.filter((v) => v.status !== 'Sold');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs
      .filter((l) => logFilter === 'All' || billingState(l) === logFilter)
      .filter((l) => !q || [l.id, l.plazaName, l.vehicleNumber, l.bookingId ?? '', l.customerName ?? ''].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'Highest amount' ? b.amount - a.amount : sort === 'Oldest' ? a.dateTime.localeCompare(b.dateTime) : b.dateTime.localeCompare(a.dateTime)));
  }, [logs, logFilter, query, sort]);
  const paged = usePaged(filtered, `${logFilter}|${sort}|${query}`);

  if (manual.error || (manual.loading && !manual.data)) return <ResourceState loading={manual.loading} error={manual.error} onRetry={manual.reload} />;

  const filtersActive = logFilter !== 'All' || !!query || sort !== 'Newest';
  const reset = () => {
    setLogFilter('All');
    setQuery('');
    setSort('Newest');
  };
  const openBooking = (id: string) => router.push(`/bookings/${encodeURIComponent(id)}`);
  const bookingsFor = (vehicleNumber: string) => bookings.filter((b) => b.vehicleNumber === vehicleNumber && (b.status === 'Active' || b.status === 'Completed'));

  const openForm = () => {
    setErrors({});
    setForm({ vehicleNumber: fleet[0]?.vehicleNumber ?? '', plazaName: '', amount: '', date: today, time: '', bookingId: NO_BOOKING });
  };
  const submit = () => {
    if (!form) return;
    const e: Errors = {};
    const amount = parseAmount(form.amount);
    if (!form.vehicleNumber) e.vehicleNumber = 'Select a vehicle';
    if (form.plazaName.trim().length < 3) e.plazaName = 'Enter the toll plaza';
    if (!(amount > 0)) e.amount = 'Enter an amount above zero';
    if (!ISO_DATE.test(form.date)) e.date = 'Use YYYY-MM-DD';
    if (!/^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i.test(form.time.trim())) e.time = 'Use a time like 08:30 AM';
    setErrors(e);
    if (Object.keys(e).length) return;
    const vehicle = vehicleByNumber.get(form.vehicleNumber);
    const booking = bookings.find((b) => b.id === form.bookingId);
    addManualToll({
      vehicleNumber: form.vehicleNumber,
      plazaName: form.plazaName.trim(),
      amount: Math.round(amount),
      dateTime: `${form.date} ${form.time.trim().toUpperCase()}`,
      balanceRemaining: vehicle?.fastagBalance ?? 0,
      bookingId: booking?.id,
      customerName: booking?.customerName,
    }).then(
      (d) => {
        manual.setData(d);
        setForm(null);
        showToast('Toll entry added');
      },
      (err: Error) => showToast(err.message)
    );
  };
  const exportCsv = () => {
    downloadCsv('toll-transactions.csv', [
      ['Entry', 'Date & time', 'Toll plaza', 'Vehicle', 'Booking', 'Customer', 'Amount (INR)', 'Balance after (INR)', 'Billing'],
      ...filtered.map((l) => [l.id, l.dateTime, l.plazaName, l.vehicleNumber, l.bookingId ?? '', l.customerName ?? 'Company trip', l.amount, l.balanceRemaining, billingState(l)]),
    ]);
    showToast(`Exported ${filtered.length} toll entries`);
  };

  const logColumns: Column<FASTagLog>[] = [
    { key: 'dateTime', label: 'Date & time', flex: 1.1, minWidth: 150, value: logDateLabel },
    { key: 'plaza', label: 'Toll plaza', flex: 2, minWidth: 220, value: (l) => l.plazaName },
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.2,
      minWidth: 140,
      render: (l) => (
        <View>
          <Text style={styles.title}>{l.vehicleNumber}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {vehicleByNumber.get(l.vehicleNumber)?.name ?? ''}
          </Text>
        </View>
      ),
    },
    {
      key: 'booking',
      label: 'Booking',
      flex: 0.9,
      minWidth: 100,
      render: (l) =>
        l.bookingId ? (
          <Text style={styles.link} accessibilityRole="link" onPress={() => openBooking(l.bookingId!)}>
            {l.bookingId}
          </Text>
        ) : (
          <Text style={styles.sub}>—</Text>
        ),
    },
    { key: 'customer', label: 'Customer', flex: 1.2, minWidth: 140, value: (l) => l.customerName ?? 'Company trip' },
    { key: 'amount', label: 'Amount', flex: 0.8, minWidth: 90, align: 'right', value: (l) => formatINR(l.amount) },
    {
      key: 'billed',
      label: 'Billing',
      flex: 0.9,
      minWidth: 110,
      render: (l) => {
        const s = billingState(l);
        return <Badge label={s === 'Company' ? 'Company cost' : s} tone={s === 'Billed' ? 'success' : s === 'Unbilled' ? 'warning' : 'neutral'} />;
      },
    },
  ];

  const formBookings = form ? bookingsFor(form.vehicleNumber) : [];

  return (
    <View>
      <Section
        title="Toll entries"
        subtitle={`${filtered.length} of ${logs.length} entries`}
        style={{ marginTop: 0 }}
        action={
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="Export CSV" size="sm" variant="outline" icon={(c) => <Download size={14} color={c} />} disabled={!filtered.length} onPress={exportCsv} />
            <Button label="Add toll entry" size="sm" icon={(c) => <Plus size={14} color={c} />} disabled={!fleet.length} onPress={openForm} />
          </View>
        }>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Plaza, vehicle, booking or customer" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Billing">
            <ChipGroup options={LOG_FILTERS} value={logFilter} onChange={setLogFilter} labels={{ Company: 'Company trips' }} scroll={isPhone} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable
          columns={logColumns}
          rows={paged.pageRows}
          rowKey={(l) => l.id}
          empty={
            <EmptyState
              compact
              title="No toll entries"
              message="Nothing matches this filter."
              action={filtersActive ? <Button label="Reset filter" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          }
        />
        <Pager paged={paged} />
      </Section>

      <FormSheet
        visible={!!form}
        title="Add toll entry"
        onClose={() => setForm(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setForm(null)} />
            <Button label="Save entry" onPress={submit} />
          </>
        }>
        {form ? (
          <>
            <Text style={styles.label}>Vehicle</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup
                options={fleet.map((v) => v.vehicleNumber)}
                value={form.vehicleNumber}
                onChange={(vehicleNumber) => setForm({ ...form, vehicleNumber, bookingId: NO_BOOKING })}
                labels={Object.fromEntries(fleet.map((v) => [v.vehicleNumber, `${v.name} · ${v.vehicleNumber}`]))}
                scroll
              />
              {errors.vehicleNumber ? <Text style={styles.error}>{errors.vehicleNumber}</Text> : null}
            </View>
            <Field label="Toll plaza" required value={form.plazaName} onChangeText={(plazaName) => setForm({ ...form, plazaName })} error={errors.plazaName} />
            <FormRow cols={3}>
              <Field label="Amount (₹)" required keyboardType="number-pad" value={form.amount} onChangeText={(amount) => setForm({ ...form, amount })} error={errors.amount} />
              <Field label="Date" required value={form.date} onChangeText={(date) => setForm({ ...form, date })} placeholder="YYYY-MM-DD" error={errors.date} />
              <Field label="Time" required value={form.time} onChangeText={(time) => setForm({ ...form, time })} placeholder="08:30 AM" error={errors.time} />
            </FormRow>
            <Text style={styles.label}>Charge to</Text>
            <ChipGroup
              options={[NO_BOOKING, ...formBookings.map((b) => b.id)]}
              value={form.bookingId}
              onChange={(bookingId) => setForm({ ...form, bookingId })}
              labels={{ [NO_BOOKING]: 'Company trip', ...Object.fromEntries(formBookings.map((b) => [b.id, `${b.id} · ${b.customerName}`])) }}
            />
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}
