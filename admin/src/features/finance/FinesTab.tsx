import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ban, Plus, ReceiptText, RotateCcw } from 'lucide-react-native';
import { Badge, Button, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, Section, SegmentedControl, StatTile, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { addFine, collectFine, dateError, fetchFines, FINE_TYPES, waiveFine, type FineRecord, type FineType } from '../../services/finance';
import { useResource } from '../../services/mockClient';
import { useThemedStyles } from '../../theme';
import { makeFinanceStyles } from './financeShared';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, usePaged } from './tableTools';

const STATUSES = ['All', 'Due', 'Collected', 'Waived'] as const;
const SORTS = ['Newest', 'Oldest', 'Largest'] as const;

export default function FinesTab() {
  const styles = useThemedStyles(makeFinanceStyles);
  const { cols, isPhone } = useResponsive();
  const { showToast } = useApp();
  const res = useResource(fetchFines);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('All');
  const [type, setType] = useState<'All' | FineType>('All');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Newest');
  const [adding, setAdding] = useState(false);
  const [collecting, setCollecting] = useState<FineRecord | null>(null);
  const [waiving, setWaiving] = useState<FineRecord | null>(null);
  const [actionError, setActionError] = useState<string>();

  const fines = useMemo(() => res.data ?? [], [res.data]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fines
      .filter((f) => status === 'All' || f.status === status)
      .filter((f) => type === 'All' || f.type === type)
      .filter((f) => !q || `${f.id} ${f.bookingId ?? ''} ${f.customerName} ${f.note ?? ''} ${f.txnRef ?? ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === 'Largest' ? b.amount - a.amount : sort === 'Oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [fines, status, type, query, sort]);
  const paged = usePaged(rows);

  const sumOf = (s: FineRecord['status']) => fines.filter((f) => f.status === s).reduce((t, f) => t + f.amount, 0);
  const filtered = !!query.trim() || status !== 'All' || type !== 'All';
  const reset = () => {
    setQuery('');
    setStatus('All');
    setType('All');
  };

  const columns: Column<FineRecord>[] = [
    { key: 'date', label: 'Date', minWidth: 100, flex: 0.8, value: (f) => formatDate(f.date) },
    {
      key: 'who',
      label: 'Customer',
      minWidth: 170,
      flex: 1.3,
      render: (f) => (
        <View>
          <Text style={styles.cellStrong}>{f.customerName}</Text>
          <Text style={styles.cardSub}>{f.bookingId ?? 'No booking'}</Text>
        </View>
      ),
    },
    {
      key: 'type',
      label: 'Fine',
      minWidth: 190,
      flex: 1.5,
      render: (f) => (
        <View>
          <Text style={styles.cellStrong}>{f.type}</Text>
          {f.note ? <Text style={styles.cardSub}>{f.note}</Text> : null}
        </View>
      ),
    },
    { key: 'ref', label: 'Transaction ref', minWidth: 160, flex: 1.2, value: (f) => f.txnRef ?? '—' },
    { key: 'amount', label: 'Amount', minWidth: 90, flex: 0.7, align: 'right', value: (f) => formatINR(f.amount) },
    {
      key: 'status',
      label: 'Status',
      minWidth: 190,
      flex: 1.2,
      render: (f) =>
        f.status === 'Due' ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button label="Collect" size="sm" variant="outline" onPress={() => setCollecting(f)} />
            <Button label="Waive" size="sm" variant="ghost" onPress={() => setWaiving(f)} />
          </View>
        ) : (
          <Badge label={f.status} tone={f.status === 'Collected' ? 'success' : 'neutral'} />
        ),
    },
  ];

  const confirmWaive = async () => {
    if (!waiving) return;
    const target = waiving;
    setWaiving(null);
    try {
      await waiveFine(target.id);
      showToast(`Fine ${target.id} waived`);
      res.reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;

  return (
    <View>
      <Grid cols={cols(2, 3, 3)} style={{ marginTop: 8 }}>
        <StatTile emphasis label="Due from customers" value={formatINRCompact(sumOf('Due'))} hint={`${fines.filter((f) => f.status === 'Due').length} open fines`} icon={(c) => <ReceiptText size={16} color={c} />} />
        <StatTile label="Collected" value={formatINRCompact(sumOf('Collected'))} hint="Posted to income as fine collection" tone="success" />
        <StatTile label="Waived" value={formatINRCompact(sumOf('Waived'))} hint="Not charged" tone="neutral" icon={(c) => <Ban size={16} color={c} />} />
      </Grid>

      <Section title="Fines & penalties" subtitle="Charges raised against customers" action={<Button label="Add fine" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setAdding(true)} />}>
        {actionError ? <Text style={styles.formError}>{actionError}</Text> : null}
        <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Customer, booking or reference" />}>
          <FilterGroup label="Status">
            <SegmentedControl options={STATUSES} value={status} onChange={setStatus} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
          </FilterGroup>
          <CsvButton
            data={() => ({
              filename: 'keygo-fines.csv',
              headers: ['Date', 'Fine', 'Customer', 'Booking', 'Type', 'Transaction ref', 'Status', 'Amount (INR)'],
              rows: rows.map((f) => [f.date, f.id, f.customerName, f.bookingId ?? '', f.type, f.txnRef ?? '', f.status, f.amount]),
            })}
          />
          {filtered ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
        </ListToolbar>
        <View style={{ marginBottom: 12 }}>
          <ChipGroup options={['All', ...FINE_TYPES] as ('All' | FineType)[]} value={type} onChange={setType} scroll={isPhone} />
        </View>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(f) => f.id}
          empty={<EmptyState compact title="No fines" message={filtered ? 'Nothing matches these filters.' : 'Fines appear here when they are raised.'} action={filtered ? <Button label="Clear filters" variant="outline" size="sm" onPress={reset} /> : undefined} />}
        />
        <Pager paged={paged} />
      </Section>

      {adding ? (
        <AddFineSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            showToast('Fine added');
            res.reload();
          }}
        />
      ) : null}

      {collecting ? (
        <CollectSheet
          fine={collecting}
          onClose={() => setCollecting(null)}
          onSaved={() => {
            showToast(`${formatINR(collecting.amount)} collected for ${collecting.id}`);
            setCollecting(null);
            res.reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={!!waiving}
        title="Waive this fine?"
        message={waiving ? `${waiving.type} of ${formatINR(waiving.amount)} for ${waiving.customerName} will no longer be charged.` : undefined}
        confirmLabel="Waive fine"
        danger
        onConfirm={confirmWaive}
        onCancel={() => setWaiving(null)}
      />
    </View>
  );
}

function CollectSheet({ fine, onClose, onSaved }: { fine: FineRecord; onClose: () => void; onSaved: () => void }) {
  const styles = useThemedStyles(makeFinanceStyles);
  const [ref, setRef] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const refError = ref.trim().length < 6 ? 'Enter the payment reference (at least 6 characters)' : undefined;

  const save = async () => {
    setSubmitted(true);
    if (refError || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await collectFine(fine.id, ref);
      onSaved();
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title={`Collect fine · ${fine.id}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Keep as due" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Saving…' : `Collect ${formatINR(fine.amount)}`} disabled={saving} onPress={save} />
        </>
      }>
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}
      <Text style={[styles.cardSub, { marginBottom: 12, marginTop: 0 }]}>
        {fine.type} for {fine.customerName}. Collecting posts this amount to the ledger as fine income.
      </Text>
      <Field label="Transaction reference" required value={ref} onChangeText={setRef} placeholder="UPI/625810337790" error={submitted ? refError : undefined} />
    </FormSheet>
  );
}

function AddFineSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const styles = useThemedStyles(makeFinanceStyles);
  const { isPhone } = useResponsive();
  const { bookings, today } = useApp();
  const [type, setType] = useState<FineType>('Late return');
  const [bookingText, setBookingText] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const booking = bookings.find((b) => b.id.toLowerCase() === bookingText.trim().toLowerCase());
  const amount = Number(amountText);
  const errors = {
    booking: booking ? undefined : 'Enter an existing booking number, such as KG-7104',
    amount: !amountText.trim() || Number.isNaN(amount) || amount <= 0 ? 'Enter an amount above zero' : undefined,
    date: dateError(date),
  };
  const blocked = Object.values(errors).some(Boolean);

  const save = async () => {
    setSubmitted(true);
    if (blocked || saving || !booking) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await addFine({ bookingId: booking.id, customerName: booking.customerName, vehicleId: booking.vehicleId, type, amount, date: date.trim(), note: note.trim() || undefined });
      onSaved();
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title="Add fine"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Saving…' : 'Add fine'} disabled={saving} onPress={save} />
        </>
      }>
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}
      <Text style={styles.label}>Type</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={FINE_TYPES} value={type} onChange={setType} scroll={isPhone} />
      </View>
      <Field
        label="Booking"
        required
        value={bookingText}
        onChangeText={setBookingText}
        placeholder="KG-7104"
        error={submitted ? errors.booking : undefined}
        hint={booking ? `${booking.customerName} · ${booking.vehicleName}` : undefined}
      />
      <FormRow>
        <Field label="Amount (₹)" required value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" error={submitted ? errors.amount : undefined} />
        <Field label="Date" required value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={submitted ? errors.date : undefined} />
      </FormRow>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Challan number, location or details" />
    </FormSheet>
  );
}
