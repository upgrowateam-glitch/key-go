import { useRouter } from '@/shims/expo-router';
import { Clock, IndianRupee, Receipt, TrendingUp } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, EmptyState, Grid, HBarChart, ListRow, Section, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { fetchPayments, outstandingFor } from '../../services/finance';
import { useResource } from '../../services/mockClient';
import { useThemedStyles } from '../../theme';
import { LedgerTable, makeFinanceStyles, PeriodBar } from './financeShared';
import { PERIOD_CAPTION, PERIOD_MONTHS, useLedger, type Period } from './useLedger';

export default function RentalIncomeTab() {
  const styles = useThemedStyles(makeFinanceStyles);
  const router = useRouter();
  const { cols } = useResponsive();
  const { bookings, vehicles } = useApp();
  const { entries, extrasLoading, error, reload } = useLedger();
  const pay = useResource(fetchPayments);
  const [period, setPeriod] = useState<Period>('This month');

  const income = useMemo(() => entries.filter((e) => e.category === 'Rental income' && PERIOD_MONTHS[period].includes(e.date.slice(0, 7))), [entries, period]);
  const total = income.reduce((s, e) => s + e.amount, 0);

  const byVehicle = useMemo(() => {
    const map = new Map<string, number>();
    income.forEach((e) => map.set(e.vehicleId ?? '', (map.get(e.vehicleId ?? '') ?? 0) + e.amount));
    return Array.from(map.entries())
      .map(([id, value]) => {
        const v = vehicles.find((x) => x.id === id);
        return { label: v?.name ?? 'Fleet-wide', sublabel: v?.vehicleNumber ?? 'Lump-sum entries', value };
      })
      .sort((a, b) => b.value - a.value);
  }, [income, vehicles]);

  const outstanding = useMemo(
    () =>
      bookings
        .map((b) => ({ b, due: outstandingFor(b, pay.data ?? []) }))
        .filter((x) => x.due > 0)
        .sort((a, z) => z.due - a.due),
    [bookings, pay.data]
  );
  const totalDue = outstanding.reduce((s, x) => s + x.due, 0);

  if (error || pay.error || extrasLoading || (pay.loading && !pay.data)) {
    return (
      <ResourceState
        loading={extrasLoading || pay.loading}
        error={error ?? pay.error}
        onRetry={() => {
          reload();
          pay.reload();
        }}
      />
    );
  }

  return (
    <View>
      <PeriodBar period={period} onChange={setPeriod} />
      <Grid cols={cols(2, 4, 4)}>
        <StatTile emphasis label="Rental income" value={formatINRCompact(total)} hint={formatINR(total)} icon={(c) => <TrendingUp size={16} color={c} />} />
        <StatTile label="Entries" value={income.length} hint={PERIOD_CAPTION[period]} tone="info" icon={(c) => <Receipt size={16} color={c} />} />
        <StatTile label="Average entry" value={formatINRCompact(income.length ? total / income.length : 0)} tone="neutral" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Outstanding" value={formatINRCompact(totalDue)} hint={`${outstanding.length} bookings, all periods`} tone={totalDue ? 'warning' : 'success'} icon={(c) => <Clock size={16} color={c} />} />
      </Grid>

      <Grid cols={cols(1, 1, 2)} gap={16} style={{ marginTop: 12 }}>
        <Card>
          <Text style={styles.cardTitle}>Income by vehicle</Text>
          <Text style={[styles.cardSub, { marginBottom: 14 }]}>{PERIOD_CAPTION[period]}</Text>
          {byVehicle.length ? <HBarChart items={byVehicle} formatValue={formatINRCompact} /> : <EmptyState compact title="No income" message="No rental income recorded in this period." />}
        </Card>
        <Card padded={false} style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={styles.cardTitle}>Payments outstanding</Text>
          <Text style={styles.cardSub}>Confirmed, active and completed bookings with a balance due</Text>
          {outstanding.length === 0 ? (
            <EmptyState compact title="Nothing outstanding" message="Every billable booking is paid in full." />
          ) : (
            outstanding.slice(0, 5).map(({ b, due }) => (
              <ListRow
                key={b.id}
                title={`${b.id} · ${b.customerName}`}
                subtitle={`${b.vehicleName} · pickup ${formatDate(b.pickupDate, false)}`}
                right={<Text style={styles.cellStrong}>{formatINR(due)}</Text>}
                onPress={() => router.push(`/bookings/${encodeURIComponent(b.id)}`)}
              />
            ))
          )}
          <Button label="Record a payment" size="sm" variant="ghost" style={{ marginVertical: 8 }} onPress={() => router.push('/finance?tab=payments-and-refunds')} />
        </Card>
      </Grid>

      <Section title="Income entries" subtitle={PERIOD_CAPTION[period]}>
        <LedgerTable entries={income} categories={['Rental income']} emptyLabel="rental income" filename="keygo-rental-income.csv" />
      </Section>
    </View>
  );
}
