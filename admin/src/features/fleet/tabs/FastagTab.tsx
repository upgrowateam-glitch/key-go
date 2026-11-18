import { useRouter } from '@/shims/expo-router';
import { CreditCard, Plus, Tag, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, Column, DataTable, EmptyState, Field, FormSheet, Grid, SimulatedNote, StatTile } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate, formatINR } from '../../../lib/format';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { FASTagLog, Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { ListPager, usePaged } from '../ListPager';
import { num } from '../shared';

const LOW_FASTAG = 500;
const QUICK_RECHARGE = ['500', '1000', '2000', '5000'] as const;
type QuickRecharge = (typeof QUICK_RECHARGE)[number];

export function FastagTab({ v }: { v: Vehicle }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const router = useRouter();
  const { fastagLogs, rechargeFastag } = useApp();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1000');
  const [error, setError] = useState<string>();

  const logs = fastagLogs.filter((l) => l.vehicleNumber === v.vehicleNumber);
  const totalTolls = logs.reduce((s, l) => s + l.amount, 0);
  const unbilled = logs.filter((l) => l.bookingId && !l.billedToCustomer).reduce((s, l) => s + l.amount, 0);
  const low = v.fastagBalance < LOW_FASTAG;
  const isSold = v.status === 'Sold';
  const paged = usePaged(logs);

  const submit = () => {
    const a = num(amount);
    if (!(a >= 100)) {
      setError('Minimum recharge is ₹100');
      return;
    }
    if (a > 100000) {
      setError('Maximum recharge is ₹1,00,000');
      return;
    }
    rechargeFastag(v.id, Math.round(a));
    setOpen(false);
    setError(undefined);
  };

  const columns: Column<FASTagLog>[] = [
    { key: 'dateTime', label: 'Date & time', flex: 1.2, minWidth: 150, value: (l) => `${formatDate(l.dateTime.slice(0, 10), false)} ${l.dateTime.slice(11)}` },
    { key: 'plaza', label: 'Toll plaza', flex: 2, minWidth: 200, value: (l) => l.plazaName },
    {
      key: 'booking',
      label: 'Booking',
      flex: 1,
      minWidth: 110,
      render: (l) =>
        l.bookingId ? (
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => router.push(`/bookings/${encodeURIComponent(l.bookingId!)}` as any)}>
            {l.bookingId}
          </Text>
        ) : (
          <Text style={styles.muted}>—</Text>
        ),
    },
    { key: 'amount', label: 'Amount', flex: 0.8, minWidth: 90, align: 'right', value: (l) => formatINR(l.amount) },
    {
      key: 'billed',
      label: 'Billing',
      flex: 1,
      minWidth: 110,
      render: (l) => (l.bookingId ? <Badge label={l.billedToCustomer ? 'Billed' : 'Unbilled'} tone={l.billedToCustomer ? 'success' : 'warning'} /> : <Badge label="Company" tone="neutral" />),
    },
  ];

  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label="FASTag balance" value={formatINR(v.fastagBalance)} tone={low ? 'danger' : 'success'} hint={low ? 'Low balance' : 'Healthy'} icon={(c) => <Wallet size={16} color={c} />} />
        <StatTile label="Tag ID" value={v.fastagId} tone="neutral" icon={(c) => <Tag size={16} color={c} />} />
        <StatTile label="Tolls recorded" value={formatINR(totalTolls)} tone="info" hint={`${logs.length} entries`} />
        <StatTile label="Unbilled to customers" value={formatINR(unbilled)} tone={unbilled ? 'warning' : 'neutral'} />
      </Grid>
      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <View style={styles.iconBox}>
            <CreditCard size={18} color={colors.primaryText} />
          </View>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={styles.cardTitle}>Recharge FASTag</Text>
            <Text style={styles.hint}>{low ? `Balance is below ${formatINR(LOW_FASTAG)} — recharge before the next trip.` : 'Top up the tag linked to this vehicle.'}</Text>
          </View>
          {low && !isSold ? <Badge label="Low balance" tone="danger" /> : null}
          <Button label="Recharge" disabled={isSold} onPress={() => setOpen(true)} icon={(c) => <Plus size={14} color={c} />} />
        </View>
      </Card>
      <DataTable
        columns={columns}
        rows={paged.rows}
        rowKey={(l) => l.id}
        empty={<EmptyState compact title="No toll entries" message="Toll deductions for this vehicle will appear here." />}
      />
      <ListPager paged={paged} />
      <SimulatedNote>Toll entries are sample data. Live FASTag data will come from the bank/NETC API later.</SimulatedNote>

      <FormSheet
        visible={open}
        title={`Recharge ${v.fastagId}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} />
            <Button label="Recharge" onPress={submit} />
          </>
        }>
        <Text style={styles.hint}>
          {v.name} · {v.vehicleNumber} · current balance {formatINR(v.fastagBalance)}
        </Text>
        <View style={{ marginVertical: 12 }}>
          <ChipGroup options={QUICK_RECHARGE} value={amount as QuickRecharge} onChange={(a) => { setAmount(a); setError(undefined); }} labels={{ '500': '₹500', '1000': '₹1,000', '2000': '₹2,000', '5000': '₹5,000' }} />
        </View>
        <Field label="Amount (₹)" required value={amount} onChangeText={(t) => { setAmount(t); setError(undefined); }} keyboardType="number-pad" error={error} />
        <SimulatedNote>No payment is made. The balance is updated locally for the demo.</SimulatedNote>
      </FormSheet>
    </View>
  );
}
