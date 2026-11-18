import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BadgePercent, IndianRupee, Plus, ShieldCheck, Undo2 } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, Column, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, Section, SegmentedControl, StatTile, Tone } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useResource } from '../../services/mockClient';
import {
  addDepositEntry,
  AppliedDiscount,
  applyDiscount,
  DepositEntry,
  DiscountRule,
  loadDepositsAndDiscounts,
  removeAppliedDiscount,
  removeDiscountRule,
  saveDiscountRule,
  setDiscountRuleActive,
} from '../../services/agreements';
import type { Agreement } from '../../types';
import { FilterGroup, ListToolbar, Pager, parseAmount, useCommonStyles, usePaged } from './listTools';

type DepositState = 'Held' | 'Part released' | 'Released';
const DEPOSIT_FILTERS = ['All', 'Held', 'Part released', 'Released'] as const;
type DepositFilter = (typeof DEPOSIT_FILTERS)[number];
const DEPOSIT_TONE: Record<DepositState, Tone> = { Held: 'info', 'Part released': 'warning', Released: 'success' };
const ENTRY_KINDS = ['Refund', 'Deduction'] as const;
const RULE_KINDS = ['Percent', 'Flat'] as const;

interface DepositRow {
  agreement: Agreement;
  entries: DepositEntry[];
  refunded: number;
  deducted: number;
  balance: number;
  state: DepositState;
}

interface EntryForm {
  row: DepositRow;
  kind: DepositEntry['kind'];
  amount: string;
  reason: string;
}
interface DiscountForm {
  agreementId: string;
  amount: string;
  reason: string;
}
interface RuleForm {
  id?: string;
  name: string;
  kind: DiscountRule['kind'];
  value: string;
  appliesTo: string;
}
type Errors = Record<string, string | undefined>;

export default function DepositsDiscountsTab() {
  const styles = useCommonStyles();
  const { cols, isPhone } = useResponsive();
  const { agreements, showToast } = useApp();
  const res = useResource(loadDepositsAndDiscounts);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DepositFilter>('All');
  const [entryForm, setEntryForm] = useState<EntryForm | null>(null);
  const [confirmEntry, setConfirmEntry] = useState<EntryForm | null>(null);
  const [discountForm, setDiscountForm] = useState<DiscountForm | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [removeDiscount, setRemoveDiscount] = useState<AppliedDiscount | null>(null);
  const [toggleRule, setToggleRule] = useState<DiscountRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<DiscountRule | null>(null);

  const deposits = res.data?.deposits;
  const rows = useMemo<DepositRow[]>(
    () =>
      agreements.map((a) => {
        const entries = (deposits ?? []).filter((d) => d.agreementId === a.id);
        const refunded = entries.filter((d) => d.kind === 'Refund').reduce((s, d) => s + d.amount, 0);
        const deducted = entries.filter((d) => d.kind === 'Deduction').reduce((s, d) => s + d.amount, 0);
        const balance = Math.max(0, a.securityDeposit - refunded - deducted);
        const state: DepositState = balance === 0 ? 'Released' : refunded + deducted > 0 ? 'Part released' : 'Held';
        return { agreement: a, entries, refunded, deducted, balance, state };
      }),
    [agreements, deposits]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (filter === 'All' || r.state === filter) &&
          (!q || [r.agreement.id, r.agreement.bookingId, r.agreement.customerName, r.agreement.vehicleNumber].some((s) => s.toLowerCase().includes(q)))
      )
      .sort((a, b) => b.balance - a.balance);
  }, [rows, query, filter]);
  const paged = usePaged(filtered, `${query}|${filter}`, 8);

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;
  if (!res.data) return null;
  const data = res.data;

  const fail = (e: Error) => showToast(e.message);
  const filtersActive = !!query || filter !== 'All';
  const reset = () => {
    setQuery('');
    setFilter('All');
  };
  const held = rows.reduce((s, r) => s + r.balance, 0);
  const refunded = rows.reduce((s, r) => s + r.refunded, 0);
  const deducted = rows.reduce((s, r) => s + r.deducted, 0);
  const seedDiscounts = agreements.reduce((s, a) => s + a.discount, 0);
  const appliedTotal = data.applied.reduce((s, d) => s + d.amount, 0);

  const openEntry = (row: DepositRow, kind: DepositEntry['kind']) => {
    setErrors({});
    setEntryForm({ row, kind, amount: kind === 'Refund' ? String(row.balance) : '', reason: '' });
  };
  const reviewEntry = () => {
    if (!entryForm) return;
    const e: Errors = {};
    const amount = parseAmount(entryForm.amount);
    if (!(amount > 0)) e.amount = 'Enter an amount above zero';
    else if (amount > entryForm.row.balance) e.amount = `Only ${formatINR(entryForm.row.balance)} is still held`;
    if (entryForm.reason.trim().length < 3) e.reason = 'Give a reason for this entry';
    setErrors(e);
    if (Object.keys(e).length) return;
    setConfirmEntry(entryForm);
    setEntryForm(null);
  };
  const submitEntry = () => {
    if (!confirmEntry) return;
    addDepositEntry({
      agreementId: confirmEntry.row.agreement.id,
      kind: confirmEntry.kind,
      amount: Math.round(parseAmount(confirmEntry.amount)),
      reason: confirmEntry.reason.trim(),
    }).then((d) => {
      res.setData(d);
      showToast(`Deposit ${confirmEntry.kind.toLowerCase()} recorded`);
    }, fail);
    setConfirmEntry(null);
  };

  const openDiscount = () => {
    setErrors({});
    setDiscountForm({ agreementId: agreements[0]?.id ?? '', amount: '', reason: '' });
  };
  const submitDiscount = () => {
    if (!discountForm) return;
    const e: Errors = {};
    const a = agreements.find((x) => x.id === discountForm.agreementId);
    const amount = parseAmount(discountForm.amount);
    if (!a) e.agreementId = 'Select an agreement';
    if (!(amount > 0)) e.amount = 'Enter an amount above zero';
    else if (a && amount > a.rentalAmount) e.amount = `Cannot exceed the ${formatINR(a.rentalAmount)} rental`;
    if (discountForm.reason.trim().length < 3) e.reason = 'Give a reason for the discount';
    setErrors(e);
    if (Object.keys(e).length) return;
    applyDiscount({ agreementId: discountForm.agreementId, amount: Math.round(amount), reason: discountForm.reason.trim() }).then((d) => {
      res.setData(d);
      setDiscountForm(null);
      showToast('Discount applied');
    }, fail);
  };

  const openRule = (r?: DiscountRule) => {
    setErrors({});
    setRuleForm(r ? { id: r.id, name: r.name, kind: r.kind, value: String(r.value), appliesTo: r.appliesTo } : { name: '', kind: 'Percent', value: '', appliesTo: '' });
  };
  const submitRule = () => {
    if (!ruleForm) return;
    const e: Errors = {};
    const value = parseAmount(ruleForm.value);
    if (ruleForm.name.trim().length < 3) e.name = 'Enter a rule name';
    if (!(value > 0)) e.value = 'Enter a value above zero';
    else if (ruleForm.kind === 'Percent' && value > 100) e.value = 'A percentage cannot exceed 100';
    if (ruleForm.appliesTo.trim().length < 3) e.appliesTo = 'Say when this discount applies';
    setErrors(e);
    if (Object.keys(e).length) return;
    saveDiscountRule({ name: ruleForm.name.trim(), kind: ruleForm.kind, value, appliesTo: ruleForm.appliesTo.trim() }, ruleForm.id).then((d) => {
      res.setData(d);
      setRuleForm(null);
      showToast('Discount rule saved');
    }, fail);
  };

  const columns: Column<DepositRow>[] = [
    {
      key: 'agreement',
      label: 'Agreement',
      flex: 1.3,
      minWidth: 170,
      render: (r) => (
        <View>
          <Text style={styles.strong}>{r.agreement.id}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {r.agreement.customerName}
          </Text>
        </View>
      ),
    },
    { key: 'deposit', label: 'Deposit', flex: 0.8, minWidth: 90, align: 'right', value: (r) => formatINR(r.agreement.securityDeposit) },
    { key: 'deducted', label: 'Deducted', flex: 0.8, minWidth: 90, align: 'right', value: (r) => (r.deducted ? formatINR(r.deducted) : '—') },
    { key: 'refunded', label: 'Refunded', flex: 0.8, minWidth: 90, align: 'right', value: (r) => (r.refunded ? formatINR(r.refunded) : '—') },
    { key: 'balance', label: 'Still held', flex: 0.8, minWidth: 90, align: 'right', render: (r) => <Text style={styles.strong}>{formatINR(r.balance)}</Text> },
    { key: 'state', label: 'Status', flex: 0.9, minWidth: 110, render: (r) => <Badge label={r.state} tone={DEPOSIT_TONE[r.state]} /> },
    {
      key: 'actions',
      label: 'Actions',
      flex: 1.4,
      minWidth: 180,
      render: (r) =>
        r.balance > 0 ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Button label="Refund" size="sm" variant="outline" onPress={() => openEntry(r, 'Refund')} />
            <Button label="Deduct" size="sm" variant="ghost" onPress={() => openEntry(r, 'Deduction')} />
          </View>
        ) : (
          <Text style={styles.sub}>Fully released</Text>
        ),
    },
  ];

  return (
    <View>
      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Deposits held" value={formatINRCompact(held)} hint="Not yet released" emphasis icon={(c) => <ShieldCheck size={16} color={c} />} />
        <StatTile label="Refunded" value={formatINRCompact(refunded)} tone="success" icon={(c) => <Undo2 size={16} color={c} />} />
        <StatTile label="Deducted" value={formatINRCompact(deducted)} tone="warning" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Discounts given" value={formatINRCompact(seedDiscounts + appliedTotal)} tone="info" hint={`${data.rules.filter((r) => r.active).length} active rules`} icon={(c) => <BadgePercent size={16} color={c} />} />
      </Grid>

      <Section title="Security deposits" subtitle="Largest balance first">
        <ListToolbar query={query} onQuery={setQuery} placeholder="Agreement, booking, customer or vehicle" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Status">
            <ChipGroup options={DEPOSIT_FILTERS} value={filter} onChange={setFilter} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(r) => r.agreement.id}
          empty={
            <EmptyState
              compact
              title={agreements.length ? 'No deposits match' : 'No deposits yet'}
              message={agreements.length ? 'Try another search or status.' : 'Deposits appear once an agreement is signed.'}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          }
        />
        <Pager paged={paged} />
      </Section>

      <Section
        title="Discounts on agreements"
        subtitle="Goodwill amounts given after signing"
        action={<Button label="Apply discount" size="sm" icon={(c) => <Plus size={14} color={c} />} disabled={!agreements.length} onPress={openDiscount} />}>
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {data.applied.length === 0 ? (
            <EmptyState compact title="No discounts applied" message="Discounts you apply to an agreement are listed here." icon={(c) => <BadgePercent size={22} color={c} />} />
          ) : (
            data.applied.map((d) => (
              <View key={d.id} style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.strong}>{d.agreementId}</Text>
                  <Text style={styles.sub}>
                    {d.reason} · {formatDate(d.date)}
                  </Text>
                </View>
                <Text style={styles.strong}>{formatINR(d.amount)}</Text>
                <Button label="Remove" size="sm" variant="danger" onPress={() => setRemoveDiscount(d)} />
              </View>
            ))
          )}
        </Card>
      </Section>

      <Section
        title="Discount rules"
        subtitle="Standard offers staff can quote"
        action={<Button label="Add rule" size="sm" variant="outline" icon={(c) => <Plus size={14} color={c} />} onPress={() => openRule()} />}>
        {data.rules.length === 0 ? (
          <Card>
            <EmptyState compact title="No discount rules" message="Add a rule to standardise what staff can offer." />
          </Card>
        ) : (
          <Grid cols={cols(1, 2, 3)}>
            {data.rules.map((r) => (
              <Card key={r.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Badge label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'success' : 'neutral'} />
                </View>
                <Text style={styles.cardTitle}>{r.kind === 'Percent' ? `${r.value}% off` : `${formatINR(r.value)} off`}</Text>
                <Text style={styles.sub}>{r.appliesTo}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Button label="Edit" size="sm" variant="outline" onPress={() => openRule(r)} />
                  <Button label={r.active ? 'Deactivate' : 'Activate'} size="sm" variant="ghost" onPress={() => setToggleRule(r)} />
                  <Button label="Delete" size="sm" variant="danger" onPress={() => setDeleteRule(r)} />
                </View>
              </Card>
            ))}
          </Grid>
        )}
      </Section>

      <FormSheet
        visible={!!entryForm}
        title={entryForm?.kind === 'Deduction' ? 'Deduct from deposit' : 'Refund deposit'}
        onClose={() => setEntryForm(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setEntryForm(null)} />
            <Button label="Continue" onPress={reviewEntry} />
          </>
        }>
        {entryForm ? (
          <>
            <Text style={styles.title}>{entryForm.row.agreement.id}</Text>
            <Text style={[styles.sub, { marginBottom: 14 }]}>
              {entryForm.row.agreement.customerName} · {formatINR(entryForm.row.balance)} still held
            </Text>
            <SegmentedControl options={ENTRY_KINDS} value={entryForm.kind} onChange={(kind) => setEntryForm({ ...entryForm, kind })} style={{ marginBottom: 14 }} />
            <Field label="Amount (₹)" required keyboardType="number-pad" value={entryForm.amount} onChangeText={(amount) => setEntryForm({ ...entryForm, amount })} error={errors.amount} />
            <Field label="Reason" required value={entryForm.reason} onChangeText={(reason) => setEntryForm({ ...entryForm, reason })} placeholder="e.g. Toll charges, damage, balance refund" error={errors.reason} />
          </>
        ) : null}
      </FormSheet>

      <FormSheet
        visible={!!discountForm}
        title="Apply discount"
        onClose={() => setDiscountForm(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setDiscountForm(null)} />
            <Button label="Apply discount" onPress={submitDiscount} />
          </>
        }>
        {discountForm ? (
          <>
            <Text style={styles.label}>Agreement</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup
                options={agreements.map((a) => a.id)}
                value={discountForm.agreementId}
                onChange={(agreementId) => setDiscountForm({ ...discountForm, agreementId })}
                labels={Object.fromEntries(agreements.map((a) => [a.id, `${a.id} · ${a.customerName}`]))}
                scroll
              />
              {errors.agreementId ? <Text style={styles.error}>{errors.agreementId}</Text> : null}
            </View>
            <Field label="Amount (₹)" required keyboardType="number-pad" value={discountForm.amount} onChangeText={(amount) => setDiscountForm({ ...discountForm, amount })} error={errors.amount} />
            <Field label="Reason" required value={discountForm.reason} onChangeText={(reason) => setDiscountForm({ ...discountForm, reason })} error={errors.reason} />
          </>
        ) : null}
      </FormSheet>

      <FormSheet
        visible={!!ruleForm}
        title={ruleForm?.id ? 'Edit discount rule' : 'Add discount rule'}
        onClose={() => setRuleForm(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setRuleForm(null)} />
            <Button label="Save rule" onPress={submitRule} />
          </>
        }>
        {ruleForm ? (
          <>
            <Field label="Rule name" required value={ruleForm.name} onChangeText={(name) => setRuleForm({ ...ruleForm, name })} error={errors.name} />
            <Text style={styles.label}>Type</Text>
            <SegmentedControl options={RULE_KINDS} value={ruleForm.kind} onChange={(kind) => setRuleForm({ ...ruleForm, kind })} labels={{ Percent: 'Percentage', Flat: 'Flat amount' }} style={{ marginBottom: 14 }} />
            <FormRow>
              <Field label={ruleForm.kind === 'Percent' ? 'Percentage' : 'Amount (₹)'} required keyboardType="number-pad" value={ruleForm.value} onChangeText={(value) => setRuleForm({ ...ruleForm, value })} error={errors.value} />
              <Field label="Applies to" required value={ruleForm.appliesTo} onChangeText={(appliesTo) => setRuleForm({ ...ruleForm, appliesTo })} error={errors.appliesTo} />
            </FormRow>
          </>
        ) : null}
      </FormSheet>

      <ConfirmDialog
        visible={!!confirmEntry}
        title={confirmEntry?.kind === 'Deduction' ? 'Deduct from deposit?' : 'Refund deposit?'}
        message={confirmEntry ? `${formatINR(Math.round(parseAmount(confirmEntry.amount)))} from ${confirmEntry.row.agreement.id} (${confirmEntry.row.agreement.customerName}): ${confirmEntry.reason.trim()}.` : undefined}
        confirmLabel={confirmEntry?.kind === 'Deduction' ? 'Record deduction' : 'Record refund'}
        onConfirm={submitEntry}
        onCancel={() => setConfirmEntry(null)}
      />
      <ConfirmDialog
        visible={!!removeDiscount}
        title="Remove discount?"
        message={removeDiscount ? `${formatINR(removeDiscount.amount)} on ${removeDiscount.agreementId} will be removed.` : undefined}
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (removeDiscount) removeAppliedDiscount(removeDiscount.id).then(res.setData, fail);
          setRemoveDiscount(null);
        }}
        onCancel={() => setRemoveDiscount(null)}
      />
      <ConfirmDialog
        visible={!!toggleRule}
        title={toggleRule?.active ? 'Deactivate rule?' : 'Activate rule?'}
        message={toggleRule ? `"${toggleRule.name}" will ${toggleRule.active ? 'no longer be offered' : 'be available to staff'}.` : undefined}
        confirmLabel={toggleRule?.active ? 'Deactivate' : 'Activate'}
        onConfirm={() => {
          if (toggleRule) setDiscountRuleActive(toggleRule.id, !toggleRule.active).then(res.setData, fail);
          setToggleRule(null);
        }}
        onCancel={() => setToggleRule(null)}
      />
      <ConfirmDialog
        visible={!!deleteRule}
        title="Delete rule?"
        message={deleteRule ? `"${deleteRule.name}" will be deleted.` : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteRule) removeDiscountRule(deleteRule.id).then(res.setData, fail);
          setDeleteRule(null);
        }}
        onCancel={() => setDeleteRule(null)}
      />
    </View>
  );
}
