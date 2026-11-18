import React from 'react';
import { Text, View } from 'react-native';
import { BarChart, Card, DataTable, DonutChart, EmptyState, Grid, Section, type Column } from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../lib/format';
import type { LedgerCategory, LedgerEntry } from '../../services/finance';
import { useThemeColors, useThemedStyles } from '../../theme';
import { TotalRow } from '../finance/tableTools';
import { sumCategories } from '../finance/useLedger';
import { expenseCategories, incomeCategories, makeReportStyles, ReportFrame, sumAmount, useReports } from './reportsShared';

interface CategoryRow {
  category: string;
  count: number;
  amount: number;
  share: number;
}

function categoryRows(entries: LedgerEntry[], cats: LedgerCategory[]): CategoryRow[] {
  const total = sumCategories(entries, cats);
  return cats
    .map((c) => {
      const xs = entries.filter((e) => e.category === c);
      const amount = sumAmount(xs);
      return { category: c, count: xs.length, amount, share: total ? amount / total : 0 };
    })
    .filter((r) => r.count > 0);
}

function MoneySection({ kind }: { kind: 'income' | 'expense' }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeReportStyles);
  const { cols } = useResponsive();
  const { buckets, trend, windowFinance, windowLabel } = useReports();
  const rows = categoryRows(windowFinance, kind === 'income' ? incomeCategories : expenseCategories);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const columns: Column<CategoryRow>[] = [
    { key: 'category', label: 'Category', flex: 1.5, minWidth: 150, render: (r) => <Text style={styles.cellStrong}>{r.category}</Text> },
    { key: 'count', label: 'Entries', minWidth: 80, flex: 0.6, align: 'right', value: (r) => r.count },
    { key: 'amount', label: 'Amount', minWidth: 120, align: 'right', value: (r) => formatINR(r.amount) },
    { key: 'share', label: 'Share', minWidth: 80, flex: 0.6, align: 'right', value: (r) => `${(r.share * 100).toFixed(1)}%` },
  ];

  return (
    <Section title={kind === 'income' ? 'Income' : 'Expense'} subtitle={windowLabel}>
      <Grid cols={cols(1, 1, 2)} gap={16}>
        <Card>
          <Text style={styles.cardTitle}>{kind === 'income' ? 'Income by period' : 'Expenses by period'}</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>{windowLabel}</Text>
          {kind === 'income' ? (
            <BarChart
              labels={buckets.map((b) => b.label)}
              series={[
                { name: 'Rental income', values: trend.rental, color: colors.chart[0] },
                { name: 'Fine collection', values: trend.fines, color: colors.chart[1] },
              ]}
              formatValue={formatINRCompact}
            />
          ) : (
            <BarChart labels={buckets.map((b) => b.label)} series={[{ name: 'Expense', values: trend.expense, color: colors.chart[2] }]} formatValue={formatINRCompact} />
          )}
        </Card>
        <Card>
          <Text style={styles.cardTitle}>By category</Text>
          <Text style={[styles.muted, { marginBottom: 14 }]}>{windowLabel}</Text>
          {rows.length ? (
            <DonutChart items={rows.map((r) => ({ label: r.category, value: r.amount }))} centerValue={formatINRCompact(total)} centerLabel="Total" formatValue={formatINRCompact} />
          ) : (
            <EmptyState compact title={`No ${kind}`} message="Nothing recorded in this window." />
          )}
        </Card>
      </Grid>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.category}
        empty={<EmptyState compact title={`No ${kind}`} message="Nothing recorded in this window." />}
        footer={rows.length ? <TotalRow columns={columns} cells={{ category: 'Total', count: String(rows.reduce((s, r) => s + r.count, 0)), amount: formatINR(total), share: '100%' }} /> : null}
      />
    </Section>
  );
}

export default function IncomeExpenseTab() {
  const { windowFinance } = useReports();
  return (
    <ReportFrame
      name="Income & Expense"
      csv={() => ({
        filename: 'keygo-income-and-expense.csv',
        headers: ['Type', 'Category', 'Entries', 'Amount (INR)'],
        rows: [
          ...categoryRows(windowFinance, incomeCategories).map((r) => ['Income', r.category, r.count, r.amount]),
          ...categoryRows(windowFinance, expenseCategories).map((r) => ['Expense', r.category, r.count, r.amount]),
        ],
      })}>
      <View>
        <MoneySection kind="income" />
        <MoneySection kind="expense" />
      </View>
    </ReportFrame>
  );
}
