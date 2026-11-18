import { useRouter } from '@/shims/expo-router';
import { Car } from 'lucide-react-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { BarChart, Card, ChipGroup, DataTable, DonutChart, EmptyState, Grid, StatTile, StatusBadge, VehiclePhoto, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact, formatKm } from '../../lib/format';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Booking } from '../../types';
import { Pager, usePaged } from '../finance/tableTools';
import { sumCategories, TREND_MONTHS } from '../finance/useLedger';
import { incomeCategories, makeReportStyles, ReportFrame, useReports } from './reportsShared';
import { buildVehicleRow } from './SummaryTab';

export default function VehicleTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeReportStyles);
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { bookings } = useApp();
  const { scopedVehicles, windowFinance, windowBookings, windowLabel, vehicleId, setVehicleId, allFinance } = useReports();
  const vehicle = scopedVehicles.find((v) => v.id === vehicleId) ?? scopedVehicles[0];

  const vBookings = useMemo(() => (vehicle ? bookings.filter((b) => b.vehicleId === vehicle.id).sort((a, b) => (a.pickupDate < b.pickupDate ? 1 : -1)) : []), [bookings, vehicle]);
  const paged = usePaged(vBookings);

  const row = vehicle ? buildVehicleRow(vehicle, windowFinance, windowBookings) : undefined;

  const columns: Column<Booking>[] = [
    { key: 'id', label: 'Booking', minWidth: 100, flex: 0.8, render: (b) => <Text style={[styles.cellStrong, { color: colors.primaryText }]}>{b.id}</Text> },
    { key: 'customer', label: 'Customer', minWidth: 150, flex: 1.4, value: (b) => b.customerName },
    { key: 'dates', label: 'Dates', minWidth: 170, flex: 1.4, value: (b) => `${formatDate(b.pickupDate, false)} → ${formatDate(b.returnDate)}` },
    { key: 'days', label: 'Days', minWidth: 70, flex: 0.5, align: 'right', value: (b) => b.days },
    { key: 'km', label: 'Km', minWidth: 90, flex: 0.7, align: 'right', value: (b) => (b.kmDriven != null ? formatKm(b.kmDriven) : '—') },
    { key: 'status', label: 'Status', minWidth: 110, render: (b) => <StatusBadge status={b.status} /> },
    { key: 'total', label: 'Amount', minWidth: 110, align: 'right', value: (b) => formatINR(b.totalAmount) },
  ];

  const csv = () => ({
    filename: `keygo-vehicle-${vehicle?.vehicleNumber.replace(/ /g, '') ?? 'report'}.csv`,
    headers: ['Booking', 'Customer', 'Pickup', 'Return', 'Days', 'Km', 'Status', 'Amount (INR)'],
    rows: vBookings.map((b) => [b.id, b.customerName, b.pickupDate, b.returnDate, b.days, b.kmDriven ?? '', b.status, b.totalAmount]),
  });

  if (!vehicle || !row) {
    return (
      <ReportFrame name="Vehicle-wise" csv={csv}>
        <Card>
          <EmptyState title="No vehicles" message="No vehicles match the selected category." icon={(c) => <Car size={22} color={c} />} />
        </Card>
      </ReportFrame>
    );
  }

  const expenses = row.maintenance + row.fuel + row.tolls + row.emi;
  const monthly = TREND_MONTHS.map((m) => sumCategories(allFinance.filter((e) => e.vehicleId === vehicle.id && e.date.startsWith(m.key)), incomeCategories));

  return (
    <ReportFrame name="Vehicle-wise" csv={csv}>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={scopedVehicles.map((v) => v.id)} labels={Object.fromEntries(scopedVehicles.map((v) => [v.id, v.name]))} value={vehicle.id} onChange={setVehicleId} scroll={isPhone} />
      </View>

      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.thumb}>
            <VehiclePhoto source={vehicle.imageAsset} style={{ width: '100%', height: '100%' }} radius={0} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{vehicle.name}</Text>
            <Text style={styles.muted}>
              {vehicle.vehicleNumber} · {vehicle.type} · {formatINR(vehicle.pricePerDay)}/day
            </Text>
          </View>
          <StatusBadge status={vehicle.status} />
        </View>
      </Card>

      <Text style={[styles.muted, { marginBottom: 8 }]}>Figures for {windowLabel}</Text>
      <Grid cols={cols(2, 3, 6)}>
        <StatTile label="Income" value={formatINRCompact(row.income)} tone="success" />
        <StatTile label="Expenses" value={formatINRCompact(expenses)} hint="Maint. + fuel + tolls + EMI" tone="warm" />
        <StatTile label="Net" value={formatINRCompact(row.net)} hint={row.net < 0 ? 'Loss' : 'Profit'} tone={row.net < 0 ? 'danger' : 'success'} />
        <StatTile label="Trips" value={row.trips} tone="info" />
        <StatTile label="Days rented" value={row.days} tone="info" />
        <StatTile label="Km driven" value={formatKm(row.km)} tone="neutral" />
      </Grid>

      <Grid cols={cols(1, 1, 2)} gap={16}>
        <Card>
          <Text style={styles.cardTitle}>Monthly income</Text>
          <Text style={styles.muted}>Rentals + fines, July – September 2026</Text>
          <View style={{ marginTop: 14 }}>
            <BarChart labels={TREND_MONTHS.map((m) => m.label)} series={[{ name: 'Income', values: monthly }]} height={160} showValues formatValue={formatINRCompact} />
          </View>
        </Card>
        <Card>
          <Text style={styles.cardTitle}>Cost split</Text>
          <Text style={styles.muted}>{windowLabel}</Text>
          <View style={{ marginTop: 14 }}>
            {expenses > 0 ? (
              <DonutChart
                items={[
                  { label: 'Maintenance', value: row.maintenance },
                  { label: 'Fuel', value: row.fuel },
                  { label: 'Tolls', value: row.tolls },
                  { label: 'Loan EMI', value: row.emi },
                ].filter((i) => i.value > 0)}
                centerValue={formatINRCompact(expenses)}
                centerLabel="Costs"
                formatValue={formatINRCompact}
              />
            ) : (
              <EmptyState compact title="No costs" message="No vehicle-level costs recorded in this window." />
            )}
          </View>
        </Card>
      </Grid>

      <Text style={[styles.cardTitle, { marginTop: 20, marginBottom: 10 }]}>Bookings for this vehicle (all time)</Text>
      <DataTable
        columns={columns}
        rows={paged.pageRows}
        rowKey={(b) => b.id}
        onRowPress={(b) => router.push(`/bookings/${encodeURIComponent(b.id)}`)}
        empty={<EmptyState compact title="No bookings" message="This vehicle has no bookings yet." />}
      />
      <Pager paged={paged} />
    </ReportFrame>
  );
}
