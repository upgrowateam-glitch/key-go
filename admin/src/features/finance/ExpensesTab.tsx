import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Fuel, Plus, Receipt, Route, Wrench } from 'lucide-react-native';
import { Button, Card, ChipGroup, ConfirmDialog, DonutChart, EmptyState, Field, FormRow, FormSheet, Grid, Section, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../lib/format';
import { addExpense, dateError, EXPENSE_CATEGORIES, removeLedgerEntry, type LedgerCategory, type LedgerEntry } from '../../services/finance';
import { useThemeColors, useThemedStyles } from '../../theme';
import { LedgerTable, makeFinanceStyles, PeriodBar } from './financeShared';
import { PERIOD_CAPTION, PERIOD_MONTHS, sumCategories, totalExpense, useLedger, type Period } from './useLedger';

/** EMIs go through the Loan EMI tab and salaries through Payroll, so each keeps its own trail. */
const MANUAL_CATEGORIES: LedgerCategory[] = ['Maintenance', 'Fuel', 'Toll', 'Commission', 'Other'];

export default function ExpensesTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeFinanceStyles);
  const { cols } = useResponsive();
  const { showToast } = useApp();
  const { entries, extrasLoading, error, reload } = useLedger();
  const [period, setPeriod] = useState<Period>('This month');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<LedgerEntry | null>(null);
  const [actionError, setActionError] = useState<string>();

  const expenses = useMemo(() => entries.filter((e) => e.direction === 'out' && PERIOD_MONTHS[period].includes(e.date.slice(0, 7))), [entries, period]);
  const total = totalExpense(expenses);
  const breakdown = EXPENSE_CATEGORIES.map((c, i) => ({ label: c, value: sumCategories(expenses, [c]), color: colors.chart[i % colors.chart.length] })).filter((i) => i.value > 0);

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await removeLedgerEntry(removing.id);
      showToast('Expense removed');
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
    setRemoving(null);
  };

  if (error || extrasLoading) return <ResourceState loading={extrasLoading} error={error} onRetry={reload} />;

  return (
    <View>
      <PeriodBar period={period} onChange={setPeriod} />
      <Grid cols={cols(2, 3, 5)}>
        <StatTile emphasis label="Total expenses" value={formatINRCompact(total)} hint={formatINR(total)} icon={(c) => <Receipt size={16} color={c} />} />
        <StatTile label="Maintenance" value={formatINRCompact(sumCategories(expenses, ['Maintenance']))} tone="warning" icon={(c) => <Wrench size={16} color={c} />} />
        <StatTile label="Fuel" value={formatINRCompact(sumCategories(expenses, ['Fuel']))} tone="warm" icon={(c) => <Fuel size={16} color={c} />} />
        <StatTile label="Toll" value={formatINRCompact(sumCategories(expenses, ['Toll']))} tone="info" icon={(c) => <Route size={16} color={c} />} />
        <StatTile label="Other" value={formatINRCompact(sumCategories(expenses, ['Other']))} hint="Rent, wash, permits" tone="neutral" />
      </Grid>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.cardTitle}>Expense breakdown</Text>
        <Text style={[styles.cardSub, { marginBottom: 14 }]}>{PERIOD_CAPTION[period]}</Text>
        {breakdown.length ? (
          <DonutChart items={breakdown} centerValue={formatINRCompact(total)} centerLabel="Total" formatValue={formatINRCompact} />
        ) : (
          <EmptyState compact title="No expenses" message="Nothing recorded in this period." />
        )}
      </Card>

      <Section title="Expense entries" subtitle="Entries you add this session can be removed" action={<Button label="Add expense" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setAdding(true)} />}>
        {actionError ? <Text style={styles.formError}>{actionError}</Text> : null}
        <LedgerTable entries={expenses} categories={EXPENSE_CATEGORIES} emptyLabel="expenses" filename="keygo-expenses.csv" onDelete={setRemoving} />
      </Section>

      {adding ? (
        <AddExpenseSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            showToast('Expense added');
            reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        visible={!!removing}
        title="Remove this expense?"
        message={removing ? `${removing.reference} (${formatINR(removing.amount)}) will be removed from the ledger and every report.` : undefined}
        confirmLabel="Remove expense"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}

function AddExpenseSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const styles = useThemedStyles(makeFinanceStyles);
  const { isPhone } = useResponsive();
  const { vehicles, today } = useApp();
  const [category, setCategory] = useState<LedgerCategory>('Fuel');
  const [vehicleId, setVehicleId] = useState('fleet');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();

  const amount = Number(amountText);
  const errors = {
    amount: !amountText.trim() || Number.isNaN(amount) || amount <= 0 ? 'Enter an amount above zero' : undefined,
    date: dateError(date),
    reference: reference.trim().length < 3 ? 'Say what this was for, or give a bill number' : undefined,
  };
  const valid = !errors.amount && !errors.date && !errors.reference;

  const save = async () => {
    setSubmitted(true);
    if (!valid || saving) return;
    setSaving(true);
    setSaveError(undefined);
    try {
      await addExpense({ date: date.trim(), category, amount, vehicleId: vehicleId === 'fleet' ? undefined : vehicleId, reference: reference.trim() });
      onSaved();
    } catch (e) {
      setSaveError((e as Error).message);
      setSaving(false);
    }
  };

  const vehicleOptions = ['fleet', ...vehicles.map((v) => v.id)];
  return (
    <FormSheet
      visible
      title="Add expense"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Saving…' : 'Add expense'} disabled={saving} onPress={save} />
        </>
      }>
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}
      <Text style={styles.label}>Category</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={MANUAL_CATEGORIES} value={category} onChange={setCategory} scroll={isPhone} />
      </View>
      <Text style={styles.label}>Vehicle</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup
          options={vehicleOptions}
          labels={{ fleet: 'Fleet-wide', ...Object.fromEntries(vehicles.map((v) => [v.id, v.name])) }}
          value={vehicleId}
          onChange={setVehicleId}
          scroll={isPhone}
        />
      </View>
      <FormRow>
        <Field label="Amount (₹)" required value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" error={submitted ? errors.amount : undefined} />
        <Field label="Date" required value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={submitted ? errors.date : undefined} />
      </FormRow>
      <Field label="Reference" required value={reference} onChangeText={setReference} placeholder="Bill number, vendor or purpose" error={submitted ? errors.reference : undefined} />
    </FormSheet>
  );
}
