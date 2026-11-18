import { useRouter } from '@/shims/expo-router';
import { IndianRupee, Info, Pencil, Percent, Plus, Tag, Trash2, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import {
    Avatar,
    Badge,
    Button,
    Card,
    ChipGroup,
    ConfirmDialog,
    DataTable,
    EmptyState,
    Field,
    FormRow,
    FormSheet,
    Grid,
    Section,
    SimulatedNote,
    StatTile,
    VehiclePhoto,
    type Column,
} from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatINRCompact } from '../../lib/format';
import { vehicleRatesStore, type CustomerVehicleRate } from '../../services/marketing';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { CustomerCodeCommission } from '../../types';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';

const STATUS_FILTERS = ['All', 'Active', 'Inactive'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Parses a percentage string; returns an error message or the number. */
function parsePercent(raw: string): { value?: number; error?: string } {
  const t = raw.trim();
  if (!t) return { error: 'Enter a percentage' };
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return { error: 'Use a number with up to 2 decimals' };
  const n = parseFloat(t);
  if (n < 0 || n > 100) return { error: 'Must be between 0 and 100' };
  return { value: n };
}

const estimate = (revenue: number, pct: number) => Math.round((revenue * pct) / 100);

export default function CustomerCommissionTab() {
  const { commissions, customers, bookings } = useApp();
  const { cols } = useResponsive();
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => commissions.filter((c) => (filter === 'All' ? true : filter === 'Active' ? c.active : !c.active)), [commissions, filter]);
  const list = useListControls(filtered, {
    search: (c) => `${c.code} ${c.ownerName}`,
    sorts: {
      Code: (a, b) => a.code.localeCompare(b.code),
      'Highest revenue': (a, b) => b.totalRevenueGenerated - a.totalRevenueGenerated,
      'Highest %': (a, b) => b.commissionPercent - a.commissionPercent,
    },
    pageSize: 6,
  });
  const rows = list.pageRows;
  const active = commissions.filter((c) => c.active);
  const totalBookings = active.reduce((s, c) => s + c.totalBookings, 0);
  const totalRevenue = active.reduce((s, c) => s + c.totalRevenueGenerated, 0);
  const totalEstimate = active.reduce((s, c) => s + estimate(c.totalRevenueGenerated, c.commissionPercent), 0);
  const linkedCustomers = customers.filter((cu) => cu.customerCode && commissions.some((c) => c.code === cu.customerCode)).length;

  return (
    <View>
      <PendingRulesCard />
      <SimulatedNote>Payouts are not processed automatically yet; record them in Finance.</SimulatedNote>

      <Grid cols={cols(2, 2, 4)} style={{ marginTop: 8 }}>
        <StatTile label="Active codes" value={`${active.length}/${commissions.length}`} hint={`${linkedCustomers} customers linked`} tone="primary" icon={(c) => <Tag size={16} color={c} />} />
        <StatTile label="Bookings via codes" value={totalBookings} hint="Active codes" tone="info" icon={(c) => <Users size={16} color={c} />} />
        <StatTile label="Revenue via codes" value={formatINRCompact(totalRevenue)} hint="Active codes" tone="success" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Estimated amount" value={formatINRCompact(totalEstimate)} hint="Estimate at configured %" emphasis icon={(c) => <Percent size={16} color={c} />} />
      </Grid>

      <Section
        title="Codes"
        subtitle={`${list.total} of ${commissions.length} shown`}
        action={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {filter !== 'All' ? <Button label="Reset" size="sm" variant="ghost" onPress={() => setFilter('All')} /> : null}
            <Button label="New customer code" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setCreateOpen(true)} />
          </View>
        }>
        <ListToolbar controls={list} placeholder="Search code or owner" filters={<ChipGroup options={STATUS_FILTERS} value={filter} onChange={setFilter} />} />
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              title="No customer codes"
              message={filter === 'All' ? 'Create a code to start tracking referral bookings.' : `No ${filter.toLowerCase()} codes.`}
              action={
                filter === 'All' ? (
                  <Button label="New customer code" size="sm" onPress={() => setCreateOpen(true)} />
                ) : (
                  <Button label="Show all" size="sm" variant="outline" onPress={() => setFilter('All')} />
                )
              }
            />
          </Card>
        ) : (
          <Grid cols={cols(1, 1, 2)} gap={16}>
            {rows.map((c) => (
              <CommissionCard key={c.code} c={c} trackedBookings={bookings.filter((b) => b.status !== 'Cancelled' && customers.some((cu) => cu.id === b.customerId && cu.customerCode === c.code)).length} />
            ))}
          </Grid>
        )}
        <Pager controls={list} />
      </Section>

      <WithStore store={vehicleRatesStore}>{(rates, setRates) => <VehicleRatesSection rates={rates} setRates={setRates} />}</WithStore>

      <CreateCodeSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

function PendingRulesCard() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card tone="highlight" style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Info size={18} color={colors.onHighlight} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.onHighlight }]}>Pending business clarification</Text>
          <Text style={[styles.body, { color: colors.onHighlight }]}>
            The percentage is configurable. How it is applied (on rental subtotal vs total, per vehicle, payout timing) is pending business
            clarification — figures shown are estimates at the configured %.
          </Text>
        </View>
      </View>
    </Card>
  );
}

function CommissionCard({ c, trackedBookings }: { c: CustomerCodeCommission; trackedBookings: number }) {
  const { vehicles, customers, updateCommission, showToast } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [draft, setDraft] = useState(String(c.commissionPercent));
  const [confirmOff, setConfirmOff] = useState(false);

  const parsed = parsePercent(draft);
  const dirty = parsed.value !== undefined && parsed.value !== c.commissionPercent;
  const pct = parsed.value ?? c.commissionPercent;
  const linkedVehicles = vehicles.filter((v) => c.vehicleIds.includes(v.id));
  const codeCustomers = customers.filter((cu) => cu.customerCode === c.code);

  const save = () => {
    if (parsed.value === undefined) return;
    updateCommission(c.code, { commissionPercent: parsed.value });
    showToast(`${c.code} set to ${parsed.value}%`);
  };

  const setActive = (next: boolean) => {
    updateCommission(c.code, { active: next });
    showToast(`${c.code} ${next ? 'activated' : 'deactivated'}`);
  };

  return (
    <Card style={!c.active && { opacity: 0.8 }}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={styles.code}>{c.code}</Text>
            <Badge label={c.active ? 'Active' : 'Inactive'} tone={c.active ? 'success' : 'neutral'} />
          </View>
          <Text style={styles.meta}>{c.ownerName}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Switch
            accessibilityLabel={`${c.code} active`}
            value={c.active}
            onValueChange={(v) => (v ? setActive(true) : setConfirmOff(true))}
            trackColor={{ false: colors.lineStrong, true: colors.secondary }}
            thumbColor={c.active ? colors.primary : colors.card}
            {...({ activeThumbColor: colors.primary } as object)}
          />
          <Text style={styles.meta}>{c.active ? 'Active' : 'Off'}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <MiniStat label="Bookings" value={String(c.totalBookings)} hint={`${trackedBookings} in current list`} />
        <MiniStat label="Revenue generated" value={formatINR(c.totalRevenueGenerated)} />
        <MiniStat label={`Estimate at ${pct}%`} value={formatINR(estimate(c.totalRevenueGenerated, pct))} hint="Estimate" strong />
      </View>

      <View style={styles.pctRow}>
        <Field
          label="Configurable %"
          value={draft}
          onChangeText={setDraft}
          keyboardType="decimal-pad"
          error={parsed.error}
          hint="0–100 · how it applies is pending business rules"
          right={<Text style={styles.meta}>%</Text>}
          style={{ flex: 1, marginBottom: 0 }}
        />
        <View style={{ paddingTop: 22, flexDirection: 'row', gap: 6 }}>
          <Button label="Save" size="sm" disabled={!dirty} onPress={save} />
          {dirty || parsed.error ? <Button label="Undo" size="sm" variant="ghost" onPress={() => setDraft(String(c.commissionPercent))} /> : null}
        </View>
      </View>

      <Text style={styles.subhead}>Linked vehicles</Text>
      {linkedVehicles.length === 0 ? (
        <Text style={styles.meta}>No vehicles linked.</Text>
      ) : (
        <View style={styles.vehicleWrap}>
          {linkedVehicles.map((v) => (
            <TouchableOpacity
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${v.name}`}
              style={styles.vehicleChip}
              onPress={() => router.push(`/fleet/${v.id}` as any)}>
              <VehiclePhoto source={v.imageAsset} style={styles.thumb} radius={6} />
              <View style={{ minWidth: 0, flexShrink: 1 }}>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {v.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {v.vehicleNumber}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.subhead}>Customers using this code</Text>
      {codeCustomers.length === 0 ? (
        <Text style={styles.meta}>No customer profiles use this code yet.</Text>
      ) : (
        <View style={styles.vehicleWrap}>
          {codeCustomers.map((cu) => (
            <TouchableOpacity
              key={cu.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${cu.name}`}
              style={styles.customerChip}
              onPress={() => router.push(`/customers/${cu.id}` as any)}>
              <Avatar name={cu.name} bg={cu.avatarBg} size={26} />
              <Text style={styles.vehicleName} numberOfLines={1}>
                {cu.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={confirmOff}
        title={`Deactivate ${c.code}?`}
        message={`New bookings using ${c.code} will no longer be attributed to ${c.ownerName}. Existing figures are kept. You can reactivate the code at any time.`}
        confirmLabel="Deactivate"
        danger
        onCancel={() => setConfirmOff(false)}
        onConfirm={() => {
          setActive(false);
          setConfirmOff(false);
        }}
      />
    </Card>
  );
}

function MiniStat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.mini, strong && styles.miniStrong]}>
      <Text style={styles.miniLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.miniValue, strong && styles.miniValueStrong]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.miniLabel} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- create sheet

function VehicleRatesSection({ rates, setRates }: { rates: CustomerVehicleRate[]; setRates: (rates: CustomerVehicleRate[]) => void }) {
  const { customers, vehicles, showToast } = useApp();
  const [editing, setEditing] = useState<CustomerVehicleRate | 'new' | null>(null);
  const [removing, setRemoving] = useState<CustomerVehicleRate | null>(null);
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const vehicleLabel = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.name} · ${v.vehicleNumber}` : id;
  };
  const list = useListControls(rates, {
    search: (r) => `${customerName(r.customerId)} ${vehicleLabel(r.vehicleId)} ${r.note}`,
    sorts: {
      Customer: (a, b) => customerName(a.customerId).localeCompare(customerName(b.customerId)),
      'Highest %': (a, b) => b.percent - a.percent,
      Vehicle: (a, b) => vehicleLabel(a.vehicleId).localeCompare(vehicleLabel(b.vehicleId)),
    },
  });

  const columns: Column<CustomerVehicleRate>[] = [
    { key: 'customer', label: 'Customer', flex: 1.4, minWidth: 150, value: (r) => customerName(r.customerId) },
    { key: 'vehicle', label: 'Vehicle', flex: 1.6, minWidth: 190, value: (r) => vehicleLabel(r.vehicleId) },
    { key: 'percent', label: 'Rental %', minWidth: 80, align: 'right', value: (r) => `${r.percent}%` },
    { key: 'note', label: 'Note', flex: 1.6, minWidth: 170 },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 170,
      align: 'right',
      render: (r) => (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button label="Edit" size="sm" variant="outline" icon={(c) => <Pencil size={12} color={c} />} onPress={() => setEditing(r)} />
          <Button label="Remove" size="sm" variant="danger" icon={(c) => <Trash2 size={12} color={c} />} onPress={() => setRemoving(r)} />
        </View>
      ),
    },
  ];

  return (
    <Section
      title="Customer-specific vehicle rates"
      subtitle="Rental percentage agreed with one customer for one vehicle"
      action={<Button label="Add rate" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setEditing('new')} />}>
      <ListToolbar controls={list} placeholder="Search customer, vehicle or note" />
      <DataTable
        columns={columns}
        rows={list.pageRows}
        rowKey={(r) => r.id}
        empty={<EmptyState title="No customer rates" message="Add a rate to give a customer their own percentage on a vehicle." compact />}
      />
      <Pager controls={list} />
      {editing ? (
        <VehicleRateSheet
          rate={editing === 'new' ? null : editing}
          rates={rates}
          onClose={() => setEditing(null)}
          onSave={(rate) => {
            setRates(rates.some((r) => r.id === rate.id) ? rates.map((r) => (r.id === rate.id ? rate : r)) : [rate, ...rates]);
            showToast(`${customerName(rate.customerId)} set to ${rate.percent}%`);
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!removing}
        title="Remove this rate?"
        message={removing ? `${customerName(removing.customerId)} will no longer have a custom percentage on ${vehicleLabel(removing.vehicleId)}.` : undefined}
        confirmLabel="Remove rate"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) setRates(rates.filter((r) => r.id !== removing.id));
          setRemoving(null);
        }}
      />
    </Section>
  );
}

function VehicleRateSheet({
  rate,
  rates,
  onClose,
  onSave,
}: {
  rate: CustomerVehicleRate | null;
  rates: CustomerVehicleRate[];
  onClose: () => void;
  onSave: (r: CustomerVehicleRate) => void;
}) {
  const { customers, vehicles } = useApp();
  const styles = useThemedStyles(makeStyles);
  const fleet = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const [customerId, setCustomerId] = useState(rate?.customerId ?? '');
  const [vehicleId, setVehicleId] = useState(rate?.vehicleId ?? '');
  const [pct, setPct] = useState(rate ? String(rate.percent) : '10');
  const [note, setNote] = useState(rate?.note ?? '');
  const [touched, setTouched] = useState(false);

  const parsed = parsePercent(pct);
  const customerError = !customerId ? 'Choose a customer' : undefined;
  const vehicleError = !vehicleId
    ? 'Choose a vehicle'
    : rates.some((r) => r.id !== rate?.id && r.customerId === customerId && r.vehicleId === vehicleId)
      ? 'This customer already has a rate for this vehicle'
      : undefined;

  const submit = () => {
    setTouched(true);
    if (customerError || vehicleError || parsed.value === undefined) return;
    onSave({ id: rate?.id ?? `CVR-${Date.now()}`, customerId, vehicleId, percent: parsed.value, note: note.trim() });
  };

  return (
    <FormSheet
      visible
      title={rate ? 'Edit customer rate' : 'Add customer rate'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save rate" onPress={submit} />
        </>
      }>
      <Text style={styles.subhead}>Customer</Text>
      <ChipGroup options={customers.map((c) => c.id)} value={customerId} labels={Object.fromEntries(customers.map((c) => [c.id, c.name]))} onChange={setCustomerId} />
      {touched && customerError ? <Text style={[styles.meta, { marginTop: 6 }]}>{customerError}</Text> : null}
      <Text style={styles.subhead}>Vehicle</Text>
      <ChipGroup options={fleet.map((v) => v.id)} value={vehicleId} labels={Object.fromEntries(fleet.map((v) => [v.id, `${v.name} · ${v.vehicleNumber}`]))} onChange={setVehicleId} />
      {touched && vehicleError ? <Text style={[styles.meta, { marginTop: 6 }]}>{vehicleError}</Text> : null}
      <View style={{ height: 14 }} />
      <Field
        label="Rental %"
        required
        value={pct}
        onChangeText={setPct}
        keyboardType="decimal-pad"
        error={touched ? parsed.error : undefined}
        hint="0–100 · how it applies is pending business rules"
        right={<Text style={styles.meta}>%</Text>}
      />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Why this rate was agreed" />
    </FormSheet>
  );
}

function CreateCodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { commissions, vehicles, addCommission } = useApp();
  const styles = useThemedStyles(makeStyles);
  const [code, setCode] = useState('');
  const [owner, setOwner] = useState('');
  const [pct, setPct] = useState('10');
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const fleet = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const labels = useMemo(() => Object.fromEntries(fleet.map((v) => [v.id, `${v.name} · ${v.vehicleNumber}`])), [fleet]);

  const normalized = code.trim().toUpperCase();
  const codeError = !normalized
    ? 'Code is required'
    : !/^[A-Z0-9-]{3,20}$/.test(normalized)
      ? '3–20 characters: letters, numbers and hyphens'
      : commissions.some((c) => c.code === normalized)
        ? 'This code already exists'
        : undefined;
  const ownerError = !owner.trim() ? 'Owner name is required' : undefined;
  const pctParsed = parsePercent(pct);

  const reset = () => {
    setCode('');
    setOwner('');
    setPct('10');
    setVehicleIds([]);
    setTouched(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    setTouched(true);
    if (codeError || ownerError || pctParsed.value === undefined) return;
    addCommission({
      code: normalized,
      ownerName: owner.trim(),
      commissionPercent: pctParsed.value,
      totalBookings: 0,
      totalRevenueGenerated: 0,
      commissionEarned: 0,
      vehicleIds,
      active: true,
    });
    close();
  };

  return (
    <FormSheet
      visible={visible}
      title="New customer code"
      onClose={close}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={close} />
          <Button label="Create code" onPress={submit} />
        </>
      }>
      <FormRow>
        <Field
          label="Code"
          required
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="e.g. CORP-ACME"
          error={touched ? codeError : undefined}
          hint="Customers enter this code at booking"
        />
        <Field
          label="Configurable %"
          required
          value={pct}
          onChangeText={setPct}
          keyboardType="decimal-pad"
          error={touched ? pctParsed.error : undefined}
          hint="0–100"
          right={<Text style={styles.meta}>%</Text>}
        />
      </FormRow>
      <Field label="Owner" required value={owner} onChangeText={setOwner} placeholder="Partner or referrer name" error={touched ? ownerError : undefined} />
      <Text style={styles.subhead}>Linked vehicles</Text>
      <Text style={[styles.meta, { marginBottom: 8 }]}>Select the vehicles this percentage applies to (optional).</Text>
      {fleet.length === 0 ? (
        <Text style={styles.meta}>No vehicles in the fleet.</Text>
      ) : (
        <ChipGroup
          options={fleet.map((v) => v.id)}
          value={vehicleIds}
          labels={labels}
          onChange={(id) => setVehicleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
        />
      )}
      <View style={{ height: 12 }} />
      <SimulatedNote>How the percentage is applied is pending business clarification. Figures are estimates.</SimulatedNote>
    </FormSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cardTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
    },
    body: {
      color: colors.txt,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 2,
    },
    meta: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    code: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    mini: {
      flexGrow: 1,
      flexBasis: 140,
      backgroundColor: colors.bg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 10,
    },
    miniStrong: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
    },
    miniLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    miniValue: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
      marginVertical: 2,
    },
    miniValueStrong: {
      color: colors.primaryText,
    },
    pctRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: 14,
      flexWrap: 'wrap',
    },
    subhead: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 16,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    vehicleWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    vehicleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 8,
      maxWidth: '100%',
    },
    customerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 999,
      paddingVertical: 4,
      paddingLeft: 4,
      paddingRight: 12,
      maxWidth: '100%',
    },
    thumb: {
      width: 56,
      height: 34,
      borderRadius: 8,
      backgroundColor: colors.card,
    },
    vehicleName: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
  });
