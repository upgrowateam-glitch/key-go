import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Award, ChevronDown, ChevronRight, Coins, Crown, Pencil, Users } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, DataTable, EmptyState, Field, FormSheet, Grid, Section, SegmentedControl, StatTile, toneColors, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles } from '../../theme';
import { formatDate } from '../../lib/format';
import { pointsAdjustmentsStore, type PointsAdjustment } from '../../services/marketing';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import type { Customer } from '../../types';
import { makeStyles, tierTone, TIER_ORDER } from './shared';

const TIER_FILTERS = ['All', ...TIER_ORDER] as const;
type TierFilter = (typeof TIER_FILTERS)[number];

export default function LoyaltyPointsTab() {
  return <WithStore store={pointsAdjustmentsStore}>{(rows, setRows) => <Loyalty adjustments={rows} setAdjustments={setRows} />}</WithStore>;
}

function Loyalty({ adjustments, setAdjustments }: { adjustments: PointsAdjustment[]; setAdjustments: (rows: PointsAdjustment[]) => void }) {
  const { customers, bookings, loyaltyTiers, today, showToast } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols, isPhone } = useResponsive();
  const [filter, setFilter] = useState<TierFilter>('All');
  const [adjusting, setAdjusting] = useState<Customer | null>(null);

  const tiers = useMemo(() => [...loyaltyTiers].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)), [loyaltyTiers]);
  const balance = (c: Customer) => c.loyaltyPoints + adjustments.filter((a) => a.customerId === c.id).reduce((s, a) => s + a.points, 0);
  const trips = (id: string) => bookings.filter((b) => b.customerId === id && b.status !== 'Cancelled').length;

  const filtered = useMemo(() => customers.filter((c) => filter === 'All' || c.loyaltyTier === filter), [customers, filter]);
  const list = useListControls(filtered, {
    search: (c) => `${c.name} ${c.phone}`,
    sorts: {
      'Most points': (a, b) => balance(b) - balance(a),
      'Most trips': (a, b) => trips(b.id) - trips(a.id),
      Name: (a, b) => a.name.localeCompare(b.name),
    },
  });
  const history = useListControls(adjustments, {
    search: (a) => `${customers.find((c) => c.id === a.customerId)?.name ?? ''} ${a.reason}`,
    pageSize: 5,
  });

  const totalPoints = customers.reduce((s, c) => s + balance(c), 0);

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      label: 'Customer',
      flex: 2,
      minWidth: 200,
      render: (c) => (
        <View style={[styles.custHead, { flexShrink: 1 }]}>
          <Avatar name={c.name} bg={c.avatarBg} size={30} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {c.phone}
            </Text>
          </View>
        </View>
      ),
    },
    { key: 'tier', label: 'Tier', minWidth: 90, render: (c) => <Badge label={c.loyaltyTier} tone={tierTone(c.loyaltyTier)} /> },
    { key: 'trips', label: 'Trips', minWidth: 60, align: 'right', value: (c) => trips(c.id) },
    { key: 'points', label: 'Points', minWidth: 80, align: 'right', value: (c) => balance(c).toLocaleString('en-IN') },
    { key: 'actions', label: 'Action', minWidth: 110, align: 'right', render: (c) => <Button label="Adjust" size="sm" variant="outline" icon={(col) => <Pencil size={12} color={col} />} onPress={() => setAdjusting(c)} /> },
  ];

  return (
    <View>
      <Grid cols={cols(2, 2, 2)}>
        <StatTile label="Points balance" value={totalPoints.toLocaleString('en-IN')} hint="All customers" tone="warm" icon={(c) => <Coins size={16} color={c} />} />
        <StatTile label="Members" value={customers.length} hint={`${customers.filter((c) => c.loyaltyTier === 'VIP').length} VIP`} tone="primary" icon={(c) => <Users size={16} color={c} />} />
      </Grid>

      <Section title="Loyalty tiers" subtitle="Tiers unlock by completed trips">
        <View style={[styles.ladder, isPhone && { flexDirection: 'column' }]}>
          {tiers.map((t, i) => {
            const tc = toneColors(colors, tierTone(t.tier));
            const count = customers.filter((c) => c.loyaltyTier === t.tier).length;
            return (
              <React.Fragment key={t.id}>
                <View style={[styles.rung, !isPhone && { flex: 1, marginTop: (tiers.length - 1 - i) * 14 }, { borderColor: tc.border }]}>
                  <View style={[styles.rungIcon, { backgroundColor: tc.bg }]}>{t.tier === 'VIP' ? <Crown size={18} color={tc.text} /> : <Award size={18} color={tc.text} />}</View>
                  <Text style={styles.rungTier}>{t.tier}</Text>
                  <Text style={styles.meta}>
                    {t.minTrips}+ trip{t.minTrips > 1 ? 's' : ''} · {count} customer{count === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.rungReward}>{t.reward}</Text>
                </View>
                {i < tiers.length - 1 ? (
                  <View style={styles.rungArrow} accessibilityElementsHidden importantForAccessibility="no">
                    {isPhone ? <ChevronDown size={16} color={colors.muted} /> : <ChevronRight size={16} color={colors.muted} />}
                  </View>
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      </Section>

      <Section title="Customer points" subtitle={`${list.total} of ${customers.length} shown`}>
        <ListToolbar controls={list} placeholder="Search name or phone" filters={<ChipGroup options={TIER_FILTERS} value={filter} onChange={setFilter} />} />
        <DataTable columns={columns} rows={list.pageRows} rowKey={(c) => c.id} empty={<EmptyState title="No customers" message="Nobody matches this search or tier." compact />} />
        <Pager controls={list} />
        <Text style={[styles.meta, { marginTop: 8 }]}>How points convert to tiers or rewards is pending business rules.</Text>
      </Section>

      <Section title="Adjustment history" subtitle="Manual changes to point balances">
        <ListToolbar controls={history} placeholder="Search customer or reason" />
        <Card padded={history.total > 0}>
          {history.total === 0 ? (
            <EmptyState title="No adjustments" message="Use Adjust on a customer to add or remove points." compact />
          ) : (
            history.pageRows.map((a) => (
              <View key={a.id} style={[styles.cardTop, { marginBottom: 10 }]}>
                <Badge label={`${a.points > 0 ? '+' : ''}${a.points} pts`} tone={a.points > 0 ? 'success' : 'danger'} />
                <Text style={[styles.rowTitle, { flexShrink: 1 }]}>{customers.find((c) => c.id === a.customerId)?.name ?? a.customerId}</Text>
                <Text style={[styles.meta, { flex: 1 }]}>{a.reason}</Text>
                <Text style={styles.meta}>{formatDate(a.date)}</Text>
              </View>
            ))
          )}
        </Card>
        <Pager controls={history} />
      </Section>

      {adjusting ? (
        <AdjustSheet
          customer={adjusting}
          balance={balance(adjusting)}
          onClose={() => setAdjusting(null)}
          onSave={(points, reason) => {
            setAdjustments([{ id: `ADJ-${Date.now()}`, customerId: adjusting.id, points, reason, date: today }, ...adjustments]);
            showToast(`${adjusting.name}: ${points > 0 ? '+' : ''}${points} points`);
            setAdjusting(null);
          }}
        />
      ) : null}
    </View>
  );
}

function AdjustSheet({ customer, balance, onClose, onSave }: { customer: Customer; balance: number; onClose: () => void; onSave: (points: number, reason: string) => void }) {
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<'Add' | 'Remove'>('Add');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const value = Number(points);
  const pointsError = !/^[1-9]\d{0,5}$/.test(points.trim()) ? 'Enter a whole number above 0' : mode === 'Remove' && value > balance ? `Only ${balance} points available` : undefined;
  const reasonError = !reason.trim() ? 'Reason is required' : undefined;

  const submit = () => {
    setTouched(true);
    if (pointsError || reasonError) return;
    onSave(mode === 'Add' ? value : -value, reason.trim());
  };

  return (
    <FormSheet
      visible
      title={`Adjust points: ${customer.name}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save adjustment" onPress={submit} />
        </>
      }>
      <Text style={[styles.meta, { marginBottom: 10 }]}>Current balance: {balance.toLocaleString('en-IN')} points</Text>
      <SegmentedControl options={['Add', 'Remove'] as const} value={mode} onChange={setMode} />
      <View style={{ height: 14 }} />
      <Field label="Points" required value={points} onChangeText={setPoints} keyboardType="number-pad" error={touched ? pointsError : undefined} />
      <Field label="Reason" required value={reason} onChangeText={setReason} placeholder="Why the balance changed" error={touched ? reasonError : undefined} />
    </FormSheet>
  );
}
