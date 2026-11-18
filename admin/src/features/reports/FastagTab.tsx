import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { Badge, Card, DataTable, DonutChart, EmptyState, Grid, HBarChart, SegmentedControl, StatTile, type Column } from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR } from '../../lib/format';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { FASTagLog } from '../../types';
import { FilterGroup, ListToolbar, Pager, SearchField, usePaged } from '../finance/tableTools';
import { makeReportStyles, ReportFrame, sumAmount, useReports } from './reportsShared';

const BILLING = ['All', 'Billed', 'Unbilled'] as const;

export default function FastagTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeReportStyles);
  const { cols } = useResponsive();
  const { windowTolls, windowLabel, vehicleByNumber } = useReports();
  const [query, setQuery] = useState('');
  const [billing, setBilling] = useState<(typeof BILLING)[number]>('All');
  const total = sumAmount(windowTolls);
  const billed = sumAmount(windowTolls.filter((l) => l.billedToCustomer));
  const unbilled = total - billed;

  const byVehicle = useMemo(() => {
    const map = new Map<string, { label: string; sublabel: string; value: number }>();
    windowTolls.forEach((l) => {
      const v = vehicleByNumber.get(l.vehicleNumber);
      const p = map.get(l.vehicleNumber);
      map.set(l.vehicleNumber, { label: v?.name ?? l.vehicleNumber, sublabel: l.vehicleNumber, value: (p?.value ?? 0) + l.amount });
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [windowTolls, vehicleByNumber]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return windowTolls
      .filter((l) => billing === 'All' || (billing === 'Billed') === l.billedToCustomer)
      .filter((l) => !q || `${l.vehicleNumber} ${l.plazaName} ${l.bookingId ?? ''} ${l.customerName ?? ''}`.toLowerCase().includes(q));
  }, [windowTolls, billing, query]);
  const paged = usePaged(rows);

  const columns: Column<FASTagLog>[] = [
    { key: 'date', label: 'Date & time', minWidth: 150, flex: 1.1, value: (l) => `${formatDate(l.dateTime.slice(0, 10), false)}, ${l.dateTime.slice(11)}` },
    { key: 'vehicle', label: 'Vehicle', minWidth: 130, value: (l) => l.vehicleNumber },
    { key: 'plaza', label: 'Plaza', minWidth: 200, flex: 1.8, value: (l) => l.plazaName },
    { key: 'booking', label: 'Booking', minWidth: 140, flex: 1.1, value: (l) => (l.bookingId ? `${l.bookingId} · ${l.customerName ?? ''}` : 'No booking') },
    { key: 'billed', label: 'Billing', minWidth: 100, render: (l) => <Badge label={l.billedToCustomer ? 'Billed' : 'Unbilled'} tone={l.billedToCustomer ? 'success' : 'warning'} /> },
    { key: 'amount', label: 'Amount', minWidth: 90, align: 'right', value: (l) => formatINR(l.amount) },
  ];

  return (
    <ReportFrame
      name="FASTag"
      csv={() => ({
        filename: 'keygo-fastag-report.csv',
        headers: ['Date & time', 'Vehicle', 'Plaza', 'Booking', 'Customer', 'Billing', 'Amount (INR)'],
        rows: rows.map((l) => [l.dateTime, l.vehicleNumber, l.plazaName, l.bookingId ?? '', l.customerName ?? '', l.billedToCustomer ? 'Billed' : 'Unbilled', l.amount]),
      })}>
      {windowTolls.length === 0 ? (
        <Card>
          <EmptyState title="No toll entries" message={`No FASTag transactions in ${windowLabel} for the selected filters.`} icon={(c) => <Receipt size={22} color={c} />} />
        </Card>
      ) : (
        <View>
          <Grid cols={cols(1, 3, 3)}>
            <StatTile label="Total tolls" value={formatINR(total)} hint={`${windowTolls.length} crossings`} tone="info" icon={(c) => <Receipt size={16} color={c} />} />
            <StatTile label="Billed to customers" value={formatINR(billed)} tone="success" />
            <StatTile label="Unbilled" value={formatINR(unbilled)} hint="Recoverable or company cost" tone="warning" />
          </Grid>
          <Grid cols={cols(1, 2, 2)} gap={16} style={{ marginBottom: 16 }}>
            <Card>
              <Text style={styles.cardTitle}>Tolls by vehicle</Text>
              <Text style={[styles.muted, { marginBottom: 14 }]}>{windowLabel}</Text>
              <HBarChart items={byVehicle} formatValue={formatINR} />
            </Card>
            <Card>
              <Text style={styles.cardTitle}>Billed vs unbilled</Text>
              <Text style={[styles.muted, { marginBottom: 14 }]}>{windowLabel}</Text>
              <DonutChart
                items={[
                  { label: 'Billed', value: billed, color: colors.success },
                  { label: 'Unbilled', value: unbilled, color: colors.warm },
                ]}
                centerValue={formatINR(total)}
                centerLabel="Tolls"
                formatValue={formatINR}
              />
            </Card>
          </Grid>
          <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Vehicle, plaza, booking or customer" />}>
            <FilterGroup label="Billing">
              <SegmentedControl options={BILLING} value={billing} onChange={setBilling} />
            </FilterGroup>
          </ListToolbar>
          <DataTable columns={columns} rows={paged.pageRows} rowKey={(l) => l.id} empty={<EmptyState compact title="No toll entries" message="Nothing matches these filters." />} />
          <Pager paged={paged} />
        </View>
      )}
    </ReportFrame>
  );
}
