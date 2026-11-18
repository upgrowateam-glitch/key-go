import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Gavel, Plus } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, Column, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, Section, StatTile, Tone } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useResource } from '../../services/mockClient';
import { AssessedFine, assessFine, FineStatus, loadFines, PenaltyBasis, PenaltyRule, removePenalty, savePenalty, setFineStatus, setPenaltyActive } from '../../services/agreements';
import { FilterGroup, ListToolbar, Pager, parseAmount, useCommonStyles, usePaged } from './listTools';

const STATUS_FILTERS = ['All', 'Pending', 'Collected', 'Waived'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const SORTS = ['Newest', 'Oldest', 'Highest amount'] as const;
type Sort = (typeof SORTS)[number];
const BASES: PenaltyBasis[] = ['Flat', 'Per hour', 'Per day', 'Actual + fee'];
const STATUS_TONE: Record<FineStatus, Tone> = { Pending: 'warning', Collected: 'success', Waived: 'neutral' };

interface AssessForm {
  agreementId: string;
  ruleId: string;
  quantity: string;
  amount: string;
  note: string;
}
interface PenaltyForm {
  id?: string;
  label: string;
  amount: string;
  basis: PenaltyBasis;
}
type Errors = Record<string, string | undefined>;

export default function FinesTab() {
  const styles = useCommonStyles();
  const { cols, isPhone } = useResponsive();
  const { agreements, showToast } = useApp();
  const res = useResource(loadFines);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [sort, setSort] = useState<Sort>('Newest');
  const [assess, setAssess] = useState<AssessForm | null>(null);
  const [penalty, setPenalty] = useState<PenaltyForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [statusChange, setStatusChange] = useState<{ fine: AssessedFine; to: FineStatus } | null>(null);
  const [togglePenalty, setTogglePenalty] = useState<PenaltyRule | null>(null);
  const [deletePenalty, setDeletePenalty] = useState<PenaltyRule | null>(null);

  const assessed = res.data?.assessed;
  const customerOf = useMemo(() => new Map(agreements.map((a) => [a.id, a.customerName])), [agreements]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (assessed ?? [])
      .filter((f) => (status === 'All' || f.status === status) && (!q || [f.id, f.agreementId, f.label, customerOf.get(f.agreementId) ?? ''].some((s) => s.toLowerCase().includes(q))))
      .sort((a, b) => (sort === 'Highest amount' ? b.amount - a.amount : sort === 'Oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [assessed, status, query, sort, customerOf]);
  const paged = usePaged(filtered, `${query}|${status}|${sort}`);

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;
  if (!res.data) return null;
  const data = res.data;

  const fail = (e: Error) => showToast(e.message);
  const filtersActive = !!query || status !== 'All' || sort !== 'Newest';
  const reset = () => {
    setQuery('');
    setStatus('All');
    setSort('Newest');
  };
  const sum = (s: FineStatus) => data.assessed.filter((f) => f.status === s).reduce((t, f) => t + f.amount, 0);
  const activeRules = data.rules.filter((r) => r.active);

  const openAssess = () => {
    const rule = activeRules[0];
    setErrors({});
    setAssess({ agreementId: agreements[0]?.id ?? '', ruleId: rule?.id ?? '', quantity: '1', amount: rule ? String(rule.amount) : '', note: '' });
  };
  const pickRule = (ruleId: string) => {
    if (!assess) return;
    const rule = data.rules.find((r) => r.id === ruleId);
    setAssess({ ...assess, ruleId, quantity: '1', amount: rule ? String(rule.amount) : assess.amount });
  };
  const setQuantity = (quantity: string) => {
    if (!assess) return;
    const rule = data.rules.find((r) => r.id === assess.ruleId);
    const qty = parseAmount(quantity);
    setAssess({ ...assess, quantity, amount: rule && qty > 0 ? String(Math.round(rule.amount * qty)) : assess.amount });
  };
  const submitAssess = () => {
    if (!assess) return;
    const e: Errors = {};
    const rule = data.rules.find((r) => r.id === assess.ruleId);
    const amount = parseAmount(assess.amount);
    if (!assess.agreementId) e.agreementId = 'Select an agreement';
    if (!rule) e.ruleId = 'Select a penalty';
    if (!(amount > 0)) e.amount = 'Enter an amount above zero';
    setErrors(e);
    if (Object.keys(e).length || !rule) return;
    assessFine({ agreementId: assess.agreementId, label: rule.label, amount: Math.round(amount), note: assess.note.trim() || undefined }).then((d) => {
      res.setData(d);
      setAssess(null);
      showToast('Fine assessed');
    }, fail);
  };

  const openPenalty = (r?: PenaltyRule) => {
    setErrors({});
    setPenalty(r ? { id: r.id, label: r.label, amount: String(r.amount), basis: r.basis } : { label: '', amount: '', basis: 'Flat' });
  };
  const submitPenalty = () => {
    if (!penalty) return;
    const e: Errors = {};
    const amount = parseAmount(penalty.amount);
    if (penalty.label.trim().length < 3) e.label = 'Describe the penalty';
    if (!(amount > 0)) e.amount = 'Enter an amount above zero';
    setErrors(e);
    if (Object.keys(e).length) return;
    savePenalty({ label: penalty.label.trim(), amount: Math.round(amount), basis: penalty.basis }, penalty.id).then((d) => {
      res.setData(d);
      setPenalty(null);
      showToast('Penalty saved');
    }, fail);
  };

  const columns: Column<AssessedFine>[] = [
    { key: 'date', label: 'Date', flex: 0.8, minWidth: 100, value: (f) => formatDate(f.date) },
    {
      key: 'agreement',
      label: 'Agreement',
      flex: 1.2,
      minWidth: 150,
      render: (f) => (
        <View>
          <Text style={styles.strong}>{f.agreementId}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {customerOf.get(f.agreementId) ?? ''}
          </Text>
        </View>
      ),
    },
    {
      key: 'fine',
      label: 'Fine',
      flex: 1.6,
      minWidth: 190,
      render: (f) => (
        <View>
          <Text style={styles.body} numberOfLines={2}>
            {f.label}
          </Text>
          {f.note ? (
            <Text style={styles.sub} numberOfLines={2}>
              {f.note}
            </Text>
          ) : null}
        </View>
      ),
    },
    { key: 'amount', label: 'Amount', flex: 0.7, minWidth: 90, align: 'right', value: (f) => formatINR(f.amount) },
    { key: 'status', label: 'Status', flex: 0.8, minWidth: 100, render: (f) => <Badge label={f.status} tone={STATUS_TONE[f.status]} /> },
    {
      key: 'actions',
      label: 'Actions',
      flex: 1.2,
      minWidth: 170,
      render: (f) =>
        f.status === 'Pending' ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Button label="Collected" size="sm" variant="outline" onPress={() => setStatusChange({ fine: f, to: 'Collected' })} />
            <Button label="Waive" size="sm" variant="ghost" onPress={() => setStatusChange({ fine: f, to: 'Waived' })} />
          </View>
        ) : (
          <Button label="Reopen" size="sm" variant="ghost" onPress={() => setStatusChange({ fine: f, to: 'Pending' })} />
        ),
    },
  ];

  return (
    <View>
      <Grid cols={cols(1, 3, 3)}>
        <StatTile label="Pending fines" value={formatINRCompact(sum('Pending'))} hint={`${data.assessed.filter((f) => f.status === 'Pending').length} to collect`} emphasis icon={(c) => <AlertTriangle size={16} color={c} />} />
        <StatTile label="Collected" value={formatINRCompact(sum('Collected'))} tone="success" icon={(c) => <CheckCircle2 size={16} color={c} />} />
        <StatTile label="Waived" value={formatINRCompact(sum('Waived'))} tone="neutral" icon={(c) => <Gavel size={16} color={c} />} />
      </Grid>

      <Section
        title="Assessed fines"
        subtitle="Fines charged against a signed agreement"
        action={<Button label="Assess fine" size="sm" icon={(c) => <Plus size={14} color={c} />} disabled={!agreements.length || !activeRules.length} onPress={openAssess} />}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Fine, agreement or customer" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Status">
            <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll={isPhone} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(f) => f.id}
          empty={
            <EmptyState
              compact
              title={data.assessed.length ? 'No fines match' : 'No fines assessed'}
              message={data.assessed.length ? 'Try another search or status.' : 'Fines you assess appear here.'}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          }
        />
        <Pager paged={paged} />
      </Section>

      <Section
        title="Penalty schedule"
        subtitle="Active penalties are pre-filled on every new agreement"
        action={<Button label="Add penalty" size="sm" variant="outline" icon={(c) => <Plus size={14} color={c} />} onPress={() => openPenalty()} />}>
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {data.rules.length === 0 ? (
            <EmptyState compact title="No penalties" message="Add the penalties your agreements should list." icon={(c) => <Gavel size={22} color={c} />} />
          ) : (
            data.rules.map((r) => (
              <View key={r.id} style={[styles.row, { flexWrap: 'wrap' }]}>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <Text style={styles.strong}>{r.label}</Text>
                  <Text style={styles.sub}>
                    {formatINR(r.amount)} · {r.basis}
                  </Text>
                </View>
                <Badge label={r.active ? 'Active' : 'Inactive'} tone={r.active ? 'success' : 'neutral'} />
                <Button label="Edit" size="sm" variant="outline" onPress={() => openPenalty(r)} />
                <Button label={r.active ? 'Deactivate' : 'Activate'} size="sm" variant="ghost" onPress={() => setTogglePenalty(r)} />
                <Button label="Delete" size="sm" variant="danger" onPress={() => setDeletePenalty(r)} />
              </View>
            ))
          )}
        </Card>
      </Section>

      <FormSheet
        visible={!!assess}
        title="Assess fine"
        onClose={() => setAssess(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setAssess(null)} />
            <Button label="Assess fine" onPress={submitAssess} />
          </>
        }>
        {assess ? (
          <>
            <Text style={styles.label}>Agreement</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup
                options={agreements.map((a) => a.id)}
                value={assess.agreementId}
                onChange={(agreementId) => setAssess({ ...assess, agreementId })}
                labels={Object.fromEntries(agreements.map((a) => [a.id, `${a.id} · ${a.customerName}`]))}
                scroll
              />
              {errors.agreementId ? <Text style={styles.error}>{errors.agreementId}</Text> : null}
            </View>
            <Text style={styles.label}>Penalty</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup options={activeRules.map((r) => r.id)} value={assess.ruleId} onChange={pickRule} labels={Object.fromEntries(activeRules.map((r) => [r.id, r.label]))} />
              {errors.ruleId ? <Text style={styles.error}>{errors.ruleId}</Text> : null}
            </View>
            <FormRow>
              <Field label="Quantity" keyboardType="number-pad" value={assess.quantity} onChangeText={setQuantity} hint="Hours or days for timed penalties" />
              <Field label="Amount (₹)" required keyboardType="number-pad" value={assess.amount} onChangeText={(amount) => setAssess({ ...assess, amount })} error={errors.amount} />
            </FormRow>
            <Field label="Note" value={assess.note} onChangeText={(note) => setAssess({ ...assess, note })} placeholder="Optional" />
          </>
        ) : null}
      </FormSheet>

      <FormSheet
        visible={!!penalty}
        title={penalty?.id ? 'Edit penalty' : 'Add penalty'}
        onClose={() => setPenalty(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setPenalty(null)} />
            <Button label="Save penalty" onPress={submitPenalty} />
          </>
        }>
        {penalty ? (
          <>
            <Field label="Penalty" required value={penalty.label} onChangeText={(label) => setPenalty({ ...penalty, label })} error={errors.label} />
            <Field label="Amount (₹)" required keyboardType="number-pad" value={penalty.amount} onChangeText={(amount) => setPenalty({ ...penalty, amount })} error={errors.amount} />
            <Text style={styles.label}>Basis</Text>
            <ChipGroup options={BASES} value={penalty.basis} onChange={(basis) => setPenalty({ ...penalty, basis })} />
          </>
        ) : null}
      </FormSheet>

      <ConfirmDialog
        visible={!!statusChange}
        title={statusChange ? `Mark fine as ${statusChange.to.toLowerCase()}?` : ''}
        message={statusChange ? `${statusChange.fine.label}, ${formatINR(statusChange.fine.amount)} on ${statusChange.fine.agreementId}.` : undefined}
        confirmLabel={statusChange ? `Mark ${statusChange.to.toLowerCase()}` : 'Confirm'}
        onConfirm={() => {
          if (statusChange) setFineStatus(statusChange.fine.id, statusChange.to).then(res.setData, fail);
          setStatusChange(null);
        }}
        onCancel={() => setStatusChange(null)}
      />
      <ConfirmDialog
        visible={!!togglePenalty}
        title={togglePenalty?.active ? 'Deactivate penalty?' : 'Activate penalty?'}
        message={togglePenalty ? `"${togglePenalty.label}" will ${togglePenalty.active ? 'no longer be added to' : 'be added to'} new agreements.` : undefined}
        confirmLabel={togglePenalty?.active ? 'Deactivate' : 'Activate'}
        onConfirm={() => {
          if (togglePenalty) setPenaltyActive(togglePenalty.id, !togglePenalty.active).then(res.setData, fail);
          setTogglePenalty(null);
        }}
        onCancel={() => setTogglePenalty(null)}
      />
      <ConfirmDialog
        visible={!!deletePenalty}
        title="Delete penalty?"
        message={deletePenalty ? `"${deletePenalty.label}" will be removed from the schedule. Existing agreements are not affected.` : undefined}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deletePenalty) removePenalty(deletePenalty.id).then(res.setData, fail);
          setDeletePenalty(null);
        }}
        onCancel={() => setDeletePenalty(null)}
      />
    </View>
  );
}
