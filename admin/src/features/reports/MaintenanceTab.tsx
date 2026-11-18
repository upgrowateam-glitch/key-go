import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { Wrench } from 'lucide-react-native';
import { Card, DataTable, EmptyState, Grid, HBarChart, StatTile, StatusBadge, type Column } from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useThemedStyles } from '../../theme';
import type { MaintenanceRecord } from '../../types';
import { ListToolbar, Pager, SearchField, usePaged } from '../finance/tableTools';
import { makeReportStyles, ReportFrame, useReports } from './reportsShared';

export default function MaintenanceTab() {
  const styles = useThemedStyles(makeReportStyles);
  const { cols } = useResponsive();
  const { windowMaintenance, windowLabel } = useReports();
  const [query, setQuery] = useState('');
  const total = windowMaintenance.reduce((s, m) => s + m.cost, 0);

  const byVehicle = useMemo(() => {
    const map = new Map<string, { label: string; sublabel: string; value: number }>();
    windowMaintenance.forEach((m) => {
      const p = map.get(m.vehicleId);
      map.set(m.vehicleId, { label: m.vehicleName, sublabel: m.vehicleNumber, value: (p?.value ?? 0) + m.cost });
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [windowMaintenance]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    windowMaintenance.forEach((m) => map.set(m.category, (map.get(m.category) ?? 0) + m.cost));
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [windowMaintenance]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return windowMaintenance
      .filter((m) => !q || `${m.vehicleName} ${m.vehicleNumber} ${m.serviceType} ${m.vendorName}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [windowMaintenance, query]);
  const paged = usePaged(rows);

  const columns: Column<MaintenanceRecord>[] = [
    { key: 'date', label: 'Date', minWidth: 100, flex: 0.8, value: (m) => formatDate(m.date) },
    { key: 'vehicle', label: 'Vehicle', minWidth: 150, flex: 1.3, value: (m) => `${m.vehicleName} · ${m.vehicleNumber}` },
    { key: 'service', label: 'Service', minWidth: 200, flex: 2, value: (m) => m.serviceType },
    { key: 'vendor', label: 'Vendor', minWidth: 150, flex: 1.3, value: (m) => m.vendorName },
    { key: 'status', label: 'Status', minWidth: 110, render: (m) => <StatusBadge status={m.status} /> },
    { key: 'cost', label: 'Cost', minWidth: 100, align: 'right', value: (m) => formatINR(m.cost) },
  ];

  return (
    <ReportFrame
      name="Maintenance"
      csv={() => ({
        filename: 'keygo-maintenance-report.csv',
        headers: ['Date', 'Vehicle', 'Number', 'Service', 'Vendor', 'Status', 'Cost (INR)'],
        rows: rows.map((m) => [m.date, m.vehicleName, m.vehicleNumber, m.serviceType, m.vendorName, m.status, m.cost]),
      })}>
      {windowMaintenance.length === 0 ? (
        <Card>
          <EmptyState title="No maintenance" message={`No service records in ${windowLabel} for the selected filters.`} icon={(c) => <Wrench size={22} color={c} />} />
        </Card>
      ) : (
        <>
          <Grid cols={cols(1, 3, 3)}>
            <StatTile label="Maintenance cost" value={formatINRCompact(total)} hint={formatINR(total)} tone="warning" icon={(c) => <Wrench size={16} color={c} />} />
            <StatTile label="Jobs" value={windowMaintenance.length} hint={`${windowMaintenance.filter((m) => m.status !== 'Completed').length} open`} tone="info" />
            <StatTile label="Average per job" value={formatINRCompact(total / windowMaintenance.length)} tone="neutral" />
          </Grid>
          <Grid cols={cols(1, 2, 2)} gap={16} style={{ marginBottom: 16 }}>
            <Card>
              <Text style={styles.cardTitle}>Cost by vehicle</Text>
              <Text style={[styles.muted, { marginBottom: 14 }]}>{windowLabel}</Text>
              <HBarChart items={byVehicle} formatValue={formatINRCompact} />
            </Card>
            <Card>
              <Text style={styles.cardTitle}>Cost by category</Text>
              <Text style={[styles.muted, { marginBottom: 14 }]}>{windowLabel}</Text>
              <HBarChart items={byCategory} formatValue={formatINRCompact} />
            </Card>
          </Grid>
          <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Vehicle, service or vendor" />} />
          <DataTable columns={columns} rows={paged.pageRows} rowKey={(m) => m.id} empty={<EmptyState compact title="No records" message="Nothing matches this search." />} />
          <Pager paged={paged} />
        </>
      )}
    </ReportFrame>
  );
}
