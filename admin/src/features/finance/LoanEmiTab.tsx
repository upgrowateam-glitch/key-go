import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarClock, Landmark, Wallet } from 'lucide-react-native';
import { Badge, Button, Card, DataTable, EmptyState, Field, FormSheet, Grid, KeyValueGrid, ProgressBar, Section, StatTile, type Column, type Tone } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { daysBetween, formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { defaultNextDue, fetchLoans, payEmi, type EmiPayment } from '../../services/finance';
import { useResource } from '../../services/mockClient';
import { useThemedStyles } from '../../theme';
import { makeFinanceStyles } from './financeShared';
import { CsvButton, Pager, usePaged } from './tableTools';

interface LoanRow {
  vehicleId: string;
  vehicleName: string;
  vehicleNumber: string;
  bankName: string;
  accountNo: string;
  emi: number;
  tenure: number;
  paid: number;
  remaining: number;
  balance: number;
  ratePercent?: number;
  nextDue: string;
  closed: boolean;
}

function dueState(row: LoanRow, today: string): { label: string; tone: Tone } {
  if (row.closed) return { label: 'Closed', tone: 'success' };
  const d = daysBetween(today, row.nextDue);
  if (d < 0) return { label: `Overdue ${-d}d`, tone: 'danger' };
  if (d <= 7) return { label: `Due in ${d}d`, tone: 'warning' };
  return { label: 'Scheduled', tone: 'info' };
}

export default function LoanEmiTab() {
  const styles = useThemedStyles(makeFinanceStyles);
  const { cols } = useResponsive();
  const { vehicles, today, updateVehicle, showToast } = useApp();
  const res = useResource(fetchLoans);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paying, setPaying] = useState<LoanRow | null>(null);

  const rows = useMemo<LoanRow[]>(
    () =>
      vehicles
        .filter((v) => v.loanDetails)
        .map((v) => {
          const l = v.loanDetails!;
          const terms = res.data?.terms.find((t) => t.vehicleId === v.id);
          const remaining = Math.max(0, l.tenureMonths - l.paidMonths);
          return {
            vehicleId: v.id,
            vehicleName: v.name,
            vehicleNumber: v.vehicleNumber,
            bankName: l.bankName,
            accountNo: l.accountNo,
            emi: l.emiAmount,
            tenure: l.tenureMonths,
            paid: l.paidMonths,
            remaining,
            balance: remaining * l.emiAmount,
            ratePercent: terms?.ratePercent,
            nextDue: terms?.nextDue ?? defaultNextDue(),
            closed: remaining === 0,
          };
        }),
    [vehicles, res.data]
  );

  const allPayments = useMemo(() => (res.data?.payments ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)), [res.data]);
  const selected = rows.find((r) => r.vehicleId === selectedId);
  const history = useMemo(() => allPayments.filter((p) => !selectedId || p.vehicleId === selectedId), [allPayments, selectedId]);
  const paged = usePaged(history);

  const open = rows.filter((r) => !r.closed);
  const monthly = open.reduce((s, r) => s + r.emi, 0);
  const balance = open.reduce((s, r) => s + r.balance, 0);
  const dueSoon = open.filter((r) => daysBetween(today, r.nextDue) <= 7);

  const vehicleOf = (id: string) => vehicles.find((v) => v.id === id)?.name ?? id;

  const columns: Column<LoanRow>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.5,
      minWidth: 170,
      render: (r) => (
        <View>
          <Text style={styles.cellStrong}>{r.vehicleName}</Text>
          <Text style={styles.cardSub}>{r.vehicleNumber}</Text>
        </View>
      ),
    },
    {
      key: 'bank',
      label: 'Lender',
      flex: 1.4,
      minWidth: 170,
      render: (r) => (
        <View>
          <Text style={styles.cellStrong}>{r.bankName}</Text>
          <Text style={styles.cardSub}>{r.accountNo}</Text>
        </View>
      ),
    },
    { key: 'emi', label: 'EMI', minWidth: 100, align: 'right', value: (r) => formatINR(r.emi) },
    { key: 'rate', label: 'Rate', minWidth: 70, flex: 0.6, align: 'right', value: (r) => (r.ratePercent != null ? `${r.ratePercent}%` : '—') },
    {
      key: 'progress',
      label: 'Paid',
      minWidth: 130,
      render: (r) => (
        <View style={{ alignSelf: 'stretch', gap: 4 }}>
          <Text style={styles.cardSub}>
            {r.paid} of {r.tenure}
          </Text>
          <ProgressBar value={r.tenure ? r.paid / r.tenure : 0} height={6} />
        </View>
      ),
    },
    { key: 'next', label: 'Next due', minWidth: 110, value: (r) => (r.closed ? '—' : formatDate(r.nextDue)) },
    {
      key: 'state',
      label: 'Status',
      minWidth: 110,
      render: (r) => {
        const s = dueState(r, today);
        return <Badge label={s.label} tone={s.tone} />;
      },
    },
  ];

  const historyColumns: Column<EmiPayment>[] = [
    { key: 'date', label: 'Paid on', minWidth: 110, value: (p) => formatDate(p.date) },
    { key: 'vehicle', label: 'Vehicle', minWidth: 150, flex: 1.3, value: (p) => vehicleOf(p.vehicleId) },
    { key: 'ref', label: 'Transaction ref', minWidth: 180, flex: 1.5, value: (p) => p.txnRef },
    { key: 'amount', label: 'Amount', minWidth: 110, align: 'right', value: (p) => formatINR(p.amount) },
  ];

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;

  return (
    <View>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 8 }}>
        <StatTile emphasis label="Monthly EMI" value={formatINRCompact(monthly)} hint={`${open.length} open loans`} icon={(c) => <Landmark size={16} color={c} />} />
        <StatTile label="Due within 7 days" value={dueSoon.length} hint={formatINR(dueSoon.reduce((s, r) => s + r.emi, 0))} tone={dueSoon.length ? 'warning' : 'success'} icon={(c) => <CalendarClock size={16} color={c} />} />
        <StatTile label="EMIs still to pay" value={formatINRCompact(balance)} hint="Remaining EMIs × amount, including interest" tone="violet" icon={(c) => <Wallet size={16} color={c} />} />
        <StatTile label="EMIs paid (recorded)" value={allPayments.length} hint="See history below" tone="info" />
      </Grid>

      <Section title="Loans" subtitle="Select a loan to see its details and filter the payment history">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.vehicleId}
          onRowPress={(r) => setSelectedId(r.vehicleId === selectedId ? null : r.vehicleId)}
          empty={<EmptyState compact title="No loans" message="Vehicles with loan details in Fleet appear here." icon={(c) => <Landmark size={22} color={c} />} />}
        />
      </Section>

      {selected ? (
        <Card style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={[styles.cardTitle, { flex: 1 }]}>
              {selected.vehicleName} · {selected.bankName}
            </Text>
            {!selected.closed ? <Button label="Record EMI" size="sm" onPress={() => setPaying(selected)} /> : null}
          </View>
          <KeyValueGrid
            cols={3}
            items={[
              { label: 'Account', value: selected.accountNo },
              { label: 'EMI', value: formatINR(selected.emi) },
              { label: 'Interest rate', value: selected.ratePercent != null ? `${selected.ratePercent}% p.a.` : 'Not recorded' },
              { label: 'Tenure', value: `${selected.tenure} months` },
              { label: 'Remaining', value: `${selected.remaining} months` },
              { label: 'Next due', value: selected.closed ? 'Closed' : formatDate(selected.nextDue) },
            ]}
          />
        </Card>
      ) : null}

      <Section
        title="EMI payment history"
        subtitle={selected ? `${selected.vehicleName} only` : 'All loans'}
        action={
          <CsvButton
            data={() => ({
              filename: 'keygo-emi-payments.csv',
              headers: ['Paid on', 'Vehicle', 'Transaction ref', 'Amount (INR)'],
              rows: history.map((p) => [p.date, vehicleOf(p.vehicleId), p.txnRef, p.amount]),
            })}
          />
        }>
        <DataTable columns={historyColumns} rows={paged.pageRows} rowKey={(p) => p.id} empty={<EmptyState compact title="No EMIs recorded" message="Recorded EMIs appear here with their transaction reference." />} />
        <Pager paged={paged} />
      </Section>

      {paying ? (
        <PayEmiSheet
          loan={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            const v = vehicles.find((x) => x.id === paying.vehicleId);
            if (v?.loanDetails) updateVehicle(v.id, { loanDetails: { ...v.loanDetails, paidMonths: v.loanDetails.paidMonths + 1 } });
            showToast(`EMI of ${formatINR(paying.emi)} recorded for ${paying.vehicleName}`);
            setPaying(null);
            res.reload();
          }}
        />
      ) : null}
    </View>
  );
}

function PayEmiSheet({ loan, onClose, onPaid }: { loan: LoanRow; onClose: () => void; onPaid: () => void }) {
  const styles = useThemedStyles(makeFinanceStyles);
  const [ref, setRef] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const refError = ref.trim().length < 6 ? 'Enter the bank or NACH reference (at least 6 characters)' : undefined;

  const save = async () => {
    setSubmitted(true);
    if (refError || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await payEmi({ vehicleId: loan.vehicleId, bankName: loan.bankName, amount: loan.emi, txnRef: ref });
      onPaid();
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title={`Record EMI · ${loan.vehicleName}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Recording…' : `Record ${formatINR(loan.emi)}`} disabled={saving} onPress={save} />
        </>
      }>
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}
      <Text style={[styles.cardSub, { marginBottom: 12, marginTop: 0 }]}>
        Records the instalment due {formatDate(loan.nextDue)} to {loan.bankName} ({loan.accountNo}), posts it to the ledger and moves the next due date on a month.
      </Text>
      <Field label="Transaction reference" required value={ref} onChangeText={setRef} placeholder="NACH/HDFC/261001" error={submitted ? refError : undefined} hint="A reference already recorded for an EMI is rejected." />
    </FormSheet>
  );
}
