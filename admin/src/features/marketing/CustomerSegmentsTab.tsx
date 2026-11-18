import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Megaphone, Plus, Repeat, Trash2, Users } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormSheet, Grid, Section, StatTile, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { daysBetween, formatDate, formatINR } from '../../lib/format';
import { segmentsStore, type CustomSegment } from '../../services/marketing';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import type { Customer } from '../../types';
import { CreateCampaignSheet } from './CampaignsTab';
import { makeStyles, tierTone, TIER_ORDER } from './shared';

interface CustomerStats {
  customer: Customer;
  trips: number;
  revenue: number;
  lastTrip?: string;
  corporate: boolean;
}

const TIER_OPTIONS = ['Any', ...TIER_ORDER] as const;
type TierOption = (typeof TIER_OPTIONS)[number];

export default function CustomerSegmentsTab() {
  return <WithStore store={segmentsStore}>{(segments, setSegments) => <Segments custom={segments} setCustom={setSegments} />}</WithStore>;
}

function useCustomerStats(): CustomerStats[] {
  const { customers, bookings } = useApp();
  return useMemo(
    () =>
      customers.map((customer) => {
        const own = bookings.filter((b) => b.customerId === customer.id && b.status !== 'Cancelled');
        return {
          customer,
          trips: own.length,
          revenue: own.reduce((s, b) => s + b.totalAmount, 0),
          lastTrip: own.map((b) => b.pickupDate).sort().pop(),
          corporate: own.some((b) => b.classification === 'Corporate'),
        };
      }),
    [customers, bookings]
  );
}

const matchesCustom = (s: CustomerStats, seg: CustomSegment) =>
  s.trips >= seg.minTrips && (seg.tier === 'Any' || s.customer.loyaltyTier === seg.tier) && (!seg.city || s.customer.city.toLowerCase() === seg.city.toLowerCase());

function Segments({ custom, setCustom }: { custom: CustomSegment[]; setCustom: (s: CustomSegment[]) => void }) {
  const { today, showToast } = useApp();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const stats = useCustomerStats();
  const [selected, setSelected] = useState('Repeat customers');
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<CustomSegment | null>(null);
  const [campaignFor, setCampaignFor] = useState<string | null>(null);

  const isRepeat = (s: CustomerStats) => s.trips >= 2 || s.customer.loyaltyTier !== 'Bronze';
  const builtIn: { name: string; description: string; test: (s: CustomerStats) => boolean }[] = [
    { name: 'All customers', description: 'Everyone with a profile', test: () => true },
    { name: 'Repeat customers', description: '2+ trips or Silver tier and above', test: isRepeat },
    { name: 'Corporate', description: 'Has a corporate booking', test: (s) => s.corporate },
    { name: 'Inactive 90+ days', description: 'No trip in the last 90 days', test: (s) => !s.lastTrip || daysBetween(s.lastTrip, today) > 90 },
  ];
  const segments = [
    ...builtIn.map((b) => ({ ...b, custom: undefined as CustomSegment | undefined })),
    ...custom.map((c) => ({
      name: c.name,
      description: `${c.minTrips}+ trips · ${c.tier === 'Any' ? 'any tier' : c.tier}${c.city ? ` · ${c.city}` : ''}`,
      test: (s: CustomerStats) => matchesCustom(s, c),
      custom: c,
    })),
  ];
  const active = segments.find((s) => s.name === selected) ?? segments[0];
  const members = useMemo(() => stats.filter(active.test), [stats, active.name, custom]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useListControls(members, {
    search: (s) => `${s.customer.name} ${s.customer.phone} ${s.customer.city}`,
    sorts: {
      'Most trips': (a, b) => b.trips - a.trips,
      'Highest revenue': (a, b) => b.revenue - a.revenue,
      'Recent trip': (a, b) => (b.lastTrip ?? '').localeCompare(a.lastTrip ?? ''),
      Name: (a, b) => a.customer.name.localeCompare(b.customer.name),
    },
  });

  const repeatCount = stats.filter(isRepeat).length;
  const columns: Column<CustomerStats>[] = [
    {
      key: 'name',
      label: 'Customer',
      flex: 2,
      minWidth: 200,
      render: (s) => (
        <View style={[styles.custHead, { flexShrink: 1 }]}>
          <Avatar name={s.customer.name} bg={s.customer.avatarBg} size={30} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {s.customer.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {s.customer.city}
            </Text>
          </View>
        </View>
      ),
    },
    { key: 'tier', label: 'Tier', minWidth: 90, render: (s) => <Badge label={s.customer.loyaltyTier} tone={tierTone(s.customer.loyaltyTier)} /> },
    { key: 'trips', label: 'Trips', minWidth: 60, align: 'right', value: (s) => s.trips },
    { key: 'revenue', label: 'Revenue', minWidth: 100, align: 'right', value: (s) => formatINR(s.revenue) },
    { key: 'last', label: 'Last trip', minWidth: 110, value: (s) => (s.lastTrip ? formatDate(s.lastTrip) : 'No trips') },
  ];

  return (
    <View>
      <Grid cols={cols(2, 3, 3)}>
        <StatTile label="Customers" value={stats.length} tone="primary" icon={(c) => <Users size={16} color={c} />} />
        <StatTile label="Repeat customers" value={repeatCount} hint={stats.length ? `${Math.round((repeatCount / stats.length) * 100)}% of customers` : undefined} tone="success" icon={(c) => <Repeat size={16} color={c} />} />
        <StatTile label="Segments" value={segments.length} hint={`${custom.length} custom`} tone="info" icon={(c) => <Megaphone size={16} color={c} />} />
      </Grid>

      <Section title="Segments" subtitle="Choose a segment to see who is in it" action={<Button label="New segment" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setCreating(true)} />}>
        <Grid cols={cols(1, 2, 3)} gap={12}>
          {segments.map((s) => (
            <Card key={s.name} onPress={() => setSelected(s.name)} style={s.name === active.name ? styles.selectedCard : undefined}>
              <View style={styles.cardTop}>
                <Text style={[styles.rowTitle, { flex: 1 }]}>{s.name}</Text>
                <Badge label={String(stats.filter(s.test).length)} tone={s.name === active.name ? 'primary' : 'neutral'} />
              </View>
              <Text style={styles.meta}>{s.description}</Text>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section
        title={active.name}
        subtitle="Repeat tracking: trips, revenue and last visit for each customer"
        action={
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {active.custom ? <Button label="Delete segment" size="sm" variant="danger" icon={(c) => <Trash2 size={12} color={c} />} onPress={() => setRemoving(active.custom!)} /> : null}
            <Button label="Campaign to this segment" size="sm" variant="outline" disabled={members.length === 0} icon={(c) => <Megaphone size={12} color={c} />} onPress={() => setCampaignFor(`${active.name} (${members.length})`)} />
          </View>
        }>
        <ListToolbar controls={list} placeholder="Search name, phone or city" />
        <DataTable columns={columns} rows={list.pageRows} rowKey={(s) => s.customer.id} empty={<EmptyState title="No customers" message="Nobody matches this segment or search." compact />} />
        <Pager controls={list} />
      </Section>

      {creating ? (
        <SegmentSheet
          existing={segments.map((s) => s.name)}
          onClose={() => setCreating(false)}
          onSave={(seg) => {
            setCustom([...custom, seg]);
            setSelected(seg.name);
            setCreating(false);
            showToast(`Segment "${seg.name}" created`);
          }}
        />
      ) : null}
      {campaignFor ? <CreateCampaignSheet visible audienceLabel={campaignFor} onClose={() => setCampaignFor(null)} /> : null}
      <ConfirmDialog
        visible={!!removing}
        title={`Delete "${removing?.name}"?`}
        message="Customers are not affected. Existing campaigns keep their audience label."
        confirmLabel="Delete segment"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            setCustom(custom.filter((c) => c.id !== removing.id));
            setSelected('Repeat customers');
          }
          setRemoving(null);
        }}
      />
    </View>
  );
}

function SegmentSheet({ existing, onClose, onSave }: { existing: string[]; onClose: () => void; onSave: (s: CustomSegment) => void }) {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState('');
  const [minTrips, setMinTrips] = useState('1');
  const [tier, setTier] = useState<TierOption>('Any');
  const [city, setCity] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? 'Segment name is required' : existing.some((e) => e.toLowerCase() === name.trim().toLowerCase()) ? 'A segment with this name already exists' : undefined;
  const tripsError = !/^\d{1,3}$/.test(minTrips.trim()) ? 'Enter a whole number of trips' : undefined;

  const submit = () => {
    setTouched(true);
    if (nameError || tripsError) return;
    onSave({ id: `SEG-${Date.now()}`, name: name.trim(), minTrips: Number(minTrips), tier, city: city.trim() });
  };

  return (
    <FormSheet
      visible
      title="New segment"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Create segment" onPress={submit} />
        </>
      }>
      <Field label="Segment name" required value={name} onChangeText={setName} placeholder="e.g. Mumbai regulars" error={touched ? nameError : undefined} />
      <Field label="Minimum trips" required value={minTrips} onChangeText={setMinTrips} keyboardType="number-pad" error={touched ? tripsError : undefined} />
      <Text style={styles.label}>Loyalty tier</Text>
      <ChipGroup options={TIER_OPTIONS} value={tier} onChange={setTier} />
      <View style={{ height: 14 }} />
      <Field label="City" value={city} onChangeText={setCity} placeholder="Any city" hint="Leave blank for every city" />
    </FormSheet>
  );
}
