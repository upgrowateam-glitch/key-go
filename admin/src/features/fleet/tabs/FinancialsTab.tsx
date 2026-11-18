import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { IndianRupee, TrendingDown, TrendingUp } from 'lucide-react-native';
import { Badge, ChipGroup, Column, DataTable, EmptyState, Grid, Section, StatTile } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../../lib/format';
import { FinanceEntry, Vehicle } from '../../../types';
import { ListPager, usePaged } from '../ListPager';
import { LoanPanel } from './LoanPanel';
import { SalePanel } from './SalePanel';

const DIRECTIONS = ['All', 'Income', 'Expense'] as const;

const COLUMNS: Column<FinanceEntry>[] = [
  { key: 'date', label: 'Date', flex: 0.8, minWidth: 100, value: (e) => formatDate(e.date) },
  { key: 'category', label: 'Category', flex: 1, minWidth: 130, value: (e) => e.category },
  { key: 'reference', label: 'Reference', flex: 1.6, minWidth: 180, value: (e) => e.reference },
  { key: 'type', label: 'Type', flex: 0.7, minWidth: 90, render: (e) => <Badge label={e.direction === 'in' ? 'Income' : 'Expense'} tone={e.direction === 'in' ? 'success' : 'warning'} /> },
  { key: 'amount', label: 'Amount', flex: 0.8, minWidth: 100, align: 'right', value: (e) => formatINR(e.direction === 'in' ? e.amount : -e.amount) },
];

export function FinancialsTab({ v }: { v: Vehicle }) {
  const { cols } = useResponsive();
  const { financeEntries } = useApp();
  const [direction, setDirection] = useState<(typeof DIRECTIONS)[number]>('All');

  const own = useMemo(() => financeEntries.filter((e) => e.vehicleId === v.id).sort((a, b) => (a.date < b.date ? 1 : -1)), [financeEntries, v.id]);
  const income = own.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amount, 0);
  const expense = own.filter((e) => e.direction === 'out').reduce((s, e) => s + e.amount, 0);
  const paged = usePaged(own.filter((e) => direction === 'All' || (direction === 'Income') === (e.direction === 'in')));

  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label="Income recorded" value={formatINRCompact(income)} tone="success" icon={(c) => <TrendingUp size={16} color={c} />} />
        <StatTile label="Expenses recorded" value={formatINRCompact(expense)} tone="warning" icon={(c) => <TrendingDown size={16} color={c} />} />
        <StatTile label="Net" value={formatINRCompact(income - expense)} tone={income >= expense ? 'primary' : 'danger'} hint="Income − expenses, excl. purchase" />
        <StatTile label="Purchase cost" value={formatINRCompact(v.purchaseCost)} tone="neutral" icon={(c) => <IndianRupee size={16} color={c} />} hint={formatDate(v.purchaseDate)} />
      </Grid>

      <Section title="Income & expenses" subtitle={`${own.length} entries for this vehicle`} style={{ marginTop: 8 }}>
        <View style={{ marginBottom: 10 }}>
          <ChipGroup options={DIRECTIONS} value={direction} onChange={setDirection} />
        </View>
        <DataTable columns={COLUMNS} rows={paged.rows} rowKey={(e) => e.id} empty={<EmptyState compact title="No entries" message="Rental income, EMIs and running costs for this vehicle appear here." />} />
        <ListPager paged={paged} />
      </Section>

      <Section title="Loan & EMI">
        <LoanPanel v={v} />
      </Section>

      <Section title="Sale">
        <SalePanel v={v} />
      </Section>
    </View>
  );
}
