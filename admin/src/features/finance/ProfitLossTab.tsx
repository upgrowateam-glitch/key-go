import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Card, DataTable, Divider, Section, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../lib/format';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { makeFinanceStyles, PeriodBar } from './financeShared';
import { CsvButton } from './tableTools';
import { PERIOD_CAPTION, PERIOD_MONTHS, sumCategories, totalExpense, totalIncome, TREND_MONTHS, useLedger, type Period } from './useLedger';

const EXPENSE_LINES = ['Maintenance', 'Loan EMI', 'Fuel', 'Toll', 'Salary', 'Commission', 'Other'] as const;

interface MonthRow {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export default function ProfitLossTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeFinanceStyles);
  const local = useThemedStyles(makeStyles);
  const { fastagLogs } = useApp();
  const { entries, extrasLoading, error, reload } = useLedger();
  const [period, setPeriod] = useState<Period>('This month');

  const inPeriod = useMemo(() => entries.filter((e) => PERIOD_MONTHS[period].includes(e.date.slice(0, 7))), [entries, period]);
  const income = totalIncome(inPeriod);
  const expense = totalExpense(inPeriod);
  const net = income - expense;
  const unbilled = fastagLogs.filter((l) => !l.billedToCustomer && PERIOD_MONTHS[period].includes(l.dateTime.slice(0, 7))).reduce((s, l) => s + l.amount, 0);

  const months: MonthRow[] = TREND_MONTHS.map((m) => {
    const list = entries.filter((e) => e.date.startsWith(m.key));
    const i = totalIncome(list);
    const x = totalExpense(list);
    return { key: m.key, label: m.label, income: i, expense: x, net: i - x };
  });

  const columns: Column<MonthRow>[] = [
    { key: 'label', label: 'Month', minWidth: 90, value: (r) => `${r.label} 2026` },
    { key: 'income', label: 'Income', minWidth: 120, align: 'right', value: (r) => formatINR(r.income) },
    { key: 'expense', label: 'Expenses', minWidth: 120, align: 'right', value: (r) => formatINR(r.expense) },
    {
      key: 'net',
      label: 'Net',
      minWidth: 120,
      align: 'right',
      render: (r) => <Text style={[styles.cellStrong, { color: r.net < 0 ? colors.danger : colors.success, textAlign: 'right' }]}>{formatINR(r.net, { sign: true })}</Text>,
    },
    { key: 'margin', label: 'Margin', minWidth: 90, align: 'right', value: (r) => (r.income > 0 ? `${((r.net / r.income) * 100).toFixed(1)}%` : 'n/a') },
  ];

  if (error || extrasLoading) return <ResourceState loading={extrasLoading} error={error} onRetry={reload} />;

  return (
    <View>
      <PeriodBar period={period} onChange={setPeriod} />
      <Section
        title="Profit & loss statement"
        subtitle={PERIOD_CAPTION[period]}
        action={
          <CsvButton
            data={() => ({
              filename: `keygo-profit-and-loss-${period.toLowerCase().replace(/ /g, '-')}.csv`,
              headers: ['Line', 'Amount (INR)'],
              rows: [
                ['Rental income', sumCategories(inPeriod, ['Rental income'])],
                ['Fine collection', sumCategories(inPeriod, ['Fine collection'])],
                ['Total income', income],
                ...EXPENSE_LINES.map((c): [string, number] => [c, -sumCategories(inPeriod, [c])]),
                ['Total expenses', -expense],
                [net < 0 ? 'Net loss' : 'Net profit', net],
              ],
            })}
          />
        }>
        <Card>
          <Text style={local.group}>Income</Text>
          <Line label="Rental income" value={sumCategories(inPeriod, ['Rental income'])} />
          <Line label="Fine collection" value={sumCategories(inPeriod, ['Fine collection'])} />
          <Line label="Total income" value={income} strong />
          <Divider />
          <Text style={local.group}>Expenses</Text>
          {EXPENSE_LINES.map((c) => (
            <Line key={c} label={c} value={sumCategories(inPeriod, [c])} negative />
          ))}
          <Line label="Total expenses" value={expense} negative strong />
          <Divider />
          <View style={local.netRow}>
            <View style={{ flex: 1 }}>
              <Text style={local.netLabel}>{net < 0 ? 'Net loss' : 'Net profit'}</Text>
              <Text style={styles.cardSub}>Margin {income > 0 ? `${((net / income) * 100).toFixed(1)}%` : 'n/a'} of total income</Text>
            </View>
            <Text style={[local.netValue, { color: net < 0 ? colors.danger : colors.success }]}>{formatINR(net, { sign: true })}</Text>
          </View>
          {unbilled > 0 ? (
            <View style={styles.notice}>
              <AlertTriangle size={14} color={colors.warmText} />
              <Text style={styles.noticeText}>{formatINR(unbilled)} of FASTag tolls in this period are not yet billed to customers (recoverable).</Text>
            </View>
          ) : null}
          <Text style={[styles.cardSub, { marginTop: 12 }]}>Security deposits and their refunds are held for customers, so they are not part of this statement.</Text>
        </Card>
      </Section>

      <Section title="Month by month" subtitle="July – September 2026">
        <DataTable columns={columns} rows={months} rowKey={(r) => r.key} />
      </Section>
    </View>
  );
}

function Line({ label, value, negative, strong }: { label: string; value: number; negative?: boolean; strong?: boolean }) {
  const local = useThemedStyles(makeStyles);
  return (
    <View style={local.line}>
      <Text style={[local.lineLabel, strong && local.strong]}>{label}</Text>
      <Text style={[local.lineValue, strong && local.strong]}>
        {negative && value > 0 ? '−' : ''}
        {formatINR(value)}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    group: {
      color: colors.secondaryText,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    line: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 6,
    },
    lineLabel: {
      color: colors.txt,
      fontSize: 13,
      flex: 1,
    },
    lineValue: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '600',
    },
    strong: {
      fontWeight: '800',
    },
    netRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    netLabel: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
    },
    netValue: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
  });
