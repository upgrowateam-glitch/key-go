import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, IndianRupee, RotateCcw, Timer, Wallet } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, DataTable, EmptyState, Field, Grid, Section, SegmentedControl, StatTile, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../lib/format';
import { useResource } from '../../services/mockClient';
import { fetchPayouts, markPayoutPaid } from '../../services/people';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, TotalRow, usePaged } from '../finance/tableTools';

const KINDS = ['All', 'Staff'] as const;
const STATUS = ['All', 'Unpaid', 'Paid'] as const;
const SORTS = ['Name', 'Net payable'] as const;

interface PayrollRow {
  id: string;
  name: string;
  role: string;
  kind: 'Staff' | 'Drivers';
  base: number;
  /** Trip allowance for staff, estimated commission for drivers. */
  variable: number;
  otHours: number;
  otEstimate: number;
  deductions: number;
  net: number;
  paidRef?: string;
}

export default function PayrollTab() {
  const styles = useThemedStyles(makeStyles);
  const { cols, isPhone } = useResponsive();
  const { staffPunches, today, showToast } = useApp();
  const res = useResource(fetchPayouts);
  const [otRateText, setOtRateText] = useState('150');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All');
  const [status, setStatus] = useState<(typeof STATUS)[number]>('All');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Name');
  const [paying, setPaying] = useState<PayrollRow | null>(null);
  const [actionError, setActionError] = useState<string>();

  const month = today.slice(0, 7);
  const otRate = Number(otRateText);
  const otRateError = otRateText.trim() === '' || Number.isNaN(otRate) || otRate < 0 ? 'Enter a valid rate' : undefined;
  const safeRate = otRateError ? 0 : otRate;

  const all = useMemo<PayrollRow[]>(() => {
    const paid = (id: string) => res.data?.find((p) => p.personId === id && p.month === month);
    const staff: PayrollRow[] = staffPunches.map((s) => {
      const otEstimate = s.overtimeHours * safeRate;
      const payout = paid(s.id);
      return {
        id: s.id,
        name: s.staffName,
        role: s.role,
        kind: 'Staff',
        base: s.baseSalary,
        variable: s.tripAllowance,
        otHours: s.overtimeHours,
        otEstimate,
        deductions: s.deductions,
        net: payout?.amount ?? s.baseSalary + s.tripAllowance + otEstimate - s.deductions,
        paidRef: payout?.txnRef,
      };
    });
    // Drivers are paid in the Driver Pay tab (salary, trip commission, advances, deductions)
    return staff;
  }, [staffPunches, safeRate, res.data, month]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => kind === 'All' || r.kind === kind)
      .filter((r) => status === 'All' || (status === 'Paid') === !!r.paidRef)
      .filter((r) => !q || `${r.name} ${r.role} ${r.paidRef ?? ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === 'Net payable' ? b.net - a.net : a.name.localeCompare(b.name)));
  }, [all, kind, status, query, sort]);
  const paged = usePaged(rows);

  const total = rows.reduce(
    (t, r) => ({
      base: t.base + r.base,
      variable: t.variable + r.variable,
      otHours: t.otHours + r.otHours,
      otEstimate: t.otEstimate + r.otEstimate,
      deductions: t.deductions + r.deductions,
      net: t.net + r.net,
    }),
    { base: 0, variable: 0, otHours: 0, otEstimate: 0, deductions: 0, net: 0 }
  );
  const netAll = all.reduce((s, r) => s + r.net, 0);
  const paidAll = all.filter((r) => r.paidRef).reduce((s, r) => s + r.net, 0);
  const filtered = !!query.trim() || kind !== 'All' || status !== 'All';
  const reset = () => {
    setQuery('');
    setKind('All');
    setStatus('All');
  };

  const columns: Column<PayrollRow>[] = [
    {
      key: 'name',
      label: 'Person',
      flex: 1.6,
      minWidth: 190,
      render: (r) => (
        <View>
          <Text style={styles.cellStrong}>{r.name}</Text>
          <Text style={styles.sub}>{r.role}</Text>
        </View>
      ),
    },
    { key: 'base', label: 'Base salary', minWidth: 110, align: 'right', value: (r) => formatINR(r.base) },
    { key: 'variable', label: 'Allowance / commission', minWidth: 130, align: 'right', value: (r) => formatINR(r.variable) },
    { key: 'ot', label: 'Overtime (est.)', minWidth: 130, align: 'right', value: (r) => `${formatINR(r.otEstimate)} · ${r.otHours}h` },
    { key: 'deductions', label: 'Deductions', minWidth: 100, align: 'right', value: (r) => (r.deductions ? `−${formatINR(r.deductions)}` : formatINR(0)) },
    { key: 'net', label: 'Net payable', minWidth: 110, align: 'right', render: (r) => <Text style={[styles.cellStrong, { textAlign: 'right' }]}>{formatINR(r.net)}</Text> },
    {
      key: 'status',
      label: 'Status',
      minWidth: 150,
      render: (r) =>
        r.paidRef ? (
          <View style={{ gap: 2 }}>
            <Badge label="Paid" tone="success" />
            <Text style={styles.sub}>{r.paidRef}</Text>
          </View>
        ) : (
          <Button label="Mark paid" size="sm" variant="outline" disabled={!!otRateError} onPress={() => setPaying(r)} />
        ),
    },
  ];

  const confirmPay = async () => {
    if (!paying) return;
    const target = paying;
    setPaying(null);
    setActionError(undefined);
    try {
      const payout = await markPayoutPaid({ personId: target.id, personName: target.name, month, amount: target.net });
      showToast(`${target.name} paid ${formatINR(target.net)} · ${payout.txnRef}`);
      res.reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;

  return (
    <View>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 8 }}>
        <StatTile emphasis label="Payroll (est.)" value={formatINRCompact(netAll)} hint="September, incl. estimates" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Paid" value={formatINRCompact(paidAll)} hint={`${all.filter((r) => r.paidRef).length} of ${all.length} people`} tone="success" icon={(c) => <CheckCircle2 size={16} color={c} />} />
        <StatTile label="Still to pay" value={formatINRCompact(netAll - paidAll)} tone="warning" icon={(c) => <Wallet size={16} color={c} />} />
        <StatTile label="Overtime" value={`${all.reduce((s, r) => s + r.otHours, 0)} h`} hint={formatINR(all.reduce((s, r) => s + r.otEstimate, 0))} tone="info" icon={(c) => <Timer size={16} color={c} />} />
      </Grid>

      <Section title="Staff salary summary" subtitle="Net payable = base + allowance + overtime estimate − deductions. Drivers are paid in the Driver Pay tab.">
        <Card style={{ marginBottom: 12 }}>
          <View style={[{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }, isPhone && { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flex: 1, maxWidth: isPhone ? undefined : 260 }}>
              <Field label="Overtime rate (₹ per hour)" value={otRateText} onChangeText={setOtRateText} keyboardType="number-pad" error={otRateError} hint="Configurable · pending business rules" />
            </View>
            <Text style={[styles.sub, { flex: 1, marginTop: isPhone ? 0 : 24 }]}>
              Overtime and commission are estimates until the policies are confirmed. Base salary, trip allowance and deductions come from staff records. Marking someone paid records the amount shown, gives it a reference and posts it to Finance. No money moves.
            </Text>
          </View>
        </Card>
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Name, role or reference" />}>
          <FilterGroup label="Type">
            <SegmentedControl options={KINDS} value={kind} onChange={setKind} />
          </FilterGroup>
          <FilterGroup label="Status">
            <SegmentedControl options={STATUS} value={status} onChange={setStatus} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
          </FilterGroup>
          <CsvButton
            data={() => ({
              filename: `keygo-payroll-${month}.csv`,
              headers: ['Name', 'Role', 'Base', 'Allowance or commission', 'Overtime hours', 'Overtime estimate', 'Deductions', 'Net payable', 'Payout ref'],
              rows: rows.map((r) => [r.name, r.role, r.base, r.variable, r.otHours, r.otEstimate, r.deductions, r.net, r.paidRef ?? '']),
            })}
          />
          {filtered ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(r) => r.id}
          empty={<EmptyState compact title="No payroll" message={filtered ? 'Nothing matches these filters.' : 'Add staff to see payroll.'} />}
          footer={
            rows.length ? (
              <TotalRow
                columns={columns}
                cells={{
                  name: 'Total',
                  base: formatINR(total.base),
                  variable: formatINR(total.variable),
                  ot: `${formatINR(total.otEstimate)} · ${total.otHours}h`,
                  deductions: total.deductions ? `−${formatINR(total.deductions)}` : formatINR(0),
                  net: formatINR(total.net),
                }}
              />
            ) : null
          }
        />
        <Pager paged={paged} />
      </Section>

      <ConfirmDialog
        visible={!!paying}
        title={`Mark ${paying?.name ?? ''} as paid?`}
        message={paying ? `Records ${formatINR(paying.net)} as September salary and adds it to Finance as an expense. This cannot be undone in the portal.` : undefined}
        confirmLabel="Mark paid"
        onConfirm={confirmPay}
        onCancel={() => setPaying(null)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 1,
    },
    cellStrong: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
  });
