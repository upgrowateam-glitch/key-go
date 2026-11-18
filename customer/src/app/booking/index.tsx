import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Calendar, CheckCircle2, Clock, CreditCard, Landmark, MapPin, QrCode, ShieldCheck, Smartphone, Wallet } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  ChipGroup,
  Divider,
  DocumentSlot,
  Field,
  FormRow,
  PageHeader,
  Screen,
  Section,
  SegmentedControl,
  SimulatedNote,
  SplitView,
  Stepper,
  VehiclePhoto,
  VEHICLE_PHOTO_ASPECT,
} from '../../components/kit';
import { Booking, RentalPurpose, RentalTerm, VerificationStatus } from '../../types';
import { findConflicts } from '../../lib/availability';
import { computeQuote, PRICING_RULES, termForDays } from '../../lib/pricing';
import { addDays, daysBetween, formatDate, formatINR, parseISODate } from '../../lib/format';

const STEPS = [
  { key: 'trip', label: 'Trip details' },
  { key: 'quote', label: 'Quote' },
  { key: 'docs', label: 'Documents' },
  { key: 'pay', label: 'Payment' },
] as const;

const PURPOSES: RentalPurpose[] = ['Personal', 'Business', 'Outstation', 'Vacation'];
const TERMS: RentalTerm[] = ['Daily', 'Weekly', 'Monthly'];
const PAY_METHODS = ['UPI', 'Card', 'Net banking', 'Wallet'] as const;

export default function BookingFlowScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPhone } = useResponsive();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const { vehicles, bookings, customers, currentCustomerId, bookingDraft, setBookingDraft, createQuote, confirmBooking, showToast } = useApp();

  const bookable = vehicles.filter((v) => v.status === 'Available');
  const [vehicleId, setVehicleId] = useState(params.vehicleId ?? bookable[0]?.id ?? vehicles[0].id);
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
  const customer = customers.find((c) => c.id === currentCustomerId);

  const [step, setStep] = useState(0);
  const [termOverride, setTermOverride] = useState<RentalTerm | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [done, setDone] = useState(false);
  const [triedNext, setTriedNext] = useState(false);
  const [docs, setDocs] = useState<Record<string, VerificationStatus>>({
    dl: customer?.documents.some((d) => d.kind === 'Driving licence' && d.status === 'Verified') ? 'Verified' : 'Not uploaded',
    id: customer?.idCardStatus ?? 'Not uploaded',
    face: customer?.faceVerification ?? 'Not uploaded',
  });
  const [payMethod, setPayMethod] = useState<(typeof PAY_METHODS)[number]>('UPI');
  const [upi, setUpi] = useState('');

  const d = bookingDraft;
  const days = Math.max(0, daysBetween(d.pickupDate, d.returnDate));
  const term = termOverride ?? termForDays(days);
  const quote = useMemo(() => computeQuote(vehicle, Math.max(1, days), term), [vehicle, days, term]);

  const conflicts = days > 0 ? findConflicts(bookings, vehicle.id, d) : [];

  const errors = {
    pickupLocation: d.pickupLocation.trim() ? undefined : 'Enter a pickup location',
    pickupDate: parseISODate(d.pickupDate) ? undefined : 'Use YYYY-MM-DD',
    returnDate: !parseISODate(d.returnDate) ? 'Use YYYY-MM-DD' : days < 1 ? 'Return must be after pickup' : undefined,
    term: days && days < PRICING_RULES.minDays[term] ? `${term} needs at least ${PRICING_RULES.minDays[term]} days` : undefined,
    vehicle: vehicle.status !== 'Available' ? 'Vehicle unavailable' : conflicts.length ? 'Already booked for these dates' : undefined,
  };
  const tripValid = !Object.values(errors).some(Boolean);
  const docsValid = docs.dl !== 'Not uploaded' && docs.id !== 'Not uploaded';

  // Editing the trip after a quote was generated invalidates that quote; a new one is created on the next step
  const set = (patch: Partial<typeof d>) => {
    setBookingDraft((prev) => ({ ...prev, ...patch }));
    setBooking(null);
  };

  const next = () => {
    setTriedNext(true);
    if (step === 0 && !tripValid) return;
    if (step === 1 && !booking) {
      // Generating the quote creates the booking in the "Quoted" state
      const b = createQuote({
        vehicleId: vehicle.id,
        customerId: currentCustomerId,
        pickupLocation: d.pickupLocation,
        pickupDate: d.pickupDate,
        pickupTime: d.pickupTime,
        returnDate: d.returnDate,
        returnTime: d.returnTime,
        term,
        purpose: d.purpose,
        classification: 'Online',
      });
      setBooking(b);
    }
    if (step === 2 && !docsValid) return;
    if (step === 3) {
      if (booking) confirmBooking(booking.id);
      showToast('Payment simulated — no money was charged');
      setDone(true);
      return;
    }
    setTriedNext(false);
    setStep((s) => s + 1);
  };

  const back = () => (step > 0 && !done ? setStep((s) => s - 1) : router.back());

  const simulateDoc = (key: string, label: string) => {
    setDocs((prev) => ({ ...prev, [key]: 'Pending' }));
    showToast(`${label} captured (simulated) · verification pending`);
    setTimeout(() => setDocs((prev) => ({ ...prev, [key]: 'Verified' })), 1500);
  };

  // ------------------------------------------------ Confirmation
  if (done && booking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <Screen maxWidth={640}>
          <View style={styles.confirmIcon}>
            <CheckCircle2 size={40} color={colors.onPrimary} />
          </View>
          <Text style={styles.confirmTitle}>Booking confirmed</Text>
          <Text style={styles.confirmSub}>We&apos;ll deliver {vehicle.name} to {d.pickupLocation}.</Text>

          <Card style={{ marginTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardTitle}>{booking.id}</Text>
              <Badge label="Confirmed" tone="success" />
            </View>
            <Text style={styles.muted}>
              {formatDate(d.pickupDate)} {d.pickupTime} → {formatDate(d.returnDate)} {d.returnTime}
            </Text>
            <Divider />
            <Line label="Paid now (deposit)" value={formatINR(quote.deposit)} />
            <Line label="Rental total" value={formatINR(quote.total)} strong />
            <View style={styles.reminderChip}>
              <Bell size={14} color={colors.warmText} />
              <Text style={styles.reminderText}>Pickup reminder scheduled for {formatDate(addDays(d.pickupDate, -2), false)} (2 days before)</Text>
            </View>
            <View style={styles.qr}>
              <QrCode size={96} color={colors.primaryText} />
              <Text style={styles.muted}>Scan at pickup for keyless handover</Text>
            </View>
          </Card>

          <Section title="Next steps">
            <Card>
              <Text style={styles.muted}>Sign your rental agreement now to speed up the handover.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                <Button label="Review & sign agreement" onPress={() => router.replace(`/rental/${encodeURIComponent(booking.id)}/agreement` as any)} />
                <Button label="Go to My Bookings" variant="outline" onPress={() => router.replace('/(tabs)/bookings' as any)} />
              </View>
            </Card>
          </Section>
        </Screen>
      </View>
    );
  }

  // ------------------------------------------------ Steps
  const summary = (
    <Card>
      <VehiclePhoto source={vehicle.imageAsset} style={styles.carImage} accessibilityLabel={`${vehicle.brand ?? ''} ${vehicle.name}`.trim()} />
      <Text style={styles.cardTitle}>{vehicle.name}</Text>
      <Text style={styles.muted}>
        {vehicle.type} · {vehicle.seats} seats · {vehicle.transmission} · {vehicle.fuel}
      </Text>
      <Divider />
      <Line label={`${formatINR(quote.ratePerDay)} × ${quote.days} day${quote.days > 1 ? 's' : ''}`} value={formatINR(quote.base)} />
      {quote.termDiscount ? <Line label={`${term} discount`} value={`− ${formatINR(quote.termDiscount)}`} /> : null}
      <Line label="GST (18%)" value={formatINR(quote.tax)} />
      <Line label="Total" value={formatINR(quote.total)} strong />
      <Line label="Refundable deposit" value={formatINR(quote.deposit)} />
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Screen
        footer={
          <View style={{ paddingBottom: Math.max(insets.bottom, 0) }}>
            <ActionBar>
              <View style={{ flex: 1 }}>
                <Text style={styles.muted}>Total ({quote.days} day{quote.days > 1 ? 's' : ''})</Text>
                <Text style={styles.footerTotal}>{formatINR(quote.total)}</Text>
              </View>
              {!isPhone ? <Button label="Back" variant="ghost" onPress={back} /> : null}
              <Button
                label={step === 1 ? (booking ? 'Continue' : 'Accept quote') : step === 3 ? `Pay ${formatINR(quote.deposit)} deposit` : 'Continue'}
                size="lg"
                onPress={next}
              />
            </ActionBar>
          </View>
        }>
        <PageHeader eyebrow={`Step ${step + 1} of ${STEPS.length}`} title="Book your car" subtitle={vehicle.name} back={back} />
        <Stepper steps={STEPS} current={step} />

        <SplitView
          sideWidth={360}
          main={
            <View>
              {step === 0 && (
                <>
                  <Section title="Vehicle">
                    <ChipGroup
                      scroll
                      options={bookable.map((v) => v.id)}
                      labels={Object.fromEntries(bookable.map((v) => [v.id, `${v.name} · ${formatINR(v.pricePerDay)}`]))}
                      value={vehicleId}
                      onChange={(id) => {
                        setVehicleId(id);
                        setBooking(null);
                      }}
                    />
                    {vehicle.status !== 'Available' ? <Text style={styles.error}>{vehicle.name} is currently {vehicle.status.toLowerCase()} — pick another vehicle.</Text> : null}
                    {conflicts.length ? <Text style={styles.error}>{vehicle.name} is already booked from {formatDate(conflicts[0].pickupDate, false)} to {formatDate(conflicts[0].returnDate, false)}. Change your dates or pick another vehicle.</Text> : null}
                  </Section>
                  <Section title="Pickup & return">
                    <Card>
                      <Field
                        label="Pickup location"
                        value={d.pickupLocation}
                        onChangeText={(t) => set({ pickupLocation: t })}
                        required
                        left={<MapPin size={16} color={colors.primaryText} />}
                        error={triedNext ? errors.pickupLocation : undefined}
                      />
                      <FormRow>
                        <Field label="Pickup date" value={d.pickupDate} onChangeText={(t) => set({ pickupDate: t })} placeholder="YYYY-MM-DD" left={<Calendar size={16} color={colors.primaryText} />} error={triedNext ? errors.pickupDate : undefined} />
                        <Field label="Pickup time" value={d.pickupTime} onChangeText={(t) => set({ pickupTime: t })} placeholder="10:00 AM" left={<Clock size={16} color={colors.primaryText} />} />
                      </FormRow>
                      <FormRow>
                        <Field label="Return date" value={d.returnDate} onChangeText={(t) => set({ returnDate: t })} placeholder="YYYY-MM-DD" left={<Calendar size={16} color={colors.primaryText} />} error={triedNext ? errors.returnDate : undefined} />
                        <Field label="Return time" value={d.returnTime} onChangeText={(t) => set({ returnTime: t })} placeholder="06:00 PM" left={<Clock size={16} color={colors.primaryText} />} />
                      </FormRow>
                    </Card>
                  </Section>
                  <Section title="Rental plan" subtitle={`${days || 0} day trip · weekly saves 10%, monthly saves 25% (sample rates)`}>
                    <SegmentedControl options={TERMS} value={term} onChange={(t) => {
                      setTermOverride(t);
                      setBooking(null);
                    }} />
                    {triedNext && errors.term ? <Text style={styles.error}>{errors.term}</Text> : null}
                  </Section>
                  <Section title="Purpose of rental">
                    <ChipGroup options={PURPOSES} value={d.purpose} onChange={(p) => set({ purpose: p })} />
                  </Section>
                </>
              )}

              {step === 1 && (
                <Section title="Your quote" subtitle="All-inclusive — insurance, delivery and unlimited km included">
                  <Card>
                    <Line label="Vehicle category" value={vehicle.type} />
                    <Line label="Pickup" value={`${formatDate(d.pickupDate)} · ${d.pickupTime}`} />
                    <Line label="Return" value={`${formatDate(d.returnDate)} · ${d.returnTime}`} />
                    <Line label="Plan · purpose" value={`${term} · ${d.purpose}`} />
                    <Divider />
                    <Line label={`Base (${formatINR(quote.ratePerDay)} × ${quote.days} days)`} value={formatINR(quote.base)} />
                    <Line label={`${term} plan discount`} value={quote.termDiscount ? `− ${formatINR(quote.termDiscount)}` : '—'} />
                    <Line label="Zero-liability insurance" value="Included" />
                    <Line label="Doorstep delivery" value="Included" />
                    <Line label="GST (18%)" value={formatINR(quote.tax)} />
                    <Divider />
                    <Line label="Trip total" value={formatINR(quote.total)} strong />
                    <View style={styles.depositBox}>
                      <ShieldCheck size={16} color={colors.primaryText} />
                      <Text style={[styles.muted, { flex: 1 }]}>Refundable security deposit {formatINR(quote.deposit)} — returned within 48 hours of drop-off.</Text>
                    </View>
                    {booking ? <Badge label={`Quote ${booking.id} saved`} tone="info" /> : null}
                  </Card>
                </Section>
              )}

              {step === 2 && (
                <Section title="Documents & identity" subtitle="Upload once — reused for future trips">
                  <Card>
                    <DocumentSlot title="Driving licence" subtitle={customer ? `${customer.dlNumber} · ${customer.dlState}` : undefined} status={docs.dl} onUpload={() => simulateDoc('dl', 'Driving licence')} onScan={() => simulateDoc('dl', 'Driving licence')} />
                    <DocumentSlot title="Government ID (Aadhaar / passport)" subtitle={customer?.aadhaarNo} status={docs.id} onUpload={() => simulateDoc('id', 'ID card')} onScan={() => simulateDoc('id', 'ID card')} />
                    <DocumentSlot title="Face verification" subtitle="Quick selfie match with your ID" status={docs.face} onScan={() => simulateDoc('face', 'Selfie')} />
                    {triedNext && !docsValid ? <Text style={styles.error}>Upload your driving licence and ID to continue.</Text> : null}
                    <SimulatedNote>Document scanning and face verification are placeholders — nothing leaves your device.</SimulatedNote>
                  </Card>
                </Section>
              )}

              {step === 3 && (
                <Section title="Payment" subtitle={`Pay the ${formatINR(quote.deposit)} refundable deposit now; the rental amount is charged at pickup.`}>
                  <Card>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {PAY_METHODS.map((m) => {
                        const active = m === payMethod;
                        const Icon = m === 'UPI' ? Smartphone : m === 'Card' ? CreditCard : m === 'Net banking' ? Landmark : Wallet;
                        return (
                          <TouchableOpacity
                            key={m}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            onPress={() => setPayMethod(m)}
                            style={[styles.payMethod, active && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
                            <Icon size={18} color={active ? colors.primaryText : colors.muted} />
                            <Text style={[styles.payLabel, active && { color: colors.primaryText }]}>{m}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={{ marginTop: 16 }}>
                      {payMethod === 'UPI' ? <Field label="UPI ID" value={upi} onChangeText={setUpi} /> : null}
                      {payMethod === 'Card' ? (
                        <>
                          <Field label="Card number" value="4111 1111 1111 1111" editable={false} />
                          <FormRow>
                            <Field label="Expiry" value="12/29" editable={false} />
                            <Field label="CVV" value="•••" editable={false} />
                          </FormRow>
                        </>
                      ) : null}
                      {payMethod === 'Net banking' ? <ChipGroup options={['HDFC', 'ICICI', 'SBI', 'Axis'] as const} value="HDFC" onChange={() => undefined} /> : null}
                      {payMethod === 'Wallet' ? <ChipGroup options={['Paytm', 'PhonePe', 'Amazon Pay'] as const} value="Paytm" onChange={() => undefined} /> : null}
                    </View>
                    <SimulatedNote>Online payment is a UI placeholder — no payment gateway is connected and no money is charged.</SimulatedNote>
                  </Card>
                </Section>
              )}
            </View>
          }
          side={<Section title="Summary">{summary}</Section>}
        />
      </Screen>
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && styles.lineStrong]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.lineStrong]}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cardTitle: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
    },
    muted: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
    },
    carImage: {
      width: '100%',
      aspectRatio: VEHICLE_PHOTO_ASPECT,
      marginBottom: 8,
    },
    line: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 5,
    },
    lineLabel: {
      color: colors.muted,
      fontSize: 13,
      flexShrink: 1,
    },
    lineValue: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'right',
    },
    lineStrong: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
    },
    depositBox: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 10,
      padding: 12,
      marginVertical: 12,
    },
    footerTotal: {
      color: colors.txt,
      fontSize: 20,
      fontWeight: '800',
    },
    payMethod: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      backgroundColor: colors.card,
      minWidth: 130,
    },
    payLabel: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    confirmIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: 24,
    },
    confirmTitle: {
      color: colors.txt,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: 14,
    },
    confirmSub: {
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 4,
    },
    reminderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.highlightSoft,
      borderRadius: 10,
      padding: 10,
      marginTop: 12,
    },
    reminderText: {
      color: colors.onHighlight,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    qr: {
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
    },
  });
