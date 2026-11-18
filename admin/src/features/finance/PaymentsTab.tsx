import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, CheckCircle2, Circle, CreditCard, Plus, RotateCcw, Undo2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, Checkbox, ChipGroup, ConfirmDialog, DataTable, Divider, EmptyState, Field, FormRow, FormSheet, Grid, KeyValueGrid, Section, SegmentedControl, StatTile, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import {
    createRefund,
    dateError,
    fetchPayments,
    fetchRefunds,
    findLikelyDuplicate,
    findPaymentByRef,
    outstandingFor,
    PAYMENT_METHODS,
    processRefund,
    recordPayment,
    voidPayment,
    type PaymentMethod,
    type PaymentRecord,
    type RefundRecord,
} from '../../services/finance';
import { useResource } from '../../services/mockClient';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Booking } from '../../types';
import { makeFinanceStyles } from './financeShared';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, usePaged } from './tableTools';

const STATUS = ['All', 'Received', 'Voided'] as const;
const SORTS = ['Newest', 'Oldest', 'Largest'] as const;

export default function PaymentsTab() {
  const styles = useThemedStyles(makeFinanceStyles);
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { bookings, showToast } = useApp();
  const pay = useResource(fetchPayments);
  const ref = useResource(fetchRefunds);
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState<'All' | PaymentMethod>('All');
  const [status, setStatus] = useState<(typeof STATUS)[number]>('All');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Newest');
  const [recording, setRecording] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [detail, setDetail] = useState<PaymentRecord | null>(null);
  const [voiding, setVoiding] = useState<PaymentRecord | null>(null);
  const [processing, setProcessing] = useState<RefundRecord | null>(null);
  const [actionError, setActionError] = useState<string>();

  const payments = useMemo(() => pay.data ?? [], [pay.data]);
  const refunds = useMemo(() => ref.data ?? [], [ref.data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments
      .filter((p) => method === 'All' || p.method === method)
      .filter((p) => status === 'All' || p.status === status)
      .filter((p) => !q || `${p.txnRef} ${p.bookingId} ${p.customerName} ${p.id}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === 'Largest' ? b.amount - a.amount : sort === 'Oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [payments, method, status, query, sort]);
  const paged = usePaged(rows);
  const refundsPaged = usePaged(refunds);

  const received = payments.filter((p) => p.status === 'Received').reduce((s, p) => s + p.amount, 0);
  const outstanding = bookings.reduce((s, b) => s + outstandingFor(b, payments), 0);
  const pendingRefunds = refunds.filter((r) => r.status === 'Pending');
  const filtered = !!query.trim() || method !== 'All' || status !== 'All';
  const reset = () => {
    setQuery('');
    setMethod('All');
    setStatus('All');
  };

  const columns: Column<PaymentRecord>[] = [
    { key: 'date', label: 'Date', minWidth: 100, flex: 0.8, value: (p) => formatDate(p.date) },
    {
      key: 'ref',
      label: 'Transaction ref',
      minWidth: 190,
      flex: 1.5,
      render: (p) => (
        <View>
          <Text style={styles.cellStrong}>{p.txnRef}</Text>
          <Text style={styles.cardSub}>{p.id}</Text>
        </View>
      ),
    },
    {
      key: 'booking',
      label: 'Booking',
      minWidth: 160,
      flex: 1.3,
      render: (p) => (
        <View>
          <Text style={styles.cellStrong}>{p.bookingId}</Text>
          <Text style={styles.cardSub}>{p.customerName}</Text>
        </View>
      ),
    },
    { key: 'method', label: 'Method', minWidth: 110, flex: 0.8, value: (p) => p.method },
    { key: 'status', label: 'Status', minWidth: 100, flex: 0.8, render: (p) => <Badge label={p.status} tone={p.status === 'Received' ? 'success' : 'neutral'} /> },
    { key: 'amount', label: 'Amount', minWidth: 110, flex: 0.9, align: 'right', value: (p) => formatINR(p.amount) },
  ];

  const refundColumns: Column<RefundRecord>[] = [
    { key: 'date', label: 'Date', minWidth: 100, flex: 0.8, value: (r) => formatDate(r.date) },
    {
      key: 'booking',
      label: 'Booking',
      minWidth: 160,
      flex: 1.2,
      render: (r) => (
        <View>
          <Text style={styles.cellStrong}>{r.bookingId}</Text>
          <Text style={styles.cardSub}>{r.customerName}</Text>
        </View>
      ),
    },
    { key: 'reason', label: 'Reason', minWidth: 180, flex: 1.5, value: (r) => r.reason },
    { key: 'ref', label: 'Transaction ref', minWidth: 170, flex: 1.3, value: (r) => r.txnRef ?? 'Awaiting bank reference' },
    { key: 'amount', label: 'Refund', minWidth: 100, flex: 0.8, align: 'right', value: (r) => formatINR(r.amount) },
    {
      key: 'status',
      label: 'Status',
      minWidth: 130,
      render: (r) => (r.status === 'Pending' ? <Button label="Mark processed" size="sm" variant="outline" onPress={() => setProcessing(r)} /> : <Badge label="Processed" tone="success" />),
    },
  ];

  const confirmVoid = async () => {
    if (!voiding) return;
    const target = voiding;
    setVoiding(null);
    setDetail(null);
    try {
      await voidPayment(target.id);
      showToast(`Payment ${target.txnRef} voided`);
      pay.reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  if (pay.error || ref.error || (pay.loading && !pay.data) || (ref.loading && !ref.data)) {
    return (
      <ResourceState
        loading={pay.loading || ref.loading}
        error={pay.error ?? ref.error}
        onRetry={() => {
          pay.reload();
          ref.reload();
        }}
      />
    );
  }

  return (
    <View>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 8 }}>
        <StatTile emphasis label="Payments received" value={formatINRCompact(received)} hint={`${payments.filter((p) => p.status === 'Received').length} recorded payments`} icon={(c) => <CreditCard size={16} color={c} />} />
        <StatTile label="Outstanding" value={formatINRCompact(outstanding)} hint="Balance on billable bookings" tone={outstanding ? 'warning' : 'success'} />
        <StatTile label="Refunds pending" value={pendingRefunds.length} hint={formatINR(pendingRefunds.reduce((s, r) => s + r.amount, 0))} tone={pendingRefunds.length ? 'warning' : 'success'} icon={(c) => <Undo2 size={16} color={c} />} />
        <StatTile label="Refunded" value={formatINRCompact(refunds.filter((r) => r.status === 'Processed').reduce((s, r) => s + r.amount, 0))} hint="Security deposits returned" tone="info" />
      </Grid>

      {actionError ? <Text style={[styles.formError, { marginTop: 12 }]}>{actionError}</Text> : null}

      <Section title="Payments" subtitle="Every payment carries a transaction reference; select one to trace it" action={<Button label="Record payment" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setRecording(true)} />}>
        <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Reference, booking or customer" />}>
          <FilterGroup label="Status">
            <SegmentedControl options={STATUS} value={status} onChange={setStatus} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
          </FilterGroup>
          <CsvButton
            data={() => ({
              filename: 'keygo-payments.csv',
              headers: ['Date', 'Payment', 'Transaction ref', 'Booking', 'Customer', 'Method', 'Status', 'Ledger ref', 'Amount (INR)'],
              rows: rows.map((p) => [p.date, p.id, p.txnRef, p.bookingId, p.customerName, p.method, p.status, p.ledgerRef, p.amount]),
            })}
          />
          {filtered ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
        </ListToolbar>
        <View style={{ marginBottom: 12 }}>
          <ChipGroup options={['All', ...PAYMENT_METHODS] as ('All' | PaymentMethod)[]} value={method} onChange={setMethod} scroll={isPhone} />
        </View>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(p) => p.id}
          onRowPress={setDetail}
          empty={<EmptyState compact title="No payments" message={filtered ? 'Nothing matches these filters.' : 'Recorded payments appear here.'} action={filtered ? <Button label="Clear filters" variant="outline" size="sm" onPress={reset} /> : undefined} />}
        />
        <Pager paged={paged} />
      </Section>

      <Section title="Refunds" subtitle="Security deposits returned to customers" action={<Button label="New refund" size="sm" variant="outline" icon={(c) => <Undo2 size={14} color={c} />} onPress={() => setRefunding(true)} />}>
        <DataTable columns={refundColumns} rows={refundsPaged.pageRows} rowKey={(r) => r.id} empty={<EmptyState compact title="No refunds" message="Deposit refunds appear here." />} />
        <Pager paged={refundsPaged} />
      </Section>

      {recording ? (
        <RecordPaymentSheet
          payments={payments}
          onClose={() => setRecording(false)}
          onSaved={(p) => {
            setRecording(false);
            showToast(`${formatINR(p.amount)} recorded · ${p.txnRef}`);
            pay.reload();
          }}
        />
      ) : null}

      {refunding ? (
        <RefundSheet
          refunds={refunds}
          onClose={() => setRefunding(false)}
          onSaved={() => {
            setRefunding(false);
            showToast('Refund created · waiting for bank reference');
            ref.reload();
          }}
        />
      ) : null}

      {processing ? (
        <ProcessRefundSheet
          refund={processing}
          onClose={() => setProcessing(null)}
          onSaved={() => {
            setProcessing(null);
            showToast('Refund marked as processed');
            ref.reload();
          }}
        />
      ) : null}

      <FormSheet
        visible={!!detail && !voiding}
        title={detail ? `Payment ${detail.id}` : 'Payment'}
        onClose={() => setDetail(null)}
        footer={
          detail?.session && detail.status === 'Received' ? (
            <Button label="Void payment" variant="danger" onPress={() => setVoiding(detail)} />
          ) : undefined
        }>
        {detail ? (
          <View>
            <KeyValueGrid
              cols={2}
              items={[
                { label: 'Transaction ref', value: detail.txnRef },
                { label: 'Status', value: <Badge label={detail.status} tone={detail.status === 'Received' ? 'success' : 'neutral'} /> },
                { label: 'Amount', value: formatINR(detail.amount) },
                { label: 'Method', value: detail.method },
                { label: 'Date', value: formatDate(detail.date) },
                { label: 'Customer', value: detail.customerName },
                { label: 'Booking', value: detail.bookingId },
                { label: 'Ledger entry', value: detail.ledgerRef },
              ]}
            />
            <Divider />
            <Button
              label={`Open booking ${detail.bookingId}`}
              variant="outline"
              size="sm"
              onPress={() => {
                const id = detail.bookingId;
                setDetail(null);
                router.push(`/bookings/${encodeURIComponent(id)}`);
              }}
            />
          </View>
        ) : null}
      </FormSheet>

      <ConfirmDialog
        visible={!!voiding}
        title="Void this payment?"
        message={voiding ? `${formatINR(voiding.amount)} (${voiding.txnRef}) will be marked void and removed from income. The record stays visible for audit.` : undefined}
        confirmLabel="Void payment"
        danger
        onConfirm={confirmVoid}
        onCancel={() => setVoiding(null)}
      />
    </View>
  );
}

function BookingOption({ booking: b, note, selected, onPress }: { booking: Booking; note: string; selected: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeFinanceStyles);
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`Booking ${b.id}, ${b.customerName}`}
      onPress={onPress}
      style={[styles.option, selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
      {selected ? <CheckCircle2 size={18} color={colors.primaryText} /> : <Circle size={18} color={colors.muted} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.cellStrong}>
          {b.id} · {b.customerName}
        </Text>
        <Text style={styles.cardSub}>{note}</Text>
      </View>
    </TouchableOpacity>
  );
}

function RecordPaymentSheet({ payments, onClose, onSaved }: { payments: PaymentRecord[]; onClose: () => void; onSaved: (p: PaymentRecord) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeFinanceStyles);
  const { isPhone } = useResponsive();
  const { bookings, today } = useApp();
  const due = useMemo(() => bookings.filter((b) => outstandingFor(b, payments) > 0), [bookings, payments]);
  const [bookingId, setBookingId] = useState<string | null>(due[0]?.id ?? null);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [amountText, setAmountText] = useState(due[0] ? String(outstandingFor(due[0], payments)) : '');
  const [date, setDate] = useState(today);
  const [txnRef, setTxnRef] = useState('');
  const [notDuplicate, setNotDuplicate] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const booking = due.find((b) => b.id === bookingId);
  const balance = booking ? outstandingFor(booking, payments) : 0;
  const amount = Number(amountText);
  const refRequired = method !== 'Cash';
  const refTaken = txnRef.trim() ? findPaymentByRef(payments, txnRef) : undefined;

  const errors = {
    booking: booking ? undefined : 'Choose a booking',
    amount: !amountText.trim() || Number.isNaN(amount) || amount <= 0 ? 'Enter an amount above zero' : booking && amount > balance ? `More than the ${formatINR(balance)} due on this booking` : undefined,
    date: dateError(date),
    ref: refTaken
      ? `Already recorded on ${refTaken.bookingId} (${refTaken.id}). This looks like a duplicate.`
      : refRequired && txnRef.trim().length < 6
        ? 'Enter the bank, UPI or card reference (at least 6 characters)'
        : undefined,
  };
  const likely = booking && !errors.amount && !errors.date ? findLikelyDuplicate(payments, booking.id, amount, date.trim()) : undefined;
  const blocked = !!errors.booking || !!errors.amount || !!errors.date || !!errors.ref || (!!likely && !notDuplicate);

  const pick = (b: Booking) => {
    setBookingId(b.id);
    setAmountText(String(outstandingFor(b, payments)));
    setNotDuplicate(false);
  };

  const save = async () => {
    setSubmitted(true);
    if (blocked || saving || !booking) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      onSaved(await recordPayment({ booking, method, amount, date: date.trim(), txnRef }));
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title="Record payment"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Recording…' : 'Record payment'} disabled={saving || due.length === 0} onPress={save} />
        </>
      }>
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}
      <Text style={styles.label}>Booking with a balance due</Text>
      <View style={{ gap: 8, marginBottom: 14 }}>
        {due.length === 0 ? (
          <EmptyState compact title="Nothing outstanding" message="Every billable booking is paid in full." />
        ) : (
          due.map((b) => <BookingOption key={b.id} booking={b} selected={bookingId === b.id} note={`${b.vehicleName} · ${formatINR(outstandingFor(b, payments))} due of ${formatINR(b.totalAmount)}`} onPress={() => pick(b)} />)
        )}
        {submitted && errors.booking ? <Text style={styles.formError}>{errors.booking}</Text> : null}
      </View>
      <Text style={styles.label}>Method</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={PAYMENT_METHODS} value={method} onChange={setMethod} scroll={isPhone} />
      </View>
      <FormRow>
        <Field
          label="Amount (₹)"
          required
          value={amountText}
          onChangeText={(v) => {
            setAmountText(v);
            setNotDuplicate(false);
          }}
          keyboardType="decimal-pad"
          error={submitted || (booking && amount > balance) ? errors.amount : undefined}
        />
        <Field label="Date" required value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={submitted ? errors.date : undefined} />
      </FormRow>
      <Field
        label="Transaction reference"
        required={refRequired}
        value={txnRef}
        onChangeText={setTxnRef}
        placeholder={method === 'Cash' ? 'Leave blank to generate a receipt reference' : 'UPI/626711420981'}
        error={refTaken || submitted ? errors.ref : undefined}
        hint="References must be unique, so the same payment cannot be entered twice."
      />
      {likely ? (
        <View style={[styles.notice, { marginTop: 0, flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} color={colors.warmText} />
            <Text style={styles.noticeText}>
              Possible duplicate: {formatINR(likely.amount)} was already recorded for {likely.bookingId} on {formatDate(likely.date)} ({likely.txnRef}).
            </Text>
          </View>
          <Checkbox label="This is a separate payment, record it anyway" checked={notDuplicate} onChange={setNotDuplicate} />
          {submitted && !notDuplicate ? <Text style={styles.formError}>Confirm this is not a duplicate to continue.</Text> : null}
        </View>
      ) : null}
    </FormSheet>
  );
}

function RefundSheet({ refunds, onClose, onSaved }: { refunds: RefundRecord[]; onClose: () => void; onSaved: () => void }) {
  const styles = useThemedStyles(makeFinanceStyles);
  const { bookings } = useApp();
  const refundedOn = (id: string) => refunds.filter((r) => r.bookingId === id).reduce((s, r) => s + r.amount + r.withheld, 0);
  const eligible = useMemo(
    () => bookings.filter((b) => (b.status === 'Completed' || b.status === 'Cancelled') && b.depositAmount - refundedOn(b.id) > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, refunds]
  );
  const [bookingId, setBookingId] = useState<string | null>(eligible[0]?.id ?? null);
  const [amountText, setAmountText] = useState('');
  const [withheldText, setWithheldText] = useState('0');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const booking = eligible.find((b) => b.id === bookingId);
  const available = booking ? booking.depositAmount - refundedOn(booking.id) : 0;
  const amount = Number(amountText);
  const withheld = Number(withheldText || 0);
  const errors = {
    booking: booking ? undefined : 'Choose a booking',
    amount: !amountText.trim() || Number.isNaN(amount) || amount <= 0 ? 'Enter an amount above zero' : amount > available ? `Only ${formatINR(available)} of the deposit is left` : undefined,
    withheld: Number.isNaN(withheld) || withheld < 0 ? 'Enter zero or more' : amount + withheld > available ? 'Refund and retained amount exceed the deposit' : undefined,
    reason: reason.trim().length < 3 ? 'Give a reason' : undefined,
  };
  const blocked = Object.values(errors).some(Boolean);

  const save = async () => {
    setSubmitted(true);
    if (blocked || saving || !booking) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await createRefund({ bookingId: booking.id, customerName: booking.customerName, amount, withheld, reason: reason.trim() });
      onSaved();
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title="New deposit refund"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Creating…' : 'Create refund'} disabled={saving || eligible.length === 0} onPress={save} />
        </>
      }>
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}
      <Text style={styles.label}>Completed or cancelled booking with deposit left</Text>
      <View style={{ gap: 8, marginBottom: 14 }}>
        {eligible.length === 0 ? (
          <EmptyState compact title="No deposits to refund" message="Deposits on completed and cancelled bookings have all been handled." />
        ) : (
          eligible.map((b) => <BookingOption key={b.id} booking={b} selected={bookingId === b.id} note={`${formatINR(b.depositAmount - refundedOn(b.id))} of ${formatINR(b.depositAmount)} deposit left`} onPress={() => setBookingId(b.id)} />)
        )}
      </View>
      <FormRow>
        <Field label="Refund (₹)" required value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" error={submitted ? errors.amount : undefined} />
        <Field label="Retained (₹)" value={withheldText} onChangeText={setWithheldText} keyboardType="decimal-pad" error={submitted ? errors.withheld : undefined} hint="Damage, fines or fuel kept from the deposit" />
      </FormRow>
      <Field label="Reason" required value={reason} onChangeText={setReason} error={submitted ? errors.reason : undefined} />
    </FormSheet>
  );
}

function ProcessRefundSheet({ refund, onClose, onSaved }: { refund: RefundRecord; onClose: () => void; onSaved: () => void }) {
  const styles = useThemedStyles(makeFinanceStyles);
  const [ref, setRef] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const refError = ref.trim().length < 6 ? 'Enter the bank reference (at least 6 characters)' : undefined;

  const save = async () => {
    setSubmitted(true);
    if (refError || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await processRefund(refund.id, ref);
      onSaved();
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title={`Process refund · ${refund.bookingId}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Keep as pending" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Saving…' : 'Mark processed'} disabled={saving} onPress={save} />
        </>
      }>
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}
      <Text style={[styles.cardSub, { marginBottom: 12, marginTop: 0 }]}>
        {formatINR(refund.amount)} to {refund.customerName}. {refund.reason}.
      </Text>
      <Field label="Transaction reference" required value={ref} onChangeText={setRef} placeholder="NEFT/N259260071123" error={submitted ? refError : undefined} />
    </FormSheet>
  );
}
