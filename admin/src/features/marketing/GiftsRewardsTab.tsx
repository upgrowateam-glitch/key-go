import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Gift, Package, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, ProgressBar, Section, SimulatedNote, ToggleRow, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { formatDate } from '../../lib/format';
import { giftDispatchStore, giftsStore, type GiftDispatch, type GiftItem } from '../../services/marketing';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import type { Customer, LoyaltyRewardTier } from '../../types';
import { makeStyles, Metric, tierTone, TIER_ORDER } from './shared';

const GIFT_KINDS = ['Voucher', 'Upgrade', 'Merchandise'] as const;
const KIND_FILTERS = ['All', ...GIFT_KINDS] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

export default function GiftsRewardsTab() {
  return (
    <WithStore store={giftsStore}>
      {(gifts, setGifts) => (
        <WithStore store={giftDispatchStore}>
          {(dispatches, setDispatches) => (
            <View>
              <RepeatCustomers gifts={gifts} setGifts={setGifts} dispatches={dispatches} setDispatches={setDispatches} />
              <GiftCatalog gifts={gifts} setGifts={setGifts} />
              <DispatchHistory gifts={gifts} dispatches={dispatches} />
            </View>
          )}
        </WithStore>
      )}
    </WithStore>
  );
}

// ---------------------------------------------------------------- repeat customers

function RepeatCustomers({
  gifts,
  setGifts,
  dispatches,
  setDispatches,
}: {
  gifts: GiftItem[];
  setGifts: (g: GiftItem[]) => void;
  dispatches: GiftDispatch[];
  setDispatches: (d: GiftDispatch[]) => void;
}) {
  const { customers, bookings, loyaltyTiers, today, showToast } = useApp();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const [giftFor, setGiftFor] = useState<Customer | null>(null);

  const tiers = useMemo(() => [...loyaltyTiers].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)), [loyaltyTiers]);
  const repeat = useMemo(() => {
    const tripsOf = (id: string) => bookings.filter((b) => b.customerId === id && b.status !== 'Cancelled').length;
    return customers.map((c) => ({ c, trips: tripsOf(c.id) })).filter((x) => x.trips >= 2 || TIER_ORDER.indexOf(x.c.loyaltyTier) >= 1);
  }, [customers, bookings]);
  const nextTier = (t: Customer['loyaltyTier']): LoyaltyRewardTier | undefined => tiers.find((x) => TIER_ORDER.indexOf(x.tier) === TIER_ORDER.indexOf(t) + 1);

  const list = useListControls(repeat, {
    search: (x) => `${x.c.name} ${x.c.phone}`,
    sorts: {
      'Highest tier': (a, b) => TIER_ORDER.indexOf(b.c.loyaltyTier) - TIER_ORDER.indexOf(a.c.loyaltyTier) || b.trips - a.trips,
      'Most trips': (a, b) => b.trips - a.trips,
      Name: (a, b) => a.c.name.localeCompare(b.c.name),
    },
    pageSize: 6,
  });

  return (
    <Section title="Repeat customers" subtitle="2+ trips or Silver tier and above" style={{ marginTop: 0 }}>
      <ListToolbar controls={list} placeholder="Search name or phone" />
      {list.total === 0 ? (
        <Card>
          <EmptyState title="No repeat customers" message="Customers with two or more trips will appear here." icon={(c) => <Gift size={22} color={c} />} />
        </Card>
      ) : (
        <Grid cols={cols(1, 2, 3)} gap={16}>
          {list.pageRows.map(({ c, trips: n }) => {
            const next = nextTier(c.loyaltyTier);
            const progress = next ? Math.min(1, n / next.minTrips) : 1;
            const sent = dispatches.some((d) => d.customerId === c.id);
            return (
              <Card key={c.id}>
                <View style={styles.custHead}>
                  <Avatar name={c.name} bg={c.avatarBg} size={40} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {c.phone}
                    </Text>
                  </View>
                  <Badge label={c.loyaltyTier} tone={tierTone(c.loyaltyTier)} />
                </View>
                <View style={styles.metricsRow}>
                  <Metric label="Trips" value={String(n)} />
                  <Metric label="Points" value={c.loyaltyPoints.toLocaleString('en-IN')} />
                  <Metric label="Since" value={formatDate(c.customerSince)} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <View style={styles.progressHead}>
                    <Text style={styles.metricLabel}>{next ? `Trips toward ${next.tier}` : 'Top tier reached'}</Text>
                    <Text style={styles.metricLabel}>{next ? `${Math.min(n, next.minTrips)}/${next.minTrips}` : '—'}</Text>
                  </View>
                  <ProgressBar value={progress} tone={next ? 'primary' : 'success'} />
                  <Text style={[styles.meta, { marginTop: 6 }]} numberOfLines={2}>
                    {next ? `Next reward: ${next.reward}` : 'Enjoys all VIP benefits'}
                  </Text>
                </View>
                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {sent ? <Badge label="Gift recorded" tone="success" /> : null}
                  <View style={{ flex: 1 }} />
                  <Button label={sent ? 'Send again' : 'Send gift'} size="sm" variant={sent ? 'outline' : 'highlight'} icon={(col) => <Gift size={12} color={col} />} onPress={() => setGiftFor(c)} />
                </View>
              </Card>
            );
          })}
        </Grid>
      )}
      <Pager controls={list} />
      {giftFor ? (
        <SendGiftSheet
          customer={giftFor}
          gifts={gifts}
          onClose={() => setGiftFor(null)}
          onSend={(gift, note) => {
            setDispatches([{ id: `GD-${Date.now()}`, customerId: giftFor.id, giftId: gift.id, note, date: today }, ...dispatches]);
            setGifts(gifts.map((g) => (g.id === gift.id ? { ...g, stock: g.stock - 1 } : g)));
            showToast(`${gift.name} for ${giftFor.name} queued (simulated)`);
            setGiftFor(null);
          }}
        />
      ) : null}
    </Section>
  );
}

function SendGiftSheet({ customer, gifts, onClose, onSend }: { customer: Customer; gifts: GiftItem[]; onClose: () => void; onSend: (gift: GiftItem, note: string) => void }) {
  const styles = useThemedStyles(makeStyles);
  const available = gifts.filter((g) => g.active && g.stock > 0);
  const [giftId, setGiftId] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const gift = available.find((g) => g.id === giftId);

  return (
    <FormSheet
      visible
      title={`Send gift to ${customer.name}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button
            label="Queue gift (simulated)"
            disabled={available.length === 0}
            onPress={() => {
              setTouched(true);
              if (gift) onSend(gift, note.trim());
            }}
          />
        </>
      }>
      <SimulatedNote>No gift is dispatched and no message is sent. This only records the gift in the history below.</SimulatedNote>
      <View style={{ height: 12 }} />
      <Text style={styles.label}>Gift</Text>
      {available.length === 0 ? (
        <Text style={styles.meta}>No active gifts in stock. Add one to the catalog first.</Text>
      ) : (
        <ChipGroup options={available.map((g) => g.id)} value={giftId} labels={Object.fromEntries(available.map((g) => [g.id, `${g.name} · ${g.stock} left`]))} onChange={setGiftId} />
      )}
      {touched && !gift && available.length > 0 ? <Text style={[styles.meta, { marginTop: 6 }]}>Choose a gift</Text> : null}
      <View style={{ height: 14 }} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Thanks for your fifth trip" />
    </FormSheet>
  );
}

// ---------------------------------------------------------------- catalog

function GiftCatalog({ gifts, setGifts }: { gifts: GiftItem[]; setGifts: (g: GiftItem[]) => void }) {
  const { showToast } = useApp();
  const styles = useThemedStyles(makeStyles);
  const [filter, setFilter] = useState<KindFilter>('All');
  const [editing, setEditing] = useState<GiftItem | 'new' | null>(null);
  const [removing, setRemoving] = useState<GiftItem | null>(null);
  const filtered = useMemo(() => gifts.filter((g) => filter === 'All' || g.kind === filter), [gifts, filter]);
  const list = useListControls(filtered, {
    search: (g) => `${g.name} ${g.kind}`,
    sorts: {
      Name: (a, b) => a.name.localeCompare(b.name),
      'Lowest stock': (a, b) => a.stock - b.stock,
      'Points cost': (a, b) => a.pointsCost - b.pointsCost,
    },
    pageSize: 6,
  });
  const columns: Column<GiftItem>[] = [
    { key: 'name', label: 'Gift', flex: 2, minWidth: 180, render: (g) => <Text style={styles.rowTitle}>{g.name}</Text> },
    { key: 'kind', label: 'Kind', minWidth: 110 },
    { key: 'points', label: 'Points cost', minWidth: 90, align: 'right', value: (g) => g.pointsCost.toLocaleString('en-IN') },
    { key: 'stock', label: 'Stock', minWidth: 70, align: 'right', value: (g) => g.stock },
    { key: 'status', label: 'Status', minWidth: 90, render: (g) => <Badge label={g.active ? 'Active' : 'Inactive'} tone={g.active ? 'success' : 'neutral'} /> },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 170,
      align: 'right',
      render: (g) => (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button label="Edit" size="sm" variant="outline" icon={(c) => <Pencil size={12} color={c} />} onPress={() => setEditing(g)} />
          <Button label="Delete" size="sm" variant="danger" icon={(c) => <Trash2 size={12} color={c} />} onPress={() => setRemoving(g)} />
        </View>
      ),
    },
  ];

  return (
    <Section title="Gift catalog" subtitle="Rewards staff can give to customers" action={<Button label="Add gift" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setEditing('new')} />}>
      <ListToolbar controls={list} placeholder="Search gifts" filters={<ChipGroup options={KIND_FILTERS} value={filter} onChange={setFilter} />} />
      <DataTable columns={columns} rows={list.pageRows} rowKey={(g) => g.id} empty={<EmptyState title="No gifts" message="Add a gift to start rewarding customers." icon={(c) => <Package size={22} color={c} />} compact />} />
      <Pager controls={list} />
      {editing ? (
        <GiftSheet
          gift={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            setGifts(gifts.some((x) => x.id === g.id) ? gifts.map((x) => (x.id === g.id ? g : x)) : [g, ...gifts]);
            showToast(`${g.name} saved`);
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!removing}
        title={`Delete "${removing?.name}"?`}
        message="It is removed from the catalog. Past gift records stay in the history."
        confirmLabel="Delete gift"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) setGifts(gifts.filter((g) => g.id !== removing.id));
          setRemoving(null);
        }}
      />
    </Section>
  );
}

function GiftSheet({ gift, onClose, onSave }: { gift: GiftItem | null; onClose: () => void; onSave: (g: GiftItem) => void }) {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(gift?.name ?? '');
  const [kind, setKind] = useState<GiftItem['kind']>(gift?.kind ?? 'Voucher');
  const [points, setPoints] = useState(gift ? String(gift.pointsCost) : '500');
  const [stock, setStock] = useState(gift ? String(gift.stock) : '10');
  const [active, setActive] = useState(gift?.active ?? true);
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? 'Gift name is required' : undefined;
  const pointsError = !/^\d{1,6}$/.test(points.trim()) ? 'Enter a whole number of points' : undefined;
  const stockError = !/^\d{1,5}$/.test(stock.trim()) ? 'Enter a whole number' : undefined;

  const submit = () => {
    setTouched(true);
    if (nameError || pointsError || stockError) return;
    onSave({ id: gift?.id ?? `GIFT-${Date.now()}`, name: name.trim(), kind, pointsCost: Number(points), stock: Number(stock), active });
  };

  return (
    <FormSheet
      visible
      title={gift ? 'Edit gift' : 'Add gift'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save gift" onPress={submit} />
        </>
      }>
      <Field label="Gift name" required value={name} onChangeText={setName} placeholder="e.g. Rs 500 fuel voucher" error={touched ? nameError : undefined} />
      <Text style={styles.label}>Kind</Text>
      <ChipGroup options={GIFT_KINDS} value={kind} onChange={setKind} />
      <View style={{ height: 14 }} />
      <FormRow>
        <Field label="Points cost" required value={points} onChangeText={setPoints} keyboardType="number-pad" error={touched ? pointsError : undefined} />
        <Field label="Stock" required value={stock} onChangeText={setStock} keyboardType="number-pad" error={touched ? stockError : undefined} />
      </FormRow>
      <ToggleRow label="Active" description="Inactive gifts cannot be sent" value={active} onValueChange={setActive} />
    </FormSheet>
  );
}

// ---------------------------------------------------------------- history

function DispatchHistory({ gifts, dispatches }: { gifts: GiftItem[]; dispatches: GiftDispatch[] }) {
  const { customers } = useApp();
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const giftName = (id: string) => gifts.find((g) => g.id === id)?.name ?? 'Removed gift';
  const list = useListControls(dispatches, { search: (d) => `${customerName(d.customerId)} ${giftName(d.giftId)} ${d.note}`, pageSize: 5 });
  const columns: Column<GiftDispatch>[] = [
    { key: 'date', label: 'Date', minWidth: 110, value: (d) => formatDate(d.date) },
    { key: 'customer', label: 'Customer', flex: 1.4, minWidth: 150, value: (d) => customerName(d.customerId) },
    { key: 'gift', label: 'Gift', flex: 1.4, minWidth: 170, value: (d) => giftName(d.giftId) },
    { key: 'note', label: 'Note', flex: 1.6, minWidth: 170, value: (d) => d.note || '—' },
    { key: 'status', label: 'Status', minWidth: 140, render: () => <Badge label="Simulated" tone="warning" /> },
  ];
  return (
    <Section title="Gift history" subtitle="Gifts recorded from this page">
      <ListToolbar controls={list} placeholder="Search customer, gift or note" />
      <DataTable columns={columns} rows={list.pageRows} rowKey={(d) => d.id} empty={<EmptyState title="No gifts recorded" message="Gifts you send appear here." compact />} />
      <Pager controls={list} />
    </Section>
  );
}
