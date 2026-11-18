import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Download, IndianRupee, Route, Wrench } from 'lucide-react-native';
import { BarChart, Button, Card, ChipGroup, Column, DataTable, DonutChart, EmptyState, Grid, Section, StatTile } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact, formatKm } from '../../lib/format';
import { downloadCsv, FilterGroup, ListToolbar, Pager, useCommonStyles, usePaged } from '../agreements/listTools';
import { REMINDER_TYPES } from './LogMaintenanceSheet';

const SORTS = ['Highest cost', 'Cost per km', 'Vehicle A-Z'] as const;
type Sort = (typeof SORTS)[number];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface VehicleCost {
  id: string;
  name: string;
  number: string;
  records: number;
  total: number;
  odometer: number;
  perKm: number;
  last?: string;
}

export default function ExpensesTab() {
  const styles = useCommonStyles();
  const { cols, isPhone } = useResponsive();
  const { vehicles, maintenanceLogs, showToast } = useApp();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('Highest cost');
  const [period, setPeriod] = useState('All');

  const periods = useMemo(() => ['All', ...[...new Set(maintenanceLogs.map((m) => m.date.slice(0, 7)))].sort().reverse()], [maintenanceLogs]);
  const periodLabel = (p: string) => (p === 'All' ? 'All time' : `${MONTH_LABELS[parseInt(p.slice(5, 7), 10) - 1]} ${p.slice(0, 4)}`);
  const logs = useMemo(() => maintenanceLogs.filter((m) => period === 'All' || m.date.startsWith(period)), [maintenanceLogs, period]);

  const rows = useMemo<VehicleCost[]>(() => {
    const q = query.trim().toLowerCase();
    return vehicles
      .filter((v) => v.status !== 'Sold' || logs.some((m) => m.vehicleId === v.id))
      .map((v) => {
        const own = logs.filter((m) => m.vehicleId === v.id);
        const total = own.reduce((s, m) => s + m.cost, 0);
        return {
          id: v.id,
          name: v.name,
          number: v.vehicleNumber,
          records: own.length,
          total,
          odometer: v.odometerKm,
          perKm: v.odometerKm ? total / v.odometerKm : 0,
          last: own.map((m) => m.date).sort().pop(),
        };
      })
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.number.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'Vehicle A-Z' ? a.name.localeCompare(b.name) : sort === 'Cost per km' ? b.perKm - a.perKm : b.total - a.total));
  }, [vehicles, logs, query, sort]);
  const paged = usePaged(rows, `${query}|${sort}|${period}`);

  const total = logs.reduce((s, m) => s + m.cost, 0);
  const costedVehicles = new Set(logs.map((m) => m.vehicleId)).size;
  const byCategory = REMINDER_TYPES.map((t) => ({ label: t, value: logs.filter((m) => m.category === t).reduce((s, m) => s + m.cost, 0) })).filter((i) => i.value > 0);
  const months = periods.filter((p) => p !== 'All').slice(0, 6).reverse();
  const monthValues = months.map((p) => maintenanceLogs.filter((m) => m.date.startsWith(p)).reduce((s, m) => s + m.cost, 0));

  const filtersActive = !!query || sort !== 'Highest cost' || period !== 'All';
  const reset = () => {
    setQuery('');
    setSort('Highest cost');
    setPeriod('All');
  };
  const exportCsv = () => {
    downloadCsv(`maintenance-expenses-${period.toLowerCase()}.csv`, [
      ['Record', 'Date', 'Vehicle', 'Number', 'Service', 'Category', 'Vendor', 'Status', 'Cost (INR)'],
      ...logs.map((m) => [m.id, m.date, m.vehicleName, m.vehicleNumber, m.serviceType, m.category, m.vendorName, m.status, m.cost]),
    ]);
    showToast(`Exported ${logs.length} expense records`);
  };

  const columns: Column<VehicleCost>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.5,
      minWidth: 170,
      render: (r) => (
        <View>
          <Text style={styles.strong} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={styles.sub}>{r.number}</Text>
        </View>
      ),
    },
    { key: 'records', label: 'Records', flex: 0.6, minWidth: 80, align: 'right', value: (r) => r.records },
    { key: 'total', label: 'Total cost', flex: 0.9, minWidth: 110, align: 'right', value: (r) => formatINR(r.total) },
    { key: 'odometer', label: 'Odometer', flex: 0.9, minWidth: 110, align: 'right', value: (r) => formatKm(r.odometer) },
    { key: 'perKm', label: 'Cost per km', flex: 0.8, minWidth: 100, align: 'right', value: (r) => (r.total ? `₹${r.perKm.toFixed(2)}` : '—') },
  ];

  return (
    <View>
      <Grid cols={cols(1, 3, 3)}>
        <StatTile label="Maintenance expense" value={formatINRCompact(total)} hint={periodLabel(period)} emphasis icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Average per vehicle" value={formatINRCompact(costedVehicles ? Math.round(total / costedVehicles) : 0)} hint={`${costedVehicles} vehicles with costs`} tone="info" icon={(c) => <Wrench size={16} color={c} />} />
        <StatTile label="Records" value={logs.length} tone="neutral" icon={(c) => <Route size={16} color={c} />} />
      </Grid>

      <Section title="Cost per vehicle" subtitle="Cost per km uses the vehicle's current odometer" action={<Button label="Export CSV" size="sm" variant="outline" icon={(c) => <Download size={14} color={c} />} disabled={!logs.length} onPress={exportCsv} />}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle or number" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Period">
            <ChipGroup options={periods} value={period} onChange={setPeriod} labels={Object.fromEntries(periods.map((p) => [p, periodLabel(p)]))} scroll />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(r) => r.id}
          empty={<EmptyState compact title="No vehicles match" message="Try another search." action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined} />}
        />
        <Pager paged={paged} />
      </Section>

      <Section title="Spend breakdown">
        <Grid cols={cols(1, 2, 2)}>
          <Card>
            <Text style={styles.chartTitle}>By month</Text>
            {months.length ? <BarChart labels={months.map((p) => MONTH_LABELS[parseInt(p.slice(5, 7), 10) - 1])} series={[{ name: 'Maintenance', values: monthValues }]} formatValue={formatINRCompact} showValues /> : <EmptyState compact title="No costs yet" />}
          </Card>
          <Card>
            <Text style={styles.chartTitle}>By category · {periodLabel(period)}</Text>
            {byCategory.length ? <DonutChart items={byCategory} centerValue={formatINRCompact(total)} centerLabel="total" formatValue={formatINRCompact} /> : <EmptyState compact title="No costs in this period" />}
          </Card>
        </Grid>
      </Section>
    </View>
  );
}
