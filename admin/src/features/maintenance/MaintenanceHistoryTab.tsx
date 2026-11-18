import { useRouter } from '@/shims/expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ChipGroup, Column, DataTable, EmptyState, Section, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR } from '../../lib/format';
import type { MaintenanceRecord } from '../../types';
import { FilterGroup, ListToolbar, Pager, useCommonStyles, usePaged } from '../agreements/listTools';
import { LogMaintenanceSheet, REMINDER_TYPES } from './LogMaintenanceSheet';

const TYPE_FILTERS = ['All', ...REMINDER_TYPES] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];
const STATUS_FILTERS = ['All', 'Scheduled', 'In Progress', 'Completed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const SORTS = ['Newest', 'Oldest', 'Highest cost'] as const;
type Sort = (typeof SORTS)[number];

export default function MaintenanceHistoryTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { maintenanceLogs } = useApp();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('All');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [sort, setSort] = useState<Sort>('Newest');

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    return maintenanceLogs
      .filter(
        (m) =>
          (type === 'All' || m.category === type) &&
          (status === 'All' || m.status === status) &&
          (!q || [m.id, m.vehicleName, m.vehicleNumber, m.serviceType, m.vendorName].some((s) => s.toLowerCase().includes(q)))
      )
      .sort((a, b) => (sort === 'Highest cost' ? b.cost - a.cost : sort === 'Oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [maintenanceLogs, type, status, query, sort]);
  const paged = usePaged(history, `${type}|${status}|${sort}|${query}`);

  const filtersActive = type !== 'All' || status !== 'All' || !!query || sort !== 'Newest';
  const reset = () => {
    setType('All');
    setStatus('All');
    setQuery('');
    setSort('Newest');
  };

  const columns: Column<MaintenanceRecord>[] = [
    { key: 'date', label: 'Date', flex: 0.9, minWidth: 110, value: (m) => formatDate(m.date) },
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.4,
      minWidth: 160,
      render: (m) => (
        <View>
          <Text style={styles.title} numberOfLines={1}>
            {m.vehicleName}
          </Text>
          <Text style={styles.sub}>{m.vehicleNumber}</Text>
        </View>
      ),
    },
    { key: 'service', label: 'Service', flex: 2, minWidth: 220, value: (m) => m.serviceType },
    { key: 'category', label: 'Category', flex: 1, minWidth: 130, value: (m) => m.category },
    { key: 'vendor', label: 'Vendor', flex: 1.4, minWidth: 170, value: (m) => m.vendorName },
    { key: 'cost', label: 'Cost', flex: 0.8, minWidth: 100, align: 'right', value: (m) => formatINR(m.cost) },
    { key: 'status', label: 'Status', flex: 0.9, minWidth: 120, render: (m) => <StatusBadge status={m.status} /> },
  ];

  return (
    <View>
      <Section
        title="Maintenance history"
        subtitle={`${history.length} of ${maintenanceLogs.length} records. Tap a row to open the vehicle.`}
        style={{ marginTop: 0 }}
        action={<Button label="Log maintenance" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setOpen(true)} />}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle, service, vendor or record" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Category">
            <ChipGroup options={TYPE_FILTERS} value={type} onChange={setType} scroll={isPhone} />
          </FilterGroup>
          <FilterGroup label="Status">
            <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll={isPhone} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(m) => m.id}
          onRowPress={(m) => router.push(`/fleet/${encodeURIComponent(m.vehicleId)}`)}
          empty={
            <EmptyState
              compact
              title="No maintenance records"
              message={filtersActive ? 'No records match these filters.' : 'Log the first service to start the history.'}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          }
        />
        <Pager paged={paged} />
      </Section>
      <LogMaintenanceSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
