import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Fuel, Landmark, ReceiptText, TrendingUp, Wrench } from 'lucide-react-native';
import { Badge, BarChart, Card, DonutChart, Grid, Section, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../lib/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../services/finance';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { LedgerTable, makeFinanceStyles, PeriodBar } from './financeShared';
import { PERIOD_CAPTION, PERIOD_MONTHS, sumCategories, totalExpense, totalIncome, TREND_MONTHS, useLedger, type Period } from './useLedger';

export default function OverviewTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeFinanceStyles);
  const local = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const { fastagLogs } = useApp();
  const { entries, extrasLoading, error, reload } = useLedger();
  const [period, setPeriod] = useState<Period>('This month');

  const inPeriod = useMemo(() => entries.filter((e) => PERIOD_MONTHS[period].includes(e.date.slice(0, 7))), [entries, period]);
  const income = totalIncome(inPeriod);
  const expense = totalExpense(inPeriod);
  const net = income - expense;
  const margin = income > 0 ? (net / income) * 100 : 0;
  const fuel = sumCategories(inPeriod, ['Fuel']);
  const toll = sumCategories(inPeriod, ['Toll']);

  const trend = useMemo(() => {
    const month = (m: string) => entries.filter((e) => e.date.startsWith(m));
    return {
      income: TREND_MONTHS.map((m) => totalIncome(month(m.key))),
      expense: TREND_MONTHS.map((m) => totalExpense(month(m.key))),
    };
  }, [entries]);

  const breakdown = EXPENSE_CATEGORIES.map((c, i) => ({ label: c, value: sumCategories(inPeriod, [c]), color: colors.chart[i % colors.chart.length] })).filter((i) => i.value > 0);

  // Tolls recorded on FASTag but not yet billed to a customer (recoverable) — within the selected months.
  const unbilledTolls = fastagLogs
    .filter((l) => !l.billedToCustomer && PERIOD_MONTHS[period].includes(l.dateTime.slice(0, 7)))
    .reduce((s, l) => s + l.amount, 0);

  if (error || extrasLoading) return <ResourceState loading={extrasLoading} error={error} onRetry={reload} />;

  const loss = net < 0;
  return (
    <View>
      <PeriodBar period={period} onChange={setPeriod} />

      <Grid cols={cols(2, 3, 3)}>
        <StatTile label="Rental income" value={formatINRCompact(sumCategories(inPeriod, ['Rental income']))} hint={formatINR(sumCategories(inPeriod, ['Rental income']))} tone="success" icon={(c) => <TrendingUp size={16} color={c} />} />
        <StatTile label="Fine collection" value={formatINRCompact(sumCategories(inPeriod, ['Fine collection']))} hint="Late returns, damage & fines" tone="info" icon={(c) => <ReceiptText size={16} color={c} />} />
        <StatTile label="Maintenance" value={formatINRCompact(sumCategories(inPeriod, ['Maintenance']))} hint={formatINR(sumCategories(inPeriod, ['Maintenance']))} tone="warning" icon={(c) => <Wrench size={16} color={c} />} />
        <StatTile label="Loan EMI" value={formatINRCompact(sumCategories(inPeriod, ['Loan EMI']))} hint={formatINR(sumCategories(inPeriod, ['Loan EMI']))} tone="violet" icon={(c) => <Landmark size={16} color={c} />} />
        <StatTile label="Fuel + toll" value={formatINRCompact(fuel + toll)} hint={`Fuel ${formatINRCompact(fuel)} · Toll ${formatINRCompact(toll)}`} tone="warm" icon={(c) => <Fuel size={16} color={c} />} />
        <View
          style={[local.netTile, { borderColor: loss ? colors.danger : colors.primary, backgroundColor: loss ? colors.dangerGlow : colors.primarySoft }]}
          accessibilityLabel={`Net ${loss ? 'loss' : 'profit'} ${formatINR(net)}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <Text style={local.netTileLabel} numberOfLines={1}>
              Net profit / loss
            </Text>
            <Badge label={loss ? 'Loss' : 'Profit'} tone={loss ? 'danger' : 'success'} />
          </View>
          <Text style={[local.netTileValue, { color: loss ? colors.danger : colors.primaryText }]} numberOfLines={1} adjustsFontSizeToFit>
            {loss ? formatINRCompact(net) : `+${formatINRCompact(net)}`}
          </Text>
          <Text style={local.netTileHint} numberOfLines={1}>
            Margin {margin.toFixed(1)}%
          </Text>
        </View>
      </Grid>

      <Grid cols={cols(1, 1, 2)} gap={16} style={{ marginTop: 12 }}>
        <Card>
          <Text style={styles.cardTitle}>Income vs expense</Text>
          <Text style={styles.cardSub}>Monthly totals, July – September 2026</Text>
          <View style={{ marginTop: 14 }}>
            <BarChart
              labels={TREND_MONTHS.map((m) => m.label)}
              series={[
                { name: 'Income', values: trend.income, color: colors.chart[0] },
                { name: 'Expense', values: trend.expense, color: colors.chart[2] },
              ]}
              height={190}
              formatValue={formatINRCompact}
            />
          </View>
          <View style={local.trendLegend}>
            {TREND_MONTHS.map((m, i) => {
              const monthNet = trend.income[i] - trend.expense[i];
              return (
                <Text key={m.key} style={local.trendItem}>
                  {m.label}: <Text style={{ color: monthNet < 0 ? colors.danger : colors.success, fontWeight: '800' }}>{formatINRCompact(monthNet)}</Text> net
                </Text>
              );
            })}
          </View>
        </Card>
        <Card>
          <Text style={styles.cardTitle}>Expense breakdown</Text>
          <Text style={styles.cardSub}>By category · {PERIOD_CAPTION[period]}</Text>
          <View style={{ marginTop: 14 }}>
            {breakdown.length ? (
              <DonutChart items={breakdown} centerValue={formatINRCompact(expense)} centerLabel="Total" formatValue={formatINRCompact} />
            ) : (
              <Text style={styles.cardSub}>No expenses recorded for this period.</Text>
            )}
          </View>
        </Card>
      </Grid>

      {unbilledTolls > 0 ? (
        <View style={styles.notice}>
          <AlertTriangle size={14} color={colors.warmText} />
          <Text style={styles.noticeText}>{formatINR(unbilledTolls)} of FASTag tolls in this period are not yet billed to customers (recoverable).</Text>
        </View>
      ) : null}

      <Section title="Transactions" subtitle={PERIOD_CAPTION[period]}>
        <LedgerTable entries={inPeriod} categories={[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]} filename={`keygo-transactions-${period.toLowerCase().replace(/ /g, '-')}.csv`} />
      </Section>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    trendLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
    },
    trendItem: {
      color: colors.muted,
      fontSize: 12,
    },
    netTile: {
      borderRadius: 16,
      borderWidth: 2,
      padding: 13,
      minHeight: 104,
      justifyContent: 'space-between',
    },
    netTileLabel: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
    },
    netTileValue: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.6,
      marginTop: 8,
    },
    netTileHint: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 2,
    },
  });
