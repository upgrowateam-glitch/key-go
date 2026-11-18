import React from 'react';
import { Text, View } from 'react-native';
import { DataTable, EmptyState, StatusBadge, type Column } from '../../components/kit';
import { formatINR, formatKm } from '../../lib/format';
import type { LedgerEntry } from '../../services/finance';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Booking, Vehicle } from '../../types';
import { TotalRow } from '../finance/tableTools';
import { sumCategories } from '../finance/useLedger';
import { incomeCategories, makeReportStyles, ReportFrame, useReports } from './reportsShared';

export interface VehicleRow {
  id: string;
  name: string;
  number: string;
  status?: Vehicle['status'];
  trips: number;
  days: number;
  km: number;
  income: number;
  maintenance: number;
  fuel: number;
  tolls: number;
  emi: number;
  net: number;
  unallocated?: boolean;
}

export function buildVehicleRow(v: Vehicle, finance: LedgerEntry[], trips: Booking[]): VehicleRow {
  const mine = finance.filter((e) => e.vehicleId === v.id);
  const myTrips = trips.filter((b) => b.vehicleId === v.id);
  const income = sumCategories(mine, incomeCategories);
  const maintenance = sumCategories(mine, ['Maintenance']);
  const fuel = sumCategories(mine, ['Fuel']);
  const tolls = sumCategories(mine, ['Toll']);
  const emi = sumCategories(mine, ['Loan EMI']);
  return {
    id: v.id,
    name: v.name,
    number: v.vehicleNumber,
    status: v.status,
    trips: myTrips.length,
    days: myTrips.reduce((s, b) => s + b.days, 0),
    km: myTrips.reduce((s, b) => s + (b.kmDriven ?? 0), 0),
    income,
    maintenance,
    fuel,
    tolls,
    emi,
    net: income - maintenance - fuel - tolls - emi,
  };
}

export default function SummaryTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeReportStyles);
  const { scopedVehicles, windowFinance, windowBookings, windowLabel } = useReports();
  const rows = scopedVehicles.map((v) => buildVehicleRow(v, windowFinance, windowBookings));

  const fleetWide = windowFinance.filter((e) => !e.vehicleId);
  const fwIncome = sumCategories(fleetWide, incomeCategories);
  const fwMaint = sumCategories(fleetWide, ['Maintenance']);
  const fwFuel = sumCategories(fleetWide, ['Fuel']);
  const fwToll = sumCategories(fleetWide, ['Toll']);
  const fwEmi = sumCategories(fleetWide, ['Loan EMI']);
  if (fwIncome + fwMaint + fwFuel + fwToll + fwEmi > 0) {
    rows.push({
      id: 'fleet-wide',
      name: 'Fleet-wide (unallocated)',
      number: 'Lump-sum entries',
      trips: 0,
      days: 0,
      km: 0,
      income: fwIncome,
      maintenance: fwMaint,
      fuel: fwFuel,
      tolls: fwToll,
      emi: fwEmi,
      net: fwIncome - fwMaint - fwFuel - fwToll - fwEmi,
      unallocated: true,
    });
  }
  const total = rows.reduce(
    (t, r) => ({
      trips: t.trips + r.trips,
      days: t.days + r.days,
      km: t.km + r.km,
      income: t.income + r.income,
      maintenance: t.maintenance + r.maintenance,
      fuel: t.fuel + r.fuel,
      tolls: t.tolls + r.tolls,
      emi: t.emi + r.emi,
      net: t.net + r.net,
    }),
    { trips: 0, days: 0, km: 0, income: 0, maintenance: 0, fuel: 0, tolls: 0, emi: 0, net: 0 }
  );

  const money = (k: keyof VehicleRow, label: string): Column<VehicleRow> => ({ key: k, label, minWidth: 100, align: 'right', value: (r) => formatINR(r[k] as number) });
  const columns: Column<VehicleRow>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.8,
      minWidth: 170,
      render: (r) => (
        <View>
          <Text style={[styles.cellStrong, r.unallocated && { fontStyle: 'italic' }]} numberOfLines={1}>
            {r.name}
          </Text>
          <Text style={styles.muted}>{r.number}</Text>
        </View>
      ),
    },
    { key: 'status', label: 'Status', minWidth: 110, render: (r) => (r.status ? <StatusBadge status={r.status} /> : <Text style={styles.muted}>—</Text>) },
    { key: 'trips', label: 'Trips', minWidth: 70, flex: 0.6, align: 'right', value: (r) => r.trips },
    { key: 'days', label: 'Days', minWidth: 70, flex: 0.6, align: 'right', value: (r) => r.days },
    { key: 'km', label: 'Km', minWidth: 90, flex: 0.8, align: 'right', value: (r) => formatKm(r.km) },
    money('income', 'Income'),
    money('maintenance', 'Maint.'),
    money('fuel', 'Fuel'),
    money('tolls', 'Tolls'),
    money('emi', 'EMI'),
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
      name="Summary"
      csv={() => ({
        filename: 'keygo-all-vehicle-summary.csv',
        headers: ['Vehicle', 'Number', 'Status', 'Trips', 'Days', 'Km', 'Income', 'Maintenance', 'Fuel', 'Tolls', 'EMI', 'Net'],
        rows: rows.map((r) => [r.name, r.number, r.status ?? '', r.trips, r.days, r.km, r.income, r.maintenance, r.fuel, r.tolls, r.emi, r.net]),
      })}>
      <Text style={[styles.cardTitle, { marginBottom: 4 }]}>All-vehicle summary</Text>
      <Text style={[styles.muted, { marginBottom: 12 }]}>{windowLabel} · net = income − maintenance − fuel − tolls − EMI (salary, commission and other costs are reported under Income & Expense)</Text>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState compact title="No vehicles" message="No vehicles match the selected category." />}
        footer={
          rows.length ? (
            <TotalRow
              columns={columns}
              cells={{
                vehicle: 'Total',
                trips: String(total.trips),
                days: String(total.days),
                km: formatKm(total.km),
                income: formatINR(total.income),
                maintenance: formatINR(total.maintenance),
                fuel: formatINR(total.fuel),
                tolls: formatINR(total.tolls),
                emi: formatINR(total.emi),
                net: formatINR(total.net, { sign: true }),
              }}
            />
          ) : null
        }
      />
    </ReportFrame>
  );
}
