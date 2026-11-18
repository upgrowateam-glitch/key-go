import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, CreditCard, Plus, Receipt, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, EmptyState, Field, FormSheet, Grid, Section, SegmentedControl, SimulatedNote, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../lib/format';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Vehicle } from '../../types';
import { FilterGroup, ListToolbar, Pager, usePaged } from '../agreements/listTools';
import { billingState, LOW_BALANCE, monthLabel, sumTolls, useTolls } from './useTolls';

const QUICK = ['500', '1000', '2000', '5000'] as const;
type Quick = (typeof QUICK)[number];
const QUICK_LABELS: Record<Quick, string> = { '500': '₹500', '1000': '₹1,000', '2000': '₹2,000', '5000': '₹5,000' };
const BALANCE_FILTERS = ['All', 'Low balance'] as const;
type BalanceFilter = (typeof BALANCE_FILTERS)[number];
const SORTS = ['Lowest balance', 'Highest balance', 'Vehicle A-Z'] as const;
type Sort = (typeof SORTS)[number];

export default function FastagOverviewTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { vehicles, rechargeFastag, today } = useApp();
  const { logs, manual } = useTolls();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BalanceFilter>('All');
  const [sort, setSort] = useState<Sort>('Lowest balance');
  const [rechargeFor, setRechargeFor] = useState<Vehicle | null>(null);
  const [amount, setAmount] = useState('1000');
  const [amountError, setAmountError] = useState<string>();

  const fleet = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const lowCount = fleet.filter((v) => v.fastagBalance < LOW_BALANCE).length;
  const totalBalance = fleet.reduce((s, v) => s + v.fastagBalance, 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fleet
      .filter((v) => (filter === 'All' || v.fastagBalance < LOW_BALANCE) && (!q || [v.name, v.vehicleNumber, v.fastagId].some((s) => s.toLowerCase().includes(q))))
      .sort((a, b) => (sort === 'Vehicle A-Z' ? a.name.localeCompare(b.name) : sort === 'Highest balance' ? b.fastagBalance - a.fastagBalance : a.fastagBalance - b.fastagBalance));
  }, [fleet, query, filter, sort]);
  const paged = usePaged(shown, `${query}|${filter}|${sort}`, 9);

  if (manual.error || (manual.loading && !manual.data)) return <ResourceState loading={manual.loading} error={manual.error} onRetry={manual.reload} />;

  const month = today.slice(0, 7);
  const monthLogs = logs.filter((l) => l.dateTime.startsWith(month));
  const monthUnbilled = sumTolls(monthLogs.filter((l) => billingState(l) === 'Unbilled'));
  const monthBilled = sumTolls(monthLogs.filter((l) => billingState(l) === 'Billed'));
  const monthCompany = sumTolls(monthLogs.filter((l) => billingState(l) === 'Company'));

  const filtersActive = !!query || filter !== 'All' || sort !== 'Lowest balance';
  const reset = () => {
    setQuery('');
    setFilter('All');
    setSort('Lowest balance');
  };
  const openRecharge = (v: Vehicle) => {
    setAmount('1000');
    setAmountError(undefined);
    setRechargeFor(v);
  };
  const submitRecharge = () => {
    if (!rechargeFor) return;
    const a = parseFloat(amount.replace(/[^\d.]/g, ''));
    if (!(a >= 100)) return setAmountError('Minimum recharge is ₹100');
    if (a > 100000) return setAmountError('Maximum recharge is ₹1,00,000');
    rechargeFastag(rechargeFor.id, Math.round(a));
    setRechargeFor(null);
  };

  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label={`Tolls · ${monthLabel(month)}`} value={formatINR(sumTolls(monthLogs))} hint={`${monthLogs.length} crossings`} emphasis icon={(c) => <Receipt size={16} color={c} />} />
        <StatTile label="Billed to customers" value={formatINR(monthBilled)} tone="success" hint="This month" />
        <StatTile label="Unbilled" value={formatINR(monthUnbilled)} tone={monthUnbilled ? 'warning' : 'neutral'} hint={monthCompany ? `+ ${formatINR(monthCompany)} company trips` : 'Linked to bookings'} onPress={() => router.replace('/fastag?tab=customer-toll-billing')} />
        <StatTile
          label="Low-balance tags"
          value={lowCount}
          tone={lowCount ? 'danger' : 'success'}
          hint={`Below ${formatINR(LOW_BALANCE)} · total ${formatINRCompact(totalBalance)}`}
          icon={(c) => <AlertTriangle size={16} color={c} />}
          onPress={lowCount ? () => setFilter('Low balance') : undefined}
        />
      </Grid>

      <Section title="Tag balances" subtitle={`${shown.length} of ${fleet.length} tags`}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle, number or tag ID" onReset={filtersActive ? reset : undefined}>
          <SegmentedControl options={BALANCE_FILTERS} value={filter} onChange={setFilter} />
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              title={fleet.length ? 'No tags match' : 'No vehicles'}
              message={fleet.length ? 'Try another search or filter.' : 'Vehicles with FASTags appear here.'}
              icon={(c) => <CreditCard size={22} color={c} />}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          </Card>
        ) : (
          <Grid cols={cols(1, 2, 3)}>
            {paged.pageRows.map((v) => {
              const low = v.fastagBalance < LOW_BALANCE;
              return (
                <Card key={v.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={[styles.iconBox, low && { backgroundColor: colors.dangerGlow }]}>
                      <Wallet size={18} color={low ? colors.danger : colors.primaryText} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.cellTitle} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <Text style={styles.cellSub} numberOfLines={1}>
                        {v.vehicleNumber} · {v.fastagId}
                      </Text>
                    </View>
                    {low ? <Badge label="Low balance" tone="danger" /> : null}
                  </View>
                  <View style={styles.balanceRow}>
                    <View>
                      <Text style={styles.balanceLabel}>Balance</Text>
                      <Text style={[styles.balance, low && { color: colors.danger }]}>{formatINR(v.fastagBalance)}</Text>
                    </View>
                    <Button label="Recharge" size="sm" variant={low ? 'primary' : 'outline'} icon={(c) => <Plus size={14} color={c} />} onPress={() => openRecharge(v)} />
                  </View>
                </Card>
              );
            })}
          </Grid>
        )}
        <Pager paged={paged} />
      </Section>

      <FormSheet
        visible={!!rechargeFor}
        title="Recharge FASTag"
        onClose={() => setRechargeFor(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setRechargeFor(null)} />
            <Button label="Recharge" onPress={submitRecharge} />
          </>
        }>
        {rechargeFor ? (
          <>
            <Text style={styles.cellTitle}>
              {rechargeFor.name} · {rechargeFor.vehicleNumber}
            </Text>
            <Text style={styles.cellSub}>
              Tag {rechargeFor.fastagId} · current balance {formatINR(rechargeFor.fastagBalance)}
            </Text>
            <View style={{ marginVertical: 14 }}>
              <ChipGroup
                options={QUICK}
                value={amount as Quick}
                onChange={(a) => {
                  setAmount(a);
                  setAmountError(undefined);
                }}
                labels={QUICK_LABELS}
              />
            </View>
            <Field
              label="Amount (₹)"
              required
              value={amount}
              onChangeText={(t) => {
                setAmount(t);
                setAmountError(undefined);
              }}
              keyboardType="number-pad"
              error={amountError}
            />
            <SimulatedNote>No payment is made — the balance is updated locally for the demo.</SimulatedNote>
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cellTitle: { color: colors.txt, fontSize: 14, fontWeight: '700' },
    cellSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
    balanceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, gap: 8 },
    balanceLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    balance: { color: colors.txt, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  });
