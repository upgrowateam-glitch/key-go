import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { DataTable, EmptyState, SegmentedControl, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { formatINR } from '../../lib/format';
import { useThemeColors, useThemedStyles } from '../../theme';
import { FilterGroup, ListToolbar, TotalRow } from '../finance/tableTools';
import { sumCategories } from '../finance/useLedger';
import { expenseCategories, incomeCategories, inRange, makeReportStyles, PERIODS, ReportFrame, sumAmount, useReports } from './reportsShared';

interface PeriodRow {
  key: string;
  label: string;
  trips: number;
  days: number;
  income: number;
  expense: number;
  maintenance: number;
  tolls: number;
  net: number;
}

export default function PeriodReportsTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeReportStyles);
  const { fastagLogs } = useApp();
  const { buckets, scopedFinance, scopedBookings, scopedVehicles, period, setPeriod, category, windowLabel } = useReports();

  const rows = useMemo<PeriodRow[]>(() => {
    const numbers = new Set(scopedVehicles.map((v) => v.vehicleNumber));
    return buckets.map((b) => {
      const finance = scopedFinance.filter((e) => inRange(e.date, b.start, b.end));
      const trips = scopedBookings.filter((x) => inRange(x.pickupDate, b.start, b.end));
      const income = sumCategories(finance, incomeCategories);
      const expense = sumCategories(finance, expenseCategories);
      return {
        key: b.start,
        label: b.longLabel,
        trips: trips.length,
        days: trips.reduce((s, x) => s + x.days, 0),
        income,
        expense,
        maintenance: sumCategories(finance, ['Maintenance']),
        tolls: sumAmount(fastagLogs.filter((l) => (category === 'All' || numbers.has(l.vehicleNumber)) && inRange(l.dateTime, b.start, b.end))),
        net: income - expense,
      };
    });
  }, [buckets, scopedFinance, scopedBookings, scopedVehicles, fastagLogs, category]);

  const total = rows.reduce(
    (t, r) => ({ trips: t.trips + r.trips, days: t.days + r.days, income: t.income + r.income, expense: t.expense + r.expense, maintenance: t.maintenance + r.maintenance, tolls: t.tolls + r.tolls, net: t.net + r.net }),
    { trips: 0, days: 0, income: 0, expense: 0, maintenance: 0, tolls: 0, net: 0 }
  );

  const columns: Column<PeriodRow>[] = [
    { key: 'label', label: period === 'Daily' ? 'Day' : period === 'Weekly' ? 'Week' : 'Month', flex: 1.4, minWidth: 150, render: (r) => <Text style={styles.cellStrong}>{r.label}</Text> },
    { key: 'trips', label: 'Trips', minWidth: 70, flex: 0.5, align: 'right', value: (r) => r.trips },
    { key: 'days', label: 'Rental days', minWidth: 90, flex: 0.6, align: 'right', value: (r) => r.days },
    { key: 'income', label: 'Income', minWidth: 110, align: 'right', value: (r) => formatINR(r.income) },
    { key: 'expense', label: 'Expenses', minWidth: 110, align: 'right', value: (r) => formatINR(r.expense) },
    { key: 'maintenance', label: 'Maintenance', minWidth: 110, align: 'right', value: (r) => formatINR(r.maintenance) },
    { key: 'tolls', label: 'Tolls (FASTag)', minWidth: 110, align: 'right', value: (r) => formatINR(r.tolls) },
    {
      key: 'net',
      label: 'Net',
      minWidth: 110,
      align: 'right',
      render: (r) => <Text style={[styles.cellStrong, { color: r.net < 0 ? colors.danger : colors.success, textAlign: 'right' }]}>{formatINR(r.net, { sign: true })}</Text>,
    },
  ];

  return (
    <ReportFrame
      name={`${period} period`}
      csv={() => ({
        filename: `keygo-${period.toLowerCase()}-report.csv`,
        headers: [period, 'Trips', 'Rental days', 'Income', 'Expenses', 'Maintenance', 'Tolls (FASTag)', 'Net'],
        rows: rows.map((r) => [r.label, r.trips, r.days, r.income, r.expense, r.maintenance, r.tolls, r.net]),
      })}>
      <Text style={[styles.cardTitle, { marginBottom: 4 }]}>{period} report</Text>
      <Text style={[styles.muted, { marginBottom: 12 }]}>{windowLabel} · expenses already include maintenance and ledger tolls; the FASTag column shows crossings logged on the tag</Text>
      <ListToolbar>
        <FilterGroup label="Show">
          <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
        </FilterGroup>
      </ListToolbar>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        empty={<EmptyState compact title="No periods" message="Nothing to report for these filters." />}
        footer={
          <TotalRow
            columns={columns}
            cells={{
              label: 'Total',
              trips: String(total.trips),
              days: String(total.days),
              income: formatINR(total.income),
              expense: formatINR(total.expense),
              maintenance: formatINR(total.maintenance),
              tolls: formatINR(total.tolls),
              net: formatINR(total.net, { sign: true }),
            }}
          />
        }
      />
    </ReportFrame>
  );
}
