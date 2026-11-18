import { useRouter } from '@/shims/expo-router';
import { CreditCard, IndianRupee, RotateCcw, Wallet } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge, ChipGroup, Column, DataTable, EmptyState, Grid, SimulatedNote, StatTile, Tone } from '../../../components/kit';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate, formatINR } from '../../../lib/format';
import type { Booking } from '../../../types';
import { ListPager, usePaged } from '../../fleet/ListPager';

const KINDS = ['Deposit', 'Rental', 'Charges', 'Refund'] as const;
type Kind = (typeof KINDS)[number];
const KIND_FILTERS = ['All', ...KINDS] as const;
const KIND_TONE: Record<Kind, Tone> = { Deposit: 'info', Rental: 'success', Charges: 'warning', Refund: 'violet' };

interface PaymentRow {
  id: string;
  bookingId: string;
  date: string;
  kind: Kind;
  description: string;
  amount: number;
}

const chargesOf = (b: Booking) => (b.fuelCharges ?? 0) + (b.tollCharges ?? 0) + (b.fineCharges ?? 0) + (b.damageCharges ?? 0);

/** The ledger is worked out from each booking's payment status until payments have their own API. */
function ledgerFor(b: Booking): PaymentRow[] {
  const rows: PaymentRow[] = [];
  const add = (kind: Kind, date: string, description: string, amount: number) => rows.push({ id: `${b.id}-${kind}`, bookingId: b.id, date, kind, description, amount });
  if (b.status === 'Cancelled' || b.paymentStatus === 'Unpaid') return rows;
  add('Deposit', b.createdAt, 'Security deposit collected', b.depositAmount);
  if (b.paymentStatus === 'Paid' || b.paymentStatus === 'Refunded') add('Rental', b.pickupDate, `Rental for ${b.vehicleName}`, b.totalAmount);
  if (b.paymentStatus === 'Refunded') {
    const settled = b.completedAt ?? b.returnDate;
    const charges = chargesOf(b);
    if (charges) add('Charges', settled, 'Fuel, tolls, fines and damage kept from deposit', charges);
    add('Refund', settled, 'Deposit returned after settlement', -Math.max(0, b.depositAmount - charges));
  }
  return rows;
}

const COLUMNS: Column<PaymentRow>[] = [
  { key: 'date', label: 'Date', flex: 0.8, minWidth: 100, value: (r) => formatDate(r.date) },
  { key: 'booking', label: 'Booking', flex: 0.7, minWidth: 90, value: (r) => r.bookingId },
  { key: 'kind', label: 'Type', flex: 0.7, minWidth: 90, render: (r) => <Badge label={r.kind} tone={KIND_TONE[r.kind]} /> },
  { key: 'description', label: 'Description', flex: 2, minWidth: 220, value: (r) => r.description },
  { key: 'amount', label: 'Amount', flex: 0.8, minWidth: 100, align: 'right', value: (r) => formatINR(r.amount) },
];

export function PaymentsTab({ history }: { history: Booking[] }) {
  const router = useRouter();
  const { cols } = useResponsive();
  const [kind, setKind] = useState<(typeof KIND_FILTERS)[number]>('All');

  const ledger = useMemo(() => history.flatMap(ledgerFor).sort((a, b) => (a.date < b.date ? 1 : -1)), [history]);
  const paged = usePaged(ledger.filter((r) => kind === 'All' || r.kind === kind));
  const sum = (k: Kind) => ledger.filter((r) => r.kind === k).reduce((s, r) => s + r.amount, 0);
  const outstanding = history.filter((b) => b.status === 'Confirmed' || b.status === 'Active').filter((b) => b.paymentStatus !== 'Paid').reduce((s, b) => s + b.totalAmount, 0);
  const depositsHeld = history.filter((b) => b.paymentStatus === 'Deposit paid' || (b.paymentStatus === 'Paid' && b.status !== 'Cancelled')).reduce((s, b) => s + b.depositAmount, 0);

  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label="Rental collected" value={formatINR(sum('Rental'))} tone="success" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Outstanding" value={formatINR(outstanding)} tone={outstanding ? 'warning' : 'neutral'} hint="Confirmed & active rentals" icon={(c) => <CreditCard size={16} color={c} />} />
        <StatTile label="Deposits held" value={formatINR(depositsHeld)} tone="info" icon={(c) => <Wallet size={16} color={c} />} />
        <StatTile label="Refunded" value={formatINR(Math.abs(sum('Refund')))} tone="violet" icon={(c) => <RotateCcw size={16} color={c} />} />
      </Grid>
      <View style={{ marginBottom: 10 }}>
        <ChipGroup options={KIND_FILTERS} value={kind} onChange={setKind} scroll />
      </View>
      <DataTable
        columns={COLUMNS}
        rows={paged.rows}
        rowKey={(r) => r.id}
        onRowPress={(r) => router.push(`/bookings/${encodeURIComponent(r.bookingId)}` as any)}
        empty={<EmptyState compact title={ledger.length ? 'No payments of this type' : 'No payments yet'} message="Payments appear once a booking is confirmed." icon={(c) => <CreditCard size={22} color={c} />} />}
      />
      <ListPager paged={paged} />
      <SimulatedNote>Worked out from each booking's payment status. Payment gateway integration is pending, so no real transaction is shown.</SimulatedNote>
    </View>
  );
}
