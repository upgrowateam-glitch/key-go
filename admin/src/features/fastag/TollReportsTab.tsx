import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Download, Receipt } from 'lucide-react-native';
import { BarChart, Button, Card, ChipGroup, DonutChart, EmptyState, Grid, HBarChart, Section, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../lib/format';
import { downloadCsv, FilterGroup, useCommonStyles } from '../agreements/listTools';
import { billingState, monthLabel, sumTolls, useTolls } from './useTolls';

const ALL = 'All';

export default function TollReportsTab() {
  const styles = useCommonStyles();
  const { cols } = useResponsive();
  const { vehicles, showToast } = useApp();
  const { logs, manual } = useTolls();
  const [period, setPeriod] = useState(ALL);

  const months = useMemo(() => [...new Set(logs.map((l) => l.dateTime.slice(0, 7)))].sort().reverse(), [logs]);
  const inPeriod = useMemo(() => logs.filter((l) => period === ALL || l.dateTime.startsWith(period)), [logs, period]);
  const vehicleByNumber = useMemo(() => new Map(vehicles.map((v) => [v.vehicleNumber, v])), [vehicles]);

  const byVehicle = useMemo(() => {
    const map = new Map<string, number>();
    inPeriod.forEach((l) => map.set(l.vehicleNumber, (map.get(l.vehicleNumber) ?? 0) + l.amount));
    return [...map.entries()].map(([num, value]) => ({ label: vehicleByNumber.get(num)?.name ?? num, sublabel: num, value })).sort((a, b) => b.value - a.value);
  }, [inPeriod, vehicleByNumber]);
  const byPlaza = useMemo(() => {
    const map = new Map<string, number>();
    inPeriod.forEach((l) => map.set(l.plazaName, (map.get(l.plazaName) ?? 0) + l.amount));
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [inPeriod]);

  if (manual.error || (manual.loading && !manual.data)) return <ResourceState loading={manual.loading} error={manual.error} onRetry={manual.reload} />;

  const billed = sumTolls(inPeriod.filter((l) => billingState(l) === 'Billed'));
  const unbilled = sumTolls(inPeriod.filter((l) => billingState(l) === 'Unbilled'));
  const company = sumTolls(inPeriod.filter((l) => billingState(l) === 'Company'));
  const total = billed + unbilled + company;
  const split = [
    { label: 'Billed', value: billed },
    { label: 'Unbilled', value: unbilled },
    { label: 'Company trips', value: company },
  ].filter((i) => i.value > 0);
  const trendMonths = [...months].slice(0, 6).reverse();
  const label = period === ALL ? 'All time' : monthLabel(period);

  const exportCsv = () => {
    downloadCsv(`toll-report-${period.toLowerCase()}.csv`, [
      ['Vehicle', 'Number', 'Crossings', 'Toll cost (INR)'],
      ...byVehicle.map((v) => [v.label, v.sublabel, inPeriod.filter((l) => l.vehicleNumber === v.sublabel).length, v.value]),
      [],
      ['Billed (INR)', billed],
      ['Unbilled (INR)', unbilled],
      ['Company trips (INR)', company],
      ['Total (INR)', total],
    ]);
    showToast('Toll report exported');
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <FilterGroup label="Period">
            <ChipGroup options={[ALL, ...months]} value={period} onChange={setPeriod} labels={{ [ALL]: 'All time', ...Object.fromEntries(months.map((m) => [m, monthLabel(m)])) }} scroll />
          </FilterGroup>
        </View>
        <Button label="Export CSV" size="sm" variant="outline" disabled={!inPeriod.length} icon={(c) => <Download size={14} color={c} />} onPress={exportCsv} />
      </View>

      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Total toll cost" value={formatINR(total)} hint={label} emphasis icon={(c) => <Receipt size={16} color={c} />} />
        <StatTile label="Crossings" value={inPeriod.length} tone="info" hint={inPeriod.length ? `Avg ${formatINR(Math.round(total / inPeriod.length))}` : undefined} />
        <StatTile label="Recovered from customers" value={formatINR(billed)} tone="success" hint={total ? `${Math.round((billed / total) * 100)}% of cost` : undefined} />
        <StatTile label="Company cost" value={formatINR(company)} tone="neutral" hint={`${formatINR(unbilled)} still unbilled`} />
      </Grid>

      {inPeriod.length === 0 ? (
        <Card>
          <EmptyState title="No toll entries" message="No toll crossings in this period." icon={(c) => <Receipt size={22} color={c} />} />
        </Card>
      ) : (
        <>
          <Section title="Toll cost by vehicle" subtitle={label}>
            <Card>
              <HBarChart items={byVehicle} formatValue={formatINR} />
            </Card>
          </Section>
          <Section title="Where the cost goes">
            <Grid cols={cols(1, 2, 2)}>
              <Card>
                <Text style={styles.chartTitle}>Top toll plazas</Text>
                <HBarChart items={byPlaza} formatValue={formatINR} />
              </Card>
              <Card>
                <Text style={styles.chartTitle}>Billing split</Text>
                <DonutChart items={split} centerValue={formatINRCompact(total)} centerLabel="total" formatValue={formatINRCompact} />
              </Card>
            </Grid>
          </Section>
          <Section title="Monthly trend" subtitle="Latest six months">
            <Card>
              <BarChart labels={trendMonths.map(monthLabel)} series={[{ name: 'Tolls', values: trendMonths.map((m) => sumTolls(logs.filter((l) => l.dateTime.startsWith(m)))) }]} formatValue={formatINRCompact} showValues />
            </Card>
          </Section>
        </>
      )}
    </View>
  );
}
