import { useRouter } from '@/shims/expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Card, DataTable, EmptyState, HBarChart, SegmentedControl, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useThemedStyles } from '../../theme';
import { FilterGroup, ListToolbar, Pager, SearchField, usePaged } from '../finance/tableTools';
import { makeReportStyles, ReportFrame, useReports } from './reportsShared';

interface CustomerRow {
  key: string;
  customerId?: string;
  name: string;
  trips: number;
  spend: number;
  avg: number;
  lastTrip: string;
  tier: string;
}

const SORTS = ['Spend', 'Trips', 'Last trip'] as const;
const tierTone = (t: string) => (t === 'VIP' ? 'violet' : t === 'Gold' ? 'highlight' : t === 'Silver' ? 'info' : 'neutral');

export default function CustomerTab() {
  const styles = useThemedStyles(makeReportStyles);
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { customers } = useApp();
  const { windowBookings, windowLabel } = useReports();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Spend');

  const all = useMemo(() => {
    const map = new Map<string, CustomerRow>();
    windowBookings.forEach((b) => {
      const key = b.customerId ?? b.customerName;
      const cust = customers.find((c) => c.id === b.customerId);
      const prev = map.get(key);
      const trips = (prev?.trips ?? 0) + 1;
      const spend = (prev?.spend ?? 0) + b.totalAmount;
      map.set(key, {
        key,
        customerId: b.customerId,
        name: cust?.name ?? b.customerName,
        trips,
        spend,
        avg: spend / trips,
        lastTrip: prev && prev.lastTrip > b.pickupDate ? prev.lastTrip : b.pickupDate,
        tier: cust?.loyaltyTier ?? '—',
      });
    });
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [windowBookings, customers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === 'Trips' ? b.trips - a.trips : sort === 'Last trip' ? b.lastTrip.localeCompare(a.lastTrip) : b.spend - a.spend));
  }, [all, query, sort]);
  const paged = usePaged(rows);

  const columns: Column<CustomerRow>[] = [
    { key: 'name', label: 'Customer', flex: 1.6, minWidth: 160, render: (r) => <Text style={styles.cellStrong}>{r.name}</Text> },
    { key: 'trips', label: 'Trips', minWidth: 70, flex: 0.6, align: 'right', value: (r) => r.trips },
    { key: 'spend', label: 'Spend', minWidth: 110, align: 'right', value: (r) => formatINR(r.spend) },
    { key: 'avg', label: 'Avg trip', minWidth: 110, align: 'right', value: (r) => formatINR(r.avg) },
    { key: 'last', label: 'Last trip', minWidth: 110, value: (r) => formatDate(r.lastTrip) },
    { key: 'tier', label: 'Tier', minWidth: 90, render: (r) => <Badge label={r.tier} tone={tierTone(r.tier)} /> },
  ];

  return (
    <ReportFrame
      name="Customer-wise"
      csv={() => ({
        filename: 'keygo-customer-report.csv',
        headers: ['Customer', 'Trips', 'Spend (INR)', 'Average trip (INR)', 'Last trip', 'Tier'],
        rows: rows.map((r) => [r.name, r.trips, r.spend, Math.round(r.avg), r.lastTrip, r.tier]),
      })}>
      {all.length === 0 ? (
        <Card>
          <EmptyState title="No customer trips" message={`No trips started in ${windowLabel} for the selected filters.`} />
        </Card>
      ) : (
        <View style={isDesktop ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' } : { gap: 16 }}>
          <Card style={isDesktop ? { width: 340 } : undefined}>
            <Text style={styles.cardTitle}>Top customers by spend</Text>
            <Text style={[styles.muted, { marginBottom: 14 }]}>{windowLabel}</Text>
            <HBarChart items={all.slice(0, 5).map((r) => ({ label: r.name, value: r.spend, sublabel: `${r.trips} trips` }))} formatValue={formatINRCompact} />
          </Card>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Customer name" />}>
              <FilterGroup label="Sort by">
                <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
              </FilterGroup>
            </ListToolbar>
            <DataTable
              columns={columns}
              rows={paged.pageRows}
              rowKey={(r) => r.key}
              onRowPress={(r) => (r.customerId ? router.push(`/customers/${encodeURIComponent(r.customerId)}`) : undefined)}
              empty={<EmptyState compact title="No customers" message="Nothing matches this search." />}
            />
            <Pager paged={paged} />
          </View>
        </View>
      )}
    </ReportFrame>
  );
}
