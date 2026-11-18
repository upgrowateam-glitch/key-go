import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Copy, Gift, Plus, Share2, Tag, Users } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, FormRow, FormSheet, Grid, ProgressBar, Section, StatTile } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { daysBetween, formatDate } from '../../lib/format';
import { referralsStore, type ReferralCode } from '../../services/marketing';
import { copyText, ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import { makeStyles } from './shared';

const FILTERS = ['All', 'Active', 'Inactive', 'Expired'] as const;
type Filter = (typeof FILTERS)[number];

export default function ReferralCodesTab() {
  return <WithStore store={referralsStore}>{(rows, setRows) => <Referrals rows={rows} setRows={setRows} />}</WithStore>;
}

function Referrals({ rows, setRows }: { rows: ReferralCode[]; setRows: (rows: ReferralCode[]) => void }) {
  const { customers, today, showToast } = useApp();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const [filter, setFilter] = useState<Filter>('All');
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<ReferralCode | null>(null);

  const ownerName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;
  const expired = (r: ReferralCode) => daysBetween(today, r.expiresOn) < 0;
  const statusOf = (r: ReferralCode): Exclude<Filter, 'All'> => (expired(r) ? 'Expired' : r.active ? 'Active' : 'Inactive');

  const filtered = useMemo(() => rows.filter((r) => filter === 'All' || statusOf(r) === filter), [rows, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useListControls(filtered, {
    search: (r) => `${r.code} ${ownerName(r.customerId)}`,
    sorts: {
      'Most used': (a, b) => b.uses - a.uses,
      'Expiring soon': (a, b) => a.expiresOn.localeCompare(b.expiresOn),
      Code: (a, b) => a.code.localeCompare(b.code),
    },
    pageSize: 6,
  });

  const totalUses = rows.reduce((s, r) => s + r.uses, 0);
  const points = rows.reduce((s, r) => s + r.uses * r.referrerRewardPoints, 0);

  return (
    <View>
      <Grid cols={cols(2, 3, 3)}>
        <StatTile label="Active codes" value={`${rows.filter((r) => statusOf(r) === 'Active').length}/${rows.length}`} tone="primary" icon={(c) => <Tag size={16} color={c} />} />
        <StatTile label="Friends referred" value={totalUses} tone="success" icon={(c) => <Users size={16} color={c} />} />
        <StatTile label="Points earned" value={points.toLocaleString('en-IN')} hint="By referrers" tone="warm" icon={(c) => <Gift size={16} color={c} />} />
      </Grid>

      <Section title="Referral codes" subtitle={`${list.total} of ${rows.length} shown`} action={<Button label="New referral code" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setCreating(true)} />}>
        <ListToolbar controls={list} placeholder="Search code or customer" filters={<ChipGroup options={FILTERS} value={filter} onChange={setFilter} />} />
        {list.total === 0 ? (
          <Card>
            <EmptyState title="No referral codes" message="Nothing matches this search or filter." icon={(c) => <Share2 size={22} color={c} />} action={<Button label="New referral code" size="sm" onPress={() => setCreating(true)} />} />
          </Card>
        ) : (
          <Grid cols={cols(1, 2, 3)} gap={16}>
            {list.pageRows.map((r) => {
              const status = statusOf(r);
              return (
                <Card key={r.id} style={status !== 'Active' && { opacity: 0.8 }}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>
                      {r.code}
                    </Text>
                    <Badge label={status} tone={status === 'Active' ? 'success' : status === 'Expired' ? 'danger' : 'neutral'} />
                  </View>
                  <Text style={styles.meta}>{ownerName(r.customerId)}</Text>
                  <View style={styles.metricsRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricLabel}>Friend gets</Text>
                      <Text style={styles.metricValue}>{r.friendDiscountPercent}% off</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricLabel}>Referrer gets</Text>
                      <Text style={styles.metricValue}>{r.referrerRewardPoints} pts</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <View style={styles.progressHead}>
                      <Text style={styles.metricLabel}>Uses</Text>
                      <Text style={styles.metricLabel}>
                        {r.uses}/{r.maxUses}
                      </Text>
                    </View>
                    <ProgressBar value={r.maxUses ? Math.min(1, r.uses / r.maxUses) : 0} />
                    <Text style={[styles.meta, { marginTop: 6 }]}>Expires {formatDate(r.expiresOn)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <Button
                      label="Copy"
                      size="sm"
                      variant="outline"
                      icon={(c) => <Copy size={12} color={c} />}
                      onPress={() => copyText(r.code).then((ok) => showToast(ok ? `${r.code} copied` : 'Copy is blocked by this browser'))}
                    />
                    {status !== 'Expired' ? (
                      <Button label={r.active ? 'Deactivate' : 'Activate'} size="sm" variant={r.active ? 'danger' : 'secondary'} onPress={() => setToggling(r)} />
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </Grid>
        )}
        <Pager controls={list} />
      </Section>

      {creating ? (
        <ReferralSheet
          rows={rows}
          onClose={() => setCreating(false)}
          onSave={(r) => {
            setRows([r, ...rows]);
            setCreating(false);
            showToast(`Referral code ${r.code} created`);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!toggling}
        title={toggling?.active ? `Deactivate ${toggling.code}?` : `Activate ${toggling?.code}?`}
        message={toggling?.active ? 'Friends can no longer use this code. Past referrals are kept.' : 'Friends can use this code again until it expires.'}
        confirmLabel={toggling?.active ? 'Deactivate' : 'Activate'}
        danger={toggling?.active}
        onCancel={() => setToggling(null)}
        onConfirm={() => {
          if (toggling) setRows(rows.map((r) => (r.id === toggling.id ? { ...r, active: !r.active } : r)));
          setToggling(null);
        }}
      />
    </View>
  );
}

function ReferralSheet({ rows, onClose, onSave }: { rows: ReferralCode[]; onClose: () => void; onSave: (r: ReferralCode) => void }) {
  const { customers, today } = useApp();
  const styles = useThemedStyles(makeStyles);
  const [customerId, setCustomerId] = useState('');
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('10');
  const [points, setPoints] = useState('300');
  const [maxUses, setMaxUses] = useState('10');
  const [expires, setExpires] = useState('2026-12-31');
  const [touched, setTouched] = useState(false);

  const normalized = code.trim().toUpperCase();
  const customerError = !customerId ? 'Choose the customer who shares this code' : undefined;
  const codeError = !/^[A-Z0-9-]{3,20}$/.test(normalized)
    ? '3–20 characters: letters, numbers and hyphens'
    : rows.some((r) => r.code === normalized)
      ? 'This code already exists'
      : undefined;
  const discountError = !/^\d{1,2}$/.test(discount.trim()) ? 'Enter a whole percentage from 0 to 99' : undefined;
  const pointsError = !/^\d{1,6}$/.test(points.trim()) ? 'Enter a whole number of points' : undefined;
  const usesError = !/^[1-9]\d{0,4}$/.test(maxUses.trim()) ? 'Enter at least 1' : undefined;
  const expiresError = !/^\d{4}-\d{2}-\d{2}$/.test(expires.trim()) ? 'Use YYYY-MM-DD' : daysBetween(today, expires.trim()) < 0 ? 'Expiry cannot be in the past' : undefined;

  const suggest = (id: string) => {
    setCustomerId(id);
    if (!code) {
      const first = customers.find((c) => c.id === id)?.firstName ?? '';
      setCode(`${first.toUpperCase().replace(/[^A-Z0-9]/g, '')}10`);
    }
  };

  const submit = () => {
    setTouched(true);
    if (customerError || codeError || discountError || pointsError || usesError || expiresError) return;
    onSave({
      id: `REF-${Date.now()}`,
      code: normalized,
      customerId,
      friendDiscountPercent: Number(discount),
      referrerRewardPoints: Number(points),
      uses: 0,
      maxUses: Number(maxUses),
      expiresOn: expires.trim(),
      active: true,
    });
  };

  return (
    <FormSheet
      visible
      title="New referral code"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Create code" onPress={submit} />
        </>
      }>
      <Text style={styles.label}>Customer</Text>
      <ChipGroup options={customers.map((c) => c.id)} value={customerId} labels={Object.fromEntries(customers.map((c) => [c.id, c.name]))} onChange={suggest} />
      {touched && customerError ? <Text style={[styles.meta, { marginTop: 6 }]}>{customerError}</Text> : null}
      <View style={{ height: 14 }} />
      <Field label="Code" required value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="e.g. ANANYA10" error={touched ? codeError : undefined} />
      <FormRow>
        <Field label="Friend discount %" required value={discount} onChangeText={setDiscount} keyboardType="number-pad" error={touched ? discountError : undefined} />
        <Field label="Referrer points" required value={points} onChangeText={setPoints} keyboardType="number-pad" error={touched ? pointsError : undefined} />
      </FormRow>
      <FormRow>
        <Field label="Maximum uses" required value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad" error={touched ? usesError : undefined} />
        <Field label="Expires on" required value={expires} onChangeText={setExpires} placeholder="YYYY-MM-DD" error={touched ? expiresError : undefined} />
      </FormRow>
    </FormSheet>
  );
}
