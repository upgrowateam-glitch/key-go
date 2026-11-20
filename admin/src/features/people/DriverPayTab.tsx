import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { CheckCircle2, IndianRupee, Lock, MinusCircle, PlusCircle, RotateCcw, Wallet } from 'lucide-react-native';
import { Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, Section, StatTile, StatusBadge, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { canAccess } from '../../services/auth';
import {
  addPayEntry,
  driverPayHistory,
  fetchDriverPay,
  finaliseDriverPay,
  markDriverPaid,
  removePayEntry,
  reopenDriverPay,
  setDriverSalary,
  type DriverPay,
  type PayEntry,
  type SalaryRecord,
} from '../../services/driverPay';
import { addLedgerEntry } from '../../services/finance';
import type { AuditEntry } from '../../services/identity';
import { useStaffSession } from '../../components/portal/PortalShell';
import { useThemeColors } from '../../theme';

const TYPE_LABEL: Record<PayEntry['type'], string> = { advance: 'Advance', deduction: 'Deduction', bonus: 'Bonus' };
const ENTRY_TYPES = ['Advance', 'Deduction', 'Bonus'] as const;
const LOG_LABEL: Record<string, string> = {
  'pay.advance_added': 'Advance added',
  'pay.deduction_added': 'Deduction added',
  'pay.bonus_added': 'Bonus added',
  'pay.advance_removed': 'Advance removed',
  'pay.deduction_removed': 'Deduction removed',
  'pay.bonus_removed': 'Bonus removed',
  'pay.salary_set': 'Salary changed',
  'pay.finalised': 'Month finalised',
  'pay.reopened': 'Month reopened',
  'pay.paid': 'Marked paid',
};

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
};

/**
 * Driver pay by month. Payable = salary + commission from completed trips + bonuses − advances − deductions,
 * worked out by the server from separate records. Finalise freezes the month; then mark it paid.
 */
export default function DriverPayTab() {
  const colors = useThemeColors();
  const { cols } = useResponsive();
  const { today } = useApp();
  const { session } = useStaffSession();
  const canEdit = canAccess(session, 'people', 'edit');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [rows, setRows] = useState<DriverPay[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchDriverPay(month));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [month]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const totals = useMemo(() => {
    const r = rows ?? [];
    return {
      payable: r.reduce((s, x) => s + x.payable, 0),
      commission: r.reduce((s, x) => s + x.commission, 0),
      advances: r.reduce((s, x) => s + x.advances, 0),
      paid: r.filter((x) => x.status === 'Paid').reduce((s, x) => s + x.payable, 0),
    };
  }, [rows]);

  const columns: Column<DriverPay>[] = [
    {
      key: 'name',
      label: 'Driver',
      flex: 1.4,
      minWidth: 160,
      render: (r) => (
        <View>
          <Text style={{ color: colors.txt, fontSize: 13, fontWeight: '800' }}>{r.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>
            {r.trips.length} trip{r.trips.length === 1 ? '' : 's'} · {r.commissionPercent}% commission
          </Text>
        </View>
      ),
    },
    { key: 'salary', label: 'Salary', minWidth: 100, align: 'right', value: (r) => formatINR(r.salary) },
    { key: 'commission', label: 'Commission', minWidth: 100, align: 'right', value: (r) => formatINR(r.commission) },
    { key: 'bonuses', label: 'Bonus', minWidth: 90, align: 'right', value: (r) => (r.bonuses ? `+${formatINR(r.bonuses)}` : '—') },
    { key: 'advances', label: 'Advances', minWidth: 100, align: 'right', value: (r) => (r.advances ? `−${formatINR(r.advances)}` : '—') },
    { key: 'deductions', label: 'Deductions', minWidth: 100, align: 'right', value: (r) => (r.deductions ? `−${formatINR(r.deductions)}` : '—') },
    {
      key: 'payable',
      label: 'Payable',
      minWidth: 110,
      align: 'right',
      render: (r) => <Text style={{ color: r.payable < 0 ? colors.danger : colors.txt, fontSize: 13, fontWeight: '800', textAlign: 'right' }}>{formatINR(r.payable)}</Text>,
    },
    { key: 'status', label: 'Status', minWidth: 100, render: (r) => <StatusBadge status={r.status} /> },
    { key: 'open', label: '', minWidth: 90, render: (r) => <Button label="Details" size="sm" variant="outline" onPress={() => setOpenId(r.driverId)} /> },
  ];

  const open = rows?.find((r) => r.driverId === openId) ?? null;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <Button label="‹" size="sm" variant="outline" onPress={() => setMonth((m) => shiftMonth(m, -1))} accessibilityHint="Previous month" />
        <Text style={{ color: colors.txt, fontSize: 16, fontWeight: '800', minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</Text>
        <Button label="›" size="sm" variant="outline" disabled={month >= today.slice(0, 7)} onPress={() => setMonth((m) => shiftMonth(m, 1))} accessibilityHint="Next month" />
      </View>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 12 }}>
        <StatTile emphasis label="Total payable" value={formatINRCompact(totals.payable)} hint={monthLabel(month)} icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Commission" value={formatINRCompact(totals.commission)} hint="From completed trips" tone="info" icon={(c) => <PlusCircle size={16} color={c} />} />
        <StatTile label="Advances given" value={formatINRCompact(totals.advances)} hint="Recovered from pay" tone="warning" icon={(c) => <MinusCircle size={16} color={c} />} />
        <StatTile label="Paid" value={formatINRCompact(totals.paid)} tone="success" icon={(c) => <CheckCircle2 size={16} color={c} />} />
      </Grid>
      <Section title="Driver pay" subtitle="Payable = salary + commission + bonus − advances − deductions. Finalise a month to freeze it, then mark it paid.">
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {!rows && !error ? <ActivityIndicator color={colors.primary} /> : null}
        {rows ? (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.driverId} empty={<EmptyState compact title="No drivers" message="Add drivers in the Drivers tab." />} />
        ) : null}
      </Section>
      {open ? <PaySheet pay={open} canEdit={canEdit} canReopen={!!session && ['Owner', 'Admin'].includes(session.role)} onClose={() => setOpenId(null)} onChanged={load} /> : null}
    </View>
  );
}

function PaySheet({ pay: p, canEdit, canReopen, onClose, onChanged }: { pay: DriverPay; canEdit: boolean; canReopen: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const colors = useThemeColors();
  const { showToast, today } = useApp();
  const [adding, setAdding] = useState<(typeof ENTRY_TYPES)[number] | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salary, setSalary] = useState(String(p.salary));
  const [salaryFrom, setSalaryFrom] = useState(p.month);
  const [confirm, setConfirm] = useState<'finalise' | 'reopen' | null>(null);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState('Bank transfer');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ salaries: SalaryRecord[]; log: AuditEntry[] } | null>(null);
  const open = p.status === 'Open';

  useEffect(() => {
    driverPayHistory(p.driverId).then(setHistory, () => setHistory({ salaries: [], log: [] }));
  }, [p.driverId, p.status, p.entries.length, p.salary]);

  const run = async (task: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await task();
      showToast(done);
      await onChanged();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const amountNum = Number(amount);
  const amountOk = /^\d{1,7}$/.test(amount.trim()) && amountNum > 0;

  return (
    <FormSheet visible title={`${p.name} · ${monthLabel(p.month)}`} onClose={onClose} footer={<Button label="Close" variant="ghost" onPress={onClose} />}>
      <View style={{ gap: 14 }}>
        <Card style={{ gap: 6 }}>
          <Line label="Monthly salary" hint={p.salaryFrom} value={formatINR(p.salary)} />
          <Line label={`Commission (${p.commissionPercent}% of ${p.trips.length} trip${p.trips.length === 1 ? '' : 's'})`} value={`+${formatINR(p.commission)}`} />
          {p.bonuses ? <Line label="Bonus" value={`+${formatINR(p.bonuses)}`} /> : null}
          {p.advances ? <Line label="Advances" value={`−${formatINR(p.advances)}`} tone={colors.warmText} /> : null}
          {p.deductions ? <Line label="Deductions" value={`−${formatINR(p.deductions)}`} tone={colors.danger} /> : null}
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />
          <Line label="Payable" value={formatINR(p.payable)} strong tone={p.payable < 0 ? colors.danger : undefined} />
          {p.payable < 0 ? <Text style={{ color: colors.danger, fontSize: 12 }}>Advances and deductions are more than the pay. Carry the rest to next month as an advance.</Text> : null}
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <StatusBadge status={p.status} />
            {p.payslip ? (
              <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                Finalised by {p.payslip.finalisedBy} on {formatDate(p.payslip.finalisedAt.slice(0, 10))}
                {p.payslip.paidAt ? ` · paid ${formatDate(p.payslip.paidAt.slice(0, 10))} by ${p.payslip.paidBy} (${p.payslip.method}${p.payslip.reference ? `, ${p.payslip.reference}` : ''})` : ''}
              </Text>
            ) : null}
          </View>
        </Card>

        {canEdit ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {open ? (
              <>
                <Button label="Advance" size="sm" variant="outline" icon={(c) => <Wallet size={13} color={c} />} onPress={() => setAdding('Advance')} />
                <Button label="Deduction" size="sm" variant="outline" icon={(c) => <MinusCircle size={13} color={c} />} onPress={() => setAdding('Deduction')} />
                <Button label="Bonus" size="sm" variant="outline" icon={(c) => <PlusCircle size={13} color={c} />} onPress={() => setAdding('Bonus')} />
                <Button label="Change salary" size="sm" variant="ghost" onPress={() => setSalaryOpen(true)} />
                <Button label="Finalise month" size="sm" icon={(c) => <Lock size={13} color={c} />} disabled={busy} onPress={() => setConfirm('finalise')} />
              </>
            ) : null}
            {p.status === 'Finalised' ? (
              <>
                <Button label="Mark paid" size="sm" icon={(c) => <CheckCircle2 size={13} color={c} />} disabled={busy} onPress={() => setPaying(true)} />
                {canReopen ? <Button label="Reopen" size="sm" variant="ghost" icon={(c) => <RotateCcw size={13} color={c} />} onPress={() => setConfirm('reopen')} /> : null}
              </>
            ) : null}
          </View>
        ) : null}

        <View>
          <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>Completed trips</Text>
          {p.trips.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>No completed trips this month.</Text> : null}
          {p.trips.map((t) => (
            <Line key={t.bookingId} label={`${t.bookingId} · ${t.customerName}`} hint={`${t.vehicleNumber} · completed ${formatDate(t.completedOn)} · trip ${formatINR(t.amount)}`} value={`+${formatINR(t.commission)}`} />
          ))}
        </View>

        <View>
          <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>Advances, deductions and bonuses</Text>
          {p.entries.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>None this month.</Text> : null}
          {p.entries.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Line label={`${TYPE_LABEL[e.type]} · ${e.note}`} hint={`${formatDate(e.date)} · added by ${e.createdBy}`} value={`${e.type === 'bonus' ? '+' : '−'}${formatINR(e.amount)}`} />
              </View>
              {open && canEdit ? <Button label="Remove" size="sm" variant="ghost" onPress={() => run(() => removePayEntry(p.driverId, e.id), `${TYPE_LABEL[e.type]} removed`)} /> : null}
            </View>
          ))}
        </View>

        <View>
          <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>Salary records</Text>
          {!history ? <ActivityIndicator color={colors.primary} /> : history.salaries.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>Using the salary on the driver's profile.</Text> : null}
          {history?.salaries.map((sr) => <Line key={sr.id} label={`From ${monthLabel(sr.from)}`} hint={`Set by ${sr.setBy} on ${formatDate(sr.setAt.slice(0, 10))}${sr.note ? ` · ${sr.note}` : ''}`} value={formatINR(sr.amount)} />)}
        </View>

        {history?.log.length ? (
          <View>
            <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '800', marginBottom: 6 }}>Pay history</Text>
            {history.log.slice(0, 20).map((l) => (
              <Text key={l.id} style={{ color: colors.muted, fontSize: 12, marginBottom: 3 }}>
                {new Date(l.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {LOG_LABEL[l.action] ?? l.action}
                {l.detail?.amount ? ` ${formatINR(Number(l.detail.amount))}` : ''}
                {l.detail?.month ? ` (${l.detail.month})` : ''} · {l.actorName}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <FormSheet
        visible={!!adding}
        title={`${adding ?? ''} for ${p.name}`}
        onClose={() => setAdding(null)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setAdding(null)} />
            <Button
              label="Add"
              disabled={!amountOk || !note.trim() || busy}
              onPress={() => {
                const type = adding!.toLowerCase() as PayEntry['type'];
                setAdding(null);
                run(() => addPayEntry(p.driverId, { month: p.month, type, amount: amountNum, note: note.trim(), date: today }), `${adding} of ${formatINR(amountNum)} added`).then(() => {
                  setAmount('');
                  setNote('');
                });
              }}
            />
          </>
        }>
        <ChipGroup options={ENTRY_TYPES} value={adding ?? 'Advance'} onChange={setAdding} />
        <FormRow>
          <Field label="Amount (₹)" required value={amount} onChangeText={setAmount} keyboardType="number-pad" error={amount && !amountOk ? 'Whole rupees' : undefined} />
          <Field label="What for" required value={note} onChangeText={setNote} placeholder={adding === 'Deduction' ? 'e.g. Traffic fine, damage' : adding === 'Bonus' ? 'e.g. Festival bonus' : 'e.g. Advance on 12th'} />
        </FormRow>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Recorded for {monthLabel(p.month)} with your name.</Text>
      </FormSheet>

      <FormSheet
        visible={salaryOpen}
        title={`Monthly salary for ${p.name}`}
        onClose={() => setSalaryOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setSalaryOpen(false)} />
            <Button
              label="Save salary"
              disabled={!/^\d{1,7}$/.test(salary.trim()) || !/^\d{4}-\d{2}$/.test(salaryFrom) || busy}
              onPress={() => {
                setSalaryOpen(false);
                run(() => setDriverSalary(p.driverId, { from: salaryFrom, amount: Number(salary) }), 'Salary saved');
              }}
            />
          </>
        }>
        <FormRow>
          <Field label="Monthly salary (₹)" required value={salary} onChangeText={setSalary} keyboardType="number-pad" />
          <Field label="From month" required value={salaryFrom} onChangeText={setSalaryFrom} placeholder="YYYY-MM" hint="Earlier months keep their salary" />
        </FormRow>
      </FormSheet>

      <FormSheet
        visible={paying}
        title={`Mark ${formatINR(p.payable)} paid to ${p.name}?`}
        onClose={() => setPaying(false)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setPaying(false)} />
            <Button
              label="Mark paid"
              disabled={busy}
              onPress={() => {
                setPaying(false);
                run(async () => {
                  await markDriverPaid(p.driverId, { month: p.month, method, reference: reference.trim() });
                  // Finance and Reports pick the salary up from the ledger
                  await addLedgerEntry({ date: today, category: 'Salary', direction: 'out', amount: Math.max(0, p.payable), reference: `${p.name} · driver pay ${p.month}${reference.trim() ? ` · ${reference.trim()}` : ''}` });
                }, `${p.name} marked paid`);
              }}
            />
          </>
        }>
        <ChipGroup options={['Bank transfer', 'UPI', 'Cash'] as const} value={method as 'Bank transfer'} onChange={setMethod} />
        <Field label="Reference" value={reference} onChangeText={setReference} placeholder="UTR / UPI reference (optional)" />
        <Text style={{ color: colors.muted, fontSize: 12 }}>No money moves from KeyGo: this records the payment and adds it to Finance.</Text>
      </FormSheet>

      <ConfirmDialog
        visible={!!confirm}
        title={confirm === 'finalise' ? `Finalise ${monthLabel(p.month)} for ${p.name}?` : `Reopen ${monthLabel(p.month)}?`}
        message={confirm === 'finalise' ? `Payable ${formatINR(p.payable)} is frozen. Advances and deductions for this month can no longer be changed (Owner or Admin can reopen it before it is paid).` : 'The figures are worked out again and can be changed.'}
        confirmLabel={confirm === 'finalise' ? 'Finalise' : 'Reopen'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const what = confirm;
          setConfirm(null);
          if (what === 'finalise') run(() => finaliseDriverPay(p.driverId, p.month), 'Month finalised');
          else run(() => reopenDriverPay(p.driverId, p.month), 'Month reopened');
        }}
      />
    </FormSheet>
  );
}

function Line({ label, hint, value, strong, tone }: { label: string; hint?: string; value: string; strong?: boolean; tone?: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.txt, fontSize: strong ? 15 : 13, fontWeight: strong ? '800' : '600' }}>{label}</Text>
        {hint ? <Text style={{ color: colors.muted, fontSize: 11.5 }}>{hint}</Text> : null}
      </View>
      <Text style={{ color: tone ?? colors.txt, fontSize: strong ? 16 : 13, fontWeight: strong ? '800' : '700' }}>{value}</Text>
    </View>
  );
}


