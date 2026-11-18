import { useRouter } from '@/shims/expo-router';
import { Receipt } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, ChipGroup, ConfirmDialog, EmptyState, Grid, Section, SegmentedControl, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR } from '../../lib/format';
import { useThemeColors } from '../../theme';
import type { FASTagLog } from '../../types';
import { FilterGroup, ListToolbar, Pager, useCommonStyles, usePaged } from '../agreements/listTools';
import { logDateLabel, sumTolls, useTolls } from './useTolls';

const VIEWS = ['Unbilled', 'Fully billed'] as const;
type ViewFilter = (typeof VIEWS)[number];
const SORTS = ['Highest unbilled', 'Customer A-Z'] as const;
type Sort = (typeof SORTS)[number];

interface Group {
  bookingId: string;
  customerName: string;
  logs: FASTagLog[];
  unbilled: FASTagLog[];
  billed: FASTagLog[];
}

export default function CustomerTollBillingTab() {
  const colors = useThemeColors();
  const styles = useCommonStyles();
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { logs, bill, manual } = useTolls();

  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewFilter>('Unbilled');
  const [sort, setSort] = useState<Sort>('Highest unbilled');
  const [billOne, setBillOne] = useState<FASTagLog | null>(null);
  const [billAll, setBillAll] = useState<Group | null>(null);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, { bookingId: string; customerName: string; logs: FASTagLog[] }>();
    logs.forEach((l) => {
      if (!l.bookingId) return;
      const g = map.get(l.bookingId) ?? { bookingId: l.bookingId, customerName: l.customerName ?? 'Customer', logs: [] };
      g.logs.push(l);
      map.set(l.bookingId, g);
    });
    return [...map.values()].map((g) => ({ ...g, unbilled: g.logs.filter((l) => !l.billedToCustomer), billed: g.logs.filter((l) => l.billedToCustomer) }));
  }, [logs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => (view === 'Unbilled' ? g.unbilled.length > 0 : g.unbilled.length === 0))
      .filter((g) => !q || [g.bookingId, g.customerName, ...g.logs.map((l) => l.vehicleNumber)].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'Customer A-Z' ? a.customerName.localeCompare(b.customerName) : sumTolls(b.unbilled) - sumTolls(a.unbilled)));
  }, [groups, query, view, sort]);
  const paged = usePaged(shown, `${query}|${view}|${sort}`, 6);

  if (manual.error || (manual.loading && !manual.data)) return <ResourceState loading={manual.loading} error={manual.error} onRetry={manual.reload} />;

  const totalUnbilled = groups.reduce((s, g) => s + sumTolls(g.unbilled), 0);
  const totalBilled = groups.reduce((s, g) => s + sumTolls(g.billed), 0);
  const filtersActive = !!query || view !== 'Unbilled' || sort !== 'Highest unbilled';
  const reset = () => {
    setQuery('');
    setView('Unbilled');
    setSort('Highest unbilled');
  };

  return (
    <View>
      <Grid cols={cols(1, 3, 3)}>
        <StatTile label="Unbilled tolls" value={formatINR(totalUnbilled)} emphasis hint={`${groups.filter((g) => g.unbilled.length).length} bookings waiting`} icon={(c) => <Receipt size={16} color={c} />} />
        <StatTile label="Billed to customers" value={formatINR(totalBilled)} tone="success" />
        <StatTile label="Bookings with tolls" value={groups.length} tone="info" />
      </Grid>

      <Section title="Customer toll billing" subtitle="Tolls grouped by booking — add them to the customer's bill">
        <ListToolbar query={query} onQuery={setQuery} placeholder="Booking, customer or vehicle" onReset={filtersActive ? reset : undefined}>
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              title={view === 'Unbilled' && !query ? 'All tolls billed' : 'Nothing to show'}
              message={view === 'Unbilled' && !query ? 'There are no unbilled tolls linked to bookings.' : 'Try another search or view.'}
              icon={(c) => <Receipt size={22} color={c} />}
              action={filtersActive ? <Button label="Reset" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          </Card>
        ) : (
          <Grid cols={cols(1, 1, 2)}>
            {paged.pageRows.map((g) => (
              <Card key={g.bookingId}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.title}>{g.customerName}</Text>
                    <Text style={styles.link} accessibilityRole="link" onPress={() => router.push(`/bookings/${encodeURIComponent(g.bookingId)}`)}>
                      Booking {g.bookingId}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.kvLabel}>Unbilled total</Text>
                    <Text style={{ color: colors.warmText, fontSize: 18, fontWeight: '800' }}>{formatINR(sumTolls(g.unbilled))}</Text>
                  </View>
                </View>
                <View style={{ marginTop: 8 }}>
                  {(g.unbilled.length ? g.unbilled : g.billed).map((l) => (
                    <View key={l.id} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line }}>
                      <View style={{ flex: 1, minWidth: 180 }}>
                        <Text style={styles.strong} numberOfLines={isPhone ? 2 : 1}>
                          {l.plazaName}
                        </Text>
                        <Text style={styles.sub}>
                          {logDateLabel(l)} · {l.vehicleNumber}
                        </Text>
                      </View>
                      <Text style={styles.title}>{formatINR(l.amount)}</Text>
                      {!l.billedToCustomer ? <Button label="Bill to customer" size="sm" variant="outline" onPress={() => setBillOne(l)} /> : null}
                    </View>
                  ))}
                </View>
                <Text style={[styles.sub, { marginTop: 10 }]}>
                  {g.billed.length ? `${g.billed.length} toll${g.billed.length === 1 ? '' : 's'} already billed (${formatINR(sumTolls(g.billed))}) · ` : ''}
                  Customer total {formatINR(sumTolls(g.logs))}
                </Text>
                {g.unbilled.length > 1 ? <Button label={`Bill all ${g.unbilled.length} tolls`} size="sm" style={{ marginTop: 10 }} onPress={() => setBillAll(g)} /> : null}
              </Card>
            ))}
          </Grid>
        )}
        <Pager paged={paged} />
      </Section>

      <ConfirmDialog
        visible={!!billOne}
        title="Bill this toll to the customer?"
        message={billOne ? `${billOne.plazaName}, ${formatINR(billOne.amount)} goes on ${billOne.customerName ?? 'the customer'}'s bill for ${billOne.bookingId}.` : undefined}
        confirmLabel="Bill to customer"
        onConfirm={() => {
          if (billOne) bill(billOne.id);
          setBillOne(null);
        }}
        onCancel={() => setBillOne(null)}
      />
      <ConfirmDialog
        visible={!!billAll}
        title="Bill all tolls on this booking?"
        message={billAll ? `${billAll.unbilled.length} tolls totalling ${formatINR(sumTolls(billAll.unbilled))} go on ${billAll.customerName}'s bill for ${billAll.bookingId}.` : undefined}
        confirmLabel="Bill all"
        onConfirm={() => {
          billAll?.unbilled.forEach((l) => bill(l.id));
          setBillAll(null);
        }}
        onCancel={() => setBillAll(null)}
      />
    </View>
  );
}
