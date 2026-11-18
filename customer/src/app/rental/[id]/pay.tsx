import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';
import { Button, Card, ChipGroup, EmptyState, Field, PageHeader, Screen, Section, SimulatedNote } from '../../../components/kit';
import { amountDue } from '../../../lib/payments';
import { formatINR } from '../../../lib/format';
import { useThemeColors } from '../../../theme';

const METHODS = ['UPI', 'Card', 'Net banking', 'Wallet'] as const;
const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak'] as const;
const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'Mobikwik'] as const;

export default function PaymentScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = decodeURIComponent(id ?? '');
  const { bookings, currentCustomerId, payBooking, showToast } = useApp();
  const booking = bookings.find((b) => b.id === bookingId && b.customerId === currentCustomerId);

  const [method, setMethod] = useState<(typeof METHODS)[number]>('UPI');
  const [upi, setUpi] = useState('');
  const [card, setCard] = useState('');
  const [bank, setBank] = useState<(typeof BANKS)[number]>('HDFC');
  const [wallet, setWallet] = useState<(typeof WALLETS)[number]>('Paytm');
  const [tried, setTried] = useState(false);

  if (!booking) {
    return (
      <Screen>
        <PageHeader title="Payment" back />
        <EmptyState title="We couldn't find this booking" />
      </Screen>
    );
  }

  const due = amountDue(booking);
  if (due === 0) {
    return (
      <Screen>
        <PageHeader title="Payment" subtitle={`Booking ${booking.id}`} back />
        <EmptyState title="Nothing to pay" message="This booking has no payment due." icon={(c) => <CheckCircle2 size={22} color={c} />} />
      </Screen>
    );
  }

  const error =
    method === 'UPI' && !/^\S+@\S+$/.test(upi.trim())
      ? 'Enter a valid UPI ID, like name@okhdfcbank'
      : method === 'Card' && card.replace(/\s/g, '').length !== 16
        ? 'Enter the 16-digit card number'
        : undefined;

  const pay = () => {
    setTried(true);
    if (error) return;
    payBooking(booking.id);
    showToast(`Payment of ${formatINR(due)} simulated. No money was charged.`);
    router.back();
  };

  return (
    <Screen maxWidth={640}>
      <PageHeader eyebrow="Online payment" title={`Pay ${formatINR(due)}`} subtitle={`${booking.paymentStatus === 'Unpaid' ? 'Refundable deposit' : 'Rental balance'} · Booking ${booking.id}`} back />
      <Section title="Payment method">
        <ChipGroup options={METHODS} value={method} onChange={setMethod} />
      </Section>
      <Card style={{ marginTop: 12 }}>
        {method === 'UPI' ? <Field label="UPI ID" value={upi} onChangeText={setUpi} placeholder="name@okhdfcbank" required error={tried ? error : undefined} /> : null}
        {method === 'Card' ? <Field label="Card number" value={card} onChangeText={setCard} keyboardType="numeric" required error={tried ? error : undefined} /> : null}
        {method === 'Net banking' ? <ChipGroup options={BANKS} value={bank} onChange={setBank} /> : null}
        {method === 'Wallet' ? <ChipGroup options={WALLETS} value={wallet} onChange={setWallet} /> : null}
        <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 10 }}>You will see a confirmation once the payment is recorded.</Text>
        <Button label={`Pay ${formatINR(due)}`} size="lg" fullWidth onPress={pay} />
      </Card>
      <SimulatedNote>Payment gateway integration is pending. Nothing you enter here is charged or stored.</SimulatedNote>
    </Screen>
  );
}
