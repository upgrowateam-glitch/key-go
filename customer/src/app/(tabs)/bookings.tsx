import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Unlock,
  Lock,
  PhoneCall,
  CalendarPlus,
  MapPin,
  FileText,
  CreditCard,
  Clock,
  Gauge,
  Bell,
  Receipt,
  Car,
  CalendarClock,
  History,
  LifeBuoy,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import {
  Screen,
  PageHeader,
  Card,
  Section,
  Grid,
  Button,
  Badge,
  StatusBadge,
  Stepper,
  ProgressBar,
  GpsMapPlaceholder,
  FormSheet,
  Field,
  FormRow,
  ChipGroup,
  SegmentedControl,
  SimulatedNote,
  EmptyState,
  Divider,
  VehiclePhoto,
} from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { RENTAL_STEPS, currentStepIndex, elapsedDays, isOverdue, reminderState } from '../../lib/lifecycle';
import { addDays, daysBetween, formatDate, formatINR, formatKm } from '../../lib/format';
import { Booking, Vehicle } from '../../types';
import { extensionLabel, extensionSummary, quoteExtension, requestExtension, type ExtensionQuote, type ExtensionUnit } from '../../lib/extensions';


const TRIP_ROUTE = [
  { x: 0.08, y: 0.82 },
  { x: 0.2, y: 0.7 },
  { x: 0.34, y: 0.72 },
  { x: 0.42, y: 0.5 },
  { x: 0.56, y: 0.44 },
  { x: 0.66, y: 0.3 },
];

const PAY_METHODS = ['UPI', 'Card', 'Net banking', 'Wallet'] as const;
type PayMethod = (typeof PAY_METHODS)[number];
const BANKS = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Kotak'] as const;
const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'Mobikwik'] as const;
const EXTEND_UNITS = ['Hours', 'Days'] as const;
const EXTEND_MAX = { hours: 23, days: 60 } as const;
const ROADSIDE_ISSUES = ['Flat tyre', 'Battery / won’t start', 'Accident', 'Locked out', 'Other'] as const;
type RoadsideIssue = (typeof ROADSIDE_ISSUES)[number];

type Sheet =
  | { kind: 'extend'; booking: Booking }
  | { kind: 'roadside'; booking: Booking }
  | { kind: 'pay'; booking: Booking }
  | { kind: 'receipt'; booking: Booking }
  | null;

export default function MyBookingsScreen() {
  const router = useRouter();
  const { isDesktop, cols } = useResponsive();
  const { bookings, vehicles, customers, currentCustomerId, today } = useApp();

  const [sheet, setSheet] = useState<Sheet>(null);
  // Simulated payments & extension balances (no backend yet)
  const [paidLocal, setPaidLocal] = useState<Record<string, number>>({});

  const me = customers.find((c) => c.id === currentCustomerId);
  const mine = useMemo(() => bookings.filter((b) => b.customerId === currentCustomerId), [bookings, currentCustomerId]);
  const active = mine.filter((b) => b.status === 'Active');
  const upcoming = mine
    .filter((b) => b.status === 'Confirmed' || b.status === 'Quoted' || b.status === 'Pending')
    .sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  const past = mine
    .filter((b) => b.status === 'Completed' || b.status === 'Cancelled')
    .sort((a, b) => b.pickupDate.localeCompare(a.pickupDate));

  const vehicleOf = (b: Booking) => vehicles.find((v) => v.id === b.vehicleId);

  const amountDue = (b: Booking) => {
    const base = b.paymentStatus === 'Unpaid' ? b.totalAmount + b.depositAmount : b.paymentStatus === 'Deposit paid' ? b.totalAmount : 0;
    return Math.max(0, base - (paidLocal[b.id] ?? 0));
  };
  const amountPaid = (b: Booking) => {
    const base = b.paymentStatus === 'Paid' ? b.totalAmount + b.depositAmount : b.paymentStatus === 'Deposit paid' ? b.depositAmount : 0;
    return base + (paidLocal[b.id] ?? 0);
  };

  return (
    <Screen bottomInset={64}>
      <PageHeader
        eyebrow="My bookings"
        title={me ? `Hi, ${me.firstName}` : 'My bookings'}
        subtitle={`${active.length} active · ${upcoming.length} upcoming · ${past.length} past`}
        actions={<Button label="Book a car" size="sm" onPress={() => router.push('/(tabs)/explore' as any)} icon={(c) => <Car size={14} color={c} />} />}
      />

      {/* ---------- Active trip ---------- */}
      <Section title="Active trip" subtitle="Your car, keys and trip at a glance">
        {active.length === 0 ? (
          <Card>
            <EmptyState
              title="No active trip"
              message="When your rental starts, keyless unlock, trip view and extensions appear here."
              icon={(c) => <Car size={22} color={c} />}
              action={<Button label="Browse cars" onPress={() => router.push('/(tabs)/explore' as any)} />}
            />
          </Card>
        ) : (
          active.map((b) => (
            <ActiveTripCard
              key={b.id}
              booking={b}
              vehicle={vehicleOf(b)}
              today={today}
              due={amountDue(b)}
              onExtend={() => setSheet({ kind: 'extend', booking: b })}
              onRoadside={() => setSheet({ kind: 'roadside', booking: b })}
              onPay={() => setSheet({ kind: 'pay', booking: b })}
            />
          ))
        )}
      </Section>

      {/* ---------- Upcoming & past ---------- */}
      <View style={isDesktop ? { flexDirection: 'row', gap: 24, alignItems: 'flex-start' } : undefined}>
        <View style={isDesktop ? { flex: 1 } : undefined}>
          <Section title="Upcoming" subtitle="Confirmed bookings and quotes">
            {upcoming.length === 0 ? (
              <Card>
                <EmptyState
                  compact
                  title="No upcoming bookings"
                  message="Plan your next drive — pickup reminders are sent 2 days before."
                  icon={(c) => <CalendarClock size={22} color={c} />}
                />
              </Card>
            ) : (
              <Grid cols={isDesktop ? 1 : cols(1, 2, 1)} gap={12}>
                {upcoming.map((b) => (
                  <UpcomingCard key={b.id} booking={b} vehicle={vehicleOf(b)} today={today} due={amountDue(b)} onPay={() => setSheet({ kind: 'pay', booking: b })} />
                ))}
              </Grid>
            )}
          </Section>
        </View>
        <View style={isDesktop ? { flex: 1 } : undefined}>
          <Section title="Past trips" subtitle="Receipts and deposit refunds">
            {past.length === 0 ? (
              <Card>
                <EmptyState compact title="No past trips yet" message="Completed rentals and receipts will show up here." icon={(c) => <History size={22} color={c} />} />
              </Card>
            ) : (
              <Card padded={false}>
                {past.map((b, i) => (
                  <PastTripRow key={b.id} booking={b} vehicle={vehicleOf(b)} first={i === 0} onReceipt={() => setSheet({ kind: 'receipt', booking: b })} />
                ))}
              </Card>
            )}
          </Section>
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <SimulatedNote>Keyless unlock, GPS trip view, roadside requests and payments are simulated in this preview. Nothing is charged or dispatched.</SimulatedNote>
      </View>

      {sheet?.kind === 'extend' ? (
        <ExtendSheet booking={sheet.booking} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === 'roadside' ? <RoadsideSheet booking={sheet.booking} vehicle={vehicleOf(sheet.booking)} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'pay' ? (
        <PaymentSheet
          booking={sheet.booking}
          due={amountDue(sheet.booking)}
          paid={amountPaid(sheet.booking)}
          onClose={() => setSheet(null)}
          onPaid={(amt) => setPaidLocal((prev) => ({ ...prev, [sheet.booking.id]: (prev[sheet.booking.id] ?? 0) + amt }))}
        />
      ) : null}
      {sheet?.kind === 'receipt' ? <ReceiptSheet booking={sheet.booking} onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}

// ------------------------------------------------------------------ Active trip

function ActiveTripCard({
  booking: b,
  vehicle,
  today,
  due,
  onExtend,
  onRoadside,
  onPay,
}: {
  booking: Booking;
  vehicle?: Vehicle;
  today: string;
  due: number;
  onExtend: () => void;
  onRoadside: () => void;
  onPay: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone, isDesktop } = useResponsive();
  const { toggleKeylessUnlock } = useApp();
  const [showSteps, setShowSteps] = useState(false);

  const step = currentStepIndex(b);
  const daysLeft = daysBetween(today, b.returnDate);
  const overdue = isOverdue(b, today);
  const progress = b.days > 0 ? Math.min(1, elapsedDays(b, today) / b.days) : 0;
  const timeLeft = overdue ? `Overdue by ${-daysLeft} ${-daysLeft === 1 ? 'day' : 'days'}` : daysLeft === 0 ? 'Due today' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
  const unlocked = !!b.keylessUnlocked;
  const stepLabel = RENTAL_STEPS[Math.min(step, RENTAL_STEPS.length - 1)].label;

  const info = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={styles.activeHead}>
        <View style={styles.activeThumb}>
          <VehiclePhoto source={vehicle?.imageAsset} style={{ width: '100%', height: '100%' }} radius={0} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.carName} numberOfLines={1}>
            {b.vehicleName}
          </Text>
          <Text style={styles.metaText}>
            {b.vehicleNumber} · Booking {b.id}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={b.status} />
            {overdue ? <Badge label="Return overdue" tone="danger" /> : null}
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
        <MiniStat icon={(c) => <Gauge size={16} color={c} />} label="Driven" value={formatKm(b.kmDriven ?? 0)} />
        <MiniStat icon={(c) => <Clock size={16} color={c} />} label="Time left" value={timeLeft} danger={overdue} />
        <MiniStat icon={(c) => <CalendarClock size={16} color={c} />} label="Return by" value={`${formatDate(b.returnDate, false)}, ${b.returnTime}`} />
      </View>
      <View style={{ marginTop: 10 }}>
        <ProgressBar value={progress} tone={overdue ? 'danger' : 'primary'} />
        <Text style={[styles.metaText, { marginTop: 6 }]}>
          Day {Math.min(elapsedDays(b, today), b.days)} of {b.days} · picked up {formatDate(b.pickupDate, false)} at {b.pickupLocation}
        </Text>
      </View>

      {/* Keyless unlock demo */}
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="switch"
        accessibilityState={{ checked: unlocked }}
        accessibilityLabel={unlocked ? 'Car unlocked. Tap to lock' : 'Car locked. Tap to unlock'}
        style={[styles.unlockBtn, unlocked && styles.unlockBtnOn]}
        onPress={() => toggleKeylessUnlock(b.id)}>
        <View style={[styles.unlockIcon, unlocked && { backgroundColor: colors.primarySoft }]}>
          {unlocked ? <Unlock size={20} color={colors.primaryText} /> : <Lock size={20} color={colors.onPrimary} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.unlockTitle, unlocked && { color: colors.primaryText }]}>{unlocked ? 'Car unlocked' : 'Car locked'}</Text>
          <Text style={[styles.unlockSub, unlocked && { color: colors.muted }]}>
            {unlocked ? 'Digital key active · tap to lock' : 'Tap to unlock with your phone'}
          </Text>
        </View>
        <Badge label="Simulated" tone={unlocked ? 'neutral' : 'highlight'} />
      </TouchableOpacity>
    </View>
  );

  const map = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <GpsMapPlaceholder
        height={isPhone ? 200 : 260}
        route={TRIP_ROUTE}
        markers={[
          { id: 'start', label: 'Pickup', x: TRIP_ROUTE[0].x, y: TRIP_ROUTE[0].y, tone: 'neutral' },
          { id: 'now', label: vehicle?.gps.area ?? 'Current position', ...TRIP_ROUTE[TRIP_ROUTE.length - 1], tone: 'primary' },
        ]}
        caption="Simulated trip view · live GPS connects later"
      />
      <Text style={[styles.metaText, { marginTop: 6 }]}>
        {vehicle ? `Last update ${vehicle.gps.updatedAt} · ${vehicle.gps.ignitionOn ? `moving at ${vehicle.gps.speedKmh} km/h` : 'parked'}` : 'Position unavailable'}
      </Text>
    </View>
  );

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={isDesktop ? { flexDirection: 'row', gap: 20 } : { gap: 16 }}>
        {info}
        {map}
      </View>

      <Divider style={{ marginVertical: 16 }} />
      <View style={styles.stepHead}>
        <Text style={styles.blockTitle}>Rental progress</Text>
        {isPhone ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setShowSteps((s) => !s)}>
            <Text style={styles.link}>{showSteps ? 'Hide steps' : 'Show all steps'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {isPhone && !showSteps ? (
        <Text style={styles.metaText}>
          Step {Math.min(step + 1, RENTAL_STEPS.length)} of {RENTAL_STEPS.length} · {stepLabel}
        </Text>
      ) : (
        <Stepper steps={RENTAL_STEPS} current={step} />
      )}

      <Divider style={{ marginVertical: 16 }} />
      <ExtensionStatus booking={b} />
      <View style={styles.actionsRow}>
        <Button label={extensionSummary(b).pending ? 'Extension requested' : 'Extend trip'} variant="primary" disabled={!!extensionSummary(b).pending} onPress={onExtend} icon={(c) => <CalendarPlus size={16} color={c} />} />
        <Button label="Track my car" variant="outline" onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}/track` as any)} icon={(c) => <MapPin size={16} color={c} />} />
        <Button label="Details" variant="outline" onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}` as any)} />
        <Button label="Roadside help" variant="outline" onPress={onRoadside} icon={(c) => <LifeBuoy size={16} color={c} />} />
        <Button
          label="View agreement"
          variant="outline"
          disabled={!b.agreementId}
          onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}/agreement` as any)}
          icon={(c) => <FileText size={16} color={c} />}
        />
        <Button
          label={due > 0 ? `Pay ${formatINR(due)}` : 'Payments'}
          variant={due > 0 ? 'highlight' : 'ghost'}
          onPress={onPay}
          icon={(c) => <CreditCard size={16} color={c} />}
        />
      </View>
    </Card>
  );
}

function MiniStat({ icon, label, value, danger }: { icon: (c: string) => React.ReactNode; label: string; value: string; danger?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.miniStat}>
      {icon(danger ? colors.danger : colors.secondaryText)}
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, danger && { color: colors.danger }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ Upcoming

function UpcomingCard({ booking: b, vehicle, today, due, onPay }: { booking: Booking; vehicle?: Vehicle; today: string; due: number; onPay: () => void }) {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const inDays = daysBetween(today, b.pickupDate);
  const countdown = inDays > 1 ? `Pickup in ${inDays} days` : inDays === 1 ? 'Pickup tomorrow' : inDays === 0 ? 'Pickup today' : `Pickup was ${formatDate(b.pickupDate, false)}`;
  const reminderDate = b.reminderScheduledFor ?? addDays(b.pickupDate, -2);
  const rs = reminderState(b, today);

  return (
    <Card>
      <View style={styles.rowTop}>
        <View style={styles.thumb}>
          <VehiclePhoto source={vehicle?.imageAsset} style={{ width: '100%', height: '100%' }} radius={0} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {b.vehicleName}
          </Text>
          <Text style={styles.metaText}>Booking {b.id} · {b.days} {b.days === 1 ? 'day' : 'days'} · {b.term}</Text>
        </View>
        <StatusBadge status={b.status} />
      </View>

      <View style={styles.countdown}>
        <CalendarClock size={18} color={colors.primaryText} />
        <View style={{ flex: 1 }}>
          <Text style={styles.countdownTitle}>{countdown}</Text>
          <Text style={styles.metaText}>
            {formatDate(b.pickupDate)}, {b.pickupTime} → {formatDate(b.returnDate)}, {b.returnTime}
          </Text>
        </View>
      </View>
      <View style={styles.infoLine}>
        <MapPin size={14} color={colors.muted} />
        <Text style={styles.metaText} numberOfLines={1}>
          {b.pickupLocation}
        </Text>
      </View>

      <View style={styles.chipRow}>
        <Badge
          label={rs === 'sent' ? `Reminder sent ${formatDate(reminderDate, false)}` : `Reminder on ${formatDate(reminderDate, false)}`}
          tone={rs === 'sent' ? 'success' : 'info'}
          icon={(c) => <Bell size={11} color={c} />}
        />
        {b.status === 'Quoted' ? <Badge label="Awaiting confirmation" tone="warning" /> : null}
        <Badge label={b.paymentStatus} tone={b.paymentStatus === 'Paid' ? 'success' : b.paymentStatus === 'Unpaid' ? 'warning' : 'info'} />
      </View>

      <View style={[styles.rowTop, { marginTop: 12, marginBottom: 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metaText}>Trip total</Text>
          <Text style={styles.amount}>{formatINR(b.totalAmount)}</Text>
        </View>
        <Button label="Details" size="sm" variant="outline" onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}` as any)} />
        <Button
          label={due > 0 ? `Pay ${formatINR(due)}` : 'Paid'}
          size="sm"
          variant={due > 0 ? 'primary' : 'ghost'}
          disabled={due <= 0}
          onPress={onPay}
          icon={(c) => <CreditCard size={14} color={c} />}
        />
      </View>
    </Card>
  );
}

// ------------------------------------------------------------------ Past

function PastTripRow({ booking: b, vehicle, first, onReceipt }: { booking: Booking; vehicle?: Vehicle; first: boolean; onReceipt: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.pastRow, !first && { borderTopWidth: 1, borderTopColor: colors.line }]}>
      <View style={styles.thumb}>
        <VehiclePhoto source={vehicle?.imageAsset} style={{ width: '100%', height: '100%' }} radius={0} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {b.vehicleName}
        </Text>
        <Text style={styles.metaText} numberOfLines={1}>
          {formatDate(b.pickupDate, false)} – {formatDate(b.returnDate)} · {b.kmDriven ? formatKm(b.kmDriven) : `${b.days} days`}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <StatusBadge status={b.status} />
          <Text style={styles.amountSmall}>{formatINR(b.totalAmount)}</Text>
        </View>
      </View>
      <Button label="Receipt" size="sm" variant="outline" onPress={onReceipt} icon={(c) => <Receipt size={14} color={c} />} />
    </View>
  );
}

// ------------------------------------------------------------------ Sheets

/** The latest extension request: waiting, approved or declined (with the reason). */
function ExtensionStatus({ booking: b }: { booking: Booking }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { pending, last } = extensionSummary(b);
  const e = pending ?? last;
  if (!e) return null;
  const tone = e.status === 'Approved' ? colors.success : e.status === 'Declined' ? colors.danger : colors.warmText;
  return (
    <View style={{ borderWidth: 1, borderColor: tone, borderRadius: 12, padding: 10, marginBottom: 12 }}>
      <Text style={[styles.blockTitle, { color: tone, marginBottom: 2 }]}>
        {e.status === 'Requested' ? 'Extension requested · waiting for KeyGo' : e.status === 'Approved' ? 'Extension approved' : 'Extension declined'}
      </Text>
      <Text style={styles.metaText}>
        {e.status === 'Declined'
          ? `${extensionLabel(e)} was not possible: ${e.declineReason ?? ''}. Please return on ${formatDate(e.fromReturnDate)}, ${e.fromReturnTime}.`
          : `${extensionLabel(e)} · return ${formatDate(e.toReturnDate)}, ${e.toReturnTime} · +${formatINR(e.extraTotal)}${e.status === 'Requested' ? '. The car is kept for you until KeyGo answers.' : ''}`}
      </Text>
    </View>
  );
}

/**
 * Ask for more time: by hours or by days (24 hours each). The price comes from the car's daily price (an hour is a
 * tenth of a day, never more than a day). KeyGo approves the request; the car is held for you meanwhile.
 */
function ExtendSheet({ booking: b, onClose }: { booking: Booking; onClose: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { showBooking, showToast } = useApp();
  const [unit, setUnit] = useState<ExtensionUnit>('hours');
  const [amount, setAmount] = useState(2);
  // Answers are kept with the choice they belong to, so an old price never shows for a new choice
  const [answer, setAnswer] = useState<{ key: string; quote?: ExtensionQuote; error?: string } | null>(null);
  const key = `${unit}:${amount}`;
  const quote = answer?.key === key ? (answer.quote ?? null) : null;
  const [sendError, setSendError] = useState('');
  const error = sendError || (answer?.key === key ? (answer.error ?? '') : '');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    let live = true;
    const k = `${unit}:${amount}`;
    const t = setTimeout(() => {
      quoteExtension(b.id, unit, amount).then(
        (q) => live && setAnswer({ key: k, quote: q }),
        (e: Error) => live && setAnswer({ key: k, error: e.message })
      );
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [b.id, unit, amount]);

  const change = (by: number) => {
    setSendError('');
    setAmount((n) => Math.max(1, Math.min(EXTEND_MAX[unit], n + by)));
  };
  const send = async () => {
    setBusy(true);
    try {
      showBooking(await requestExtension(b.id, unit, amount));
      showToast('Extension requested · KeyGo will confirm shortly');
      onClose();
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet
      visible
      title="Extend your trip"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={busy ? 'Sending…' : 'Request extension'} disabled={!quote?.available || busy} onPress={send} icon={(c) => <CalendarPlus size={16} color={c} />} />
        </>
      }>
      <Text style={styles.sheetLead}>How much more time do you need {b.vehicleName} for?</Text>
      <SegmentedControl
        options={EXTEND_UNITS}
        value={unit === 'hours' ? 'Hours' : 'Days'}
        onChange={(u) => {
          const next = u === 'Hours' ? 'hours' : 'days';
          setUnit(next);
          setAmount((n) => Math.min(EXTEND_MAX[next], n));
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 14 }}>
        <Button label="−" variant="outline" disabled={amount <= 1} onPress={() => change(-1)} />
        <Text style={[styles.amount, { minWidth: 120, textAlign: 'center' }]} accessibilityLiveRegion="polite">
          {amount} {unit === 'hours' ? (amount === 1 ? 'hour' : 'hours') : amount === 1 ? 'day' : 'days'}
        </Text>
        <Button label="+" variant="outline" disabled={amount >= EXTEND_MAX[unit]} onPress={() => change(1)} />
      </View>
      {unit === 'hours' ? <Text style={[styles.metaText, { textAlign: 'center', marginTop: 4 }]}>Up to 23 hours. For a day or more, choose Days.</Text> : null}
      <View style={{ marginTop: 16, minHeight: 150 }}>
        <SheetLine label="Current return" value={`${formatDate(b.returnDate)}, ${b.returnTime}`} />
        {quote ? (
          <>
            <SheetLine label="New return" value={`${formatDate(quote.newReturnDate)}, ${quote.newReturnTime}`} strong />
            <Divider />
            <SheetLine label="Rent" value={formatINR(quote.extraRent)} />
            {quote.extraDriver ? <SheetLine label="Driver" value={formatINR(quote.extraDriver)} /> : null}
            <SheetLine label="Tax" value={formatINR(quote.extraTax)} />
            <SheetLine label="Extra to pay" value={formatINR(quote.extraTotal)} strong />
            <Text style={[styles.metaText, { marginTop: 6 }]}>{quote.explain}</Text>
            {!quote.available ? <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: 8 }}>{quote.problem}</Text> : null}
          </>
        ) : error ? null : (
          <Text style={[styles.metaText, { marginTop: 8 }]}>Checking the price and that the car is free…</Text>
        )}
        {error ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 8 }}>{error}</Text> : null}
      </View>
      <Text style={[styles.metaText, { marginTop: 8 }]}>KeyGo confirms your request. The car is kept for you meanwhile; you pay the extra when it is approved.</Text>
    </FormSheet>
  );
}

function RoadsideSheet({ booking: b, vehicle, onClose }: { booking: Booking; vehicle?: Vehicle; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { showToast } = useApp();
  const [issue, setIssue] = useState<RoadsideIssue>('Flat tyre');
  const [note, setNote] = useState('');
  return (
    <FormSheet
      visible
      title="Roadside help"
      onClose={onClose}
      footer={
        <>
          <Button
            label="Call 24/7 helpline"
            variant="outline"
            icon={(c) => <PhoneCall size={16} color={c} />}
            onPress={() => showToast('Calling 24/7 roadside assistance: 1800-KEYGO-HELP (simulated)')}
          />
          <Button
            label="Request assistance"
            onPress={() => {
              showToast(`Roadside request for "${issue}" sent · simulated, no dispatch`);
              onClose();
            }}
          />
        </>
      }>
      <Text style={styles.sheetLead}>
        {b.vehicleName} · {b.vehicleNumber}
        {vehicle ? ` · near ${vehicle.gps.area}` : ''}
      </Text>
      <Text style={styles.fieldLabel}>What happened?</Text>
      <ChipGroup options={ROADSIDE_ISSUES} value={issue} onChange={setIssue} />
      <Field label="Details (optional)" value={note} onChangeText={setNote} placeholder="Landmark, what you see, etc." multiline style={{ marginTop: 16 }} />
      <SimulatedNote>Your shared location and booking details are attached to the request. Simulated in this preview.</SimulatedNote>
    </FormSheet>
  );
}

function PaymentSheet({ booking: b, due, paid, onClose, onPaid }: { booking: Booking; due: number; paid: number; onClose: () => void; onPaid: (amt: number) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { showToast } = useApp();
  const [method, setMethod] = useState<PayMethod>('UPI');
  const [upi, setUpi] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [bank, setBank] = useState<(typeof BANKS)[number]>('HDFC');
  const [wallet, setWallet] = useState<(typeof WALLETS)[number]>('Paytm');

  const pay = () => {
    onPaid(due);
    showToast('Payment simulated — no charge');
    onClose();
  };

  return (
    <FormSheet
      visible
      title="Pay online"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={due > 0 ? `Pay ${formatINR(due)}` : 'Nothing due'} disabled={due <= 0} onPress={pay} icon={(c) => <CreditCard size={16} color={c} />} />
        </>
      }>
      <View style={styles.payBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.metaText}>Amount due</Text>
          <Text style={[styles.amount, { color: due > 0 ? colors.txt : colors.success }]}>{formatINR(due)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.metaText}>Paid so far</Text>
          <Text style={styles.amount}>{formatINR(paid)}</Text>
        </View>
      </View>
      <Text style={[styles.metaText, { marginBottom: 14 }]}>
        Booking {b.id} · trip total {formatINR(b.totalAmount)} + refundable deposit {formatINR(b.depositAmount)}
      </Text>

      <Text style={styles.fieldLabel}>Payment method</Text>
      <ChipGroup options={PAY_METHODS} value={method} onChange={setMethod} />
      <View style={{ marginTop: 16 }}>
        {method === 'UPI' ? <Field label="UPI ID" value={upi} onChangeText={setUpi} placeholder="name@bank" hint="You'll approve the request in your UPI app (simulated)." /> : null}
        {method === 'Card' ? (
          <>
            <Field label="Card number" value={cardNo} onChangeText={setCardNo} placeholder="4111 1111 1111 1111" keyboardType="number-pad" />
            <FormRow cols={2}>
              <Field label="Expiry" value={expiry} onChangeText={setExpiry} placeholder="MM/YY" />
              <Field label="CVV" value={cvv} onChangeText={setCvv} placeholder="123" keyboardType="number-pad" />
            </FormRow>
            <Field label="Name on card" value={cardName} onChangeText={setCardName} placeholder="As printed on card" />
          </>
        ) : null}
        {method === 'Net banking' ? (
          <>
            <Text style={styles.fieldLabel}>Choose your bank</Text>
            <ChipGroup options={BANKS} value={bank} onChange={setBank} />
          </>
        ) : null}
        {method === 'Wallet' ? (
          <>
            <Text style={styles.fieldLabel}>Choose a wallet</Text>
            <ChipGroup options={WALLETS} value={wallet} onChange={setWallet} />
          </>
        ) : null}
      </View>
      <SimulatedNote>Payment UI preview only — no payment gateway is connected and nothing is charged.</SimulatedNote>
    </FormSheet>
  );
}

function ReceiptSheet({ booking: b, onClose }: { booking: Booking; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const cancelled = b.status === 'Cancelled';
  const tolls = b.tollCharges ?? 0;
  const fines = b.fineCharges ?? 0;
  const damage = b.damageCharges ?? 0;
  const fuel = b.fuelCharges ?? 0;
  const extras = tolls + fines + damage + fuel;
  const refund = Math.max(0, b.depositAmount - extras);
  const balance = Math.max(0, extras - b.depositAmount);

  return (
    <FormSheet visible title={`Receipt · ${b.id}`} onClose={onClose} footer={<Button label="Done" onPress={onClose} />}>
      <Text style={styles.sheetLead}>
        {b.vehicleName} · {formatDate(b.pickupDate)} – {formatDate(b.returnDate)} · {b.days} {b.days === 1 ? 'day' : 'days'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        <StatusBadge status={b.status} />
        <Badge label={b.paymentStatus} tone={b.paymentStatus === 'Refunded' || b.paymentStatus === 'Paid' ? 'success' : 'info'} />
      </View>

      <Text style={styles.blockTitle}>Rental charges</Text>
      <SheetLine label={`${formatINR(b.baseRatePerDay)} × ${Math.max(1, b.days - extensionSummary(b).days)} days (${b.term})`} value={formatINR(b.baseRatePerDay * Math.max(1, b.days - extensionSummary(b).days))} />
      {extensionSummary(b).approved.length ? <SheetLine label={`Extensions (${extensionSummary(b).approved.map(extensionLabel).join(', ')})`} value={formatINR(extensionSummary(b).subtotal)} /> : null}
      {b.discount > 0 ? <SheetLine label="Discounts" value={formatINR(-b.discount)} /> : null}
      <SheetLine label="Tax" value={formatINR(b.tax)} />
      <SheetLine label="Rental total" value={formatINR(b.totalAmount)} strong />

      {cancelled ? (
        <>
          <Divider />
          <SheetLine label="Cancellation" value={b.paymentStatus === 'Refunded' ? 'Refunded' : 'Pending business rules'} />
        </>
      ) : (
        <>
          <Divider />
          <Text style={styles.blockTitle}>Deducted from deposit</Text>
          <SheetLine label="Tolls (FASTag)" value={formatINR(tolls)} />
          <SheetLine label="Traffic fines" value={formatINR(fines)} />
          <SheetLine label="Damage" value={formatINR(damage)} />
          <SheetLine label="Fuel / charging" value={formatINR(fuel)} />
          <Divider />
          <SheetLine label="Security deposit" value={formatINR(b.depositAmount)} />
          <SheetLine label="Less deductions" value={formatINR(-extras)} />
          <SheetLine label={balance > 0 ? 'Balance payable' : 'Deposit refunded'} value={formatINR(balance > 0 ? balance : refund)} strong />
          {b.completedAt ? <Text style={[styles.metaText, { marginTop: 8 }]}>Settled on {formatDate(b.completedAt)}</Text> : null}
        </>
      )}
    </FormSheet>
  );
}

function SheetLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sheetLine}>
      <Text style={[styles.sheetLabel, strong && styles.sheetStrong]}>{label}</Text>
      <Text style={[styles.sheetValue, strong && styles.sheetStrong]}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    activeHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    activeThumb: {
      width: 120,
      height: 80,
      borderRadius: 12,
      backgroundColor: colors.bg2,
      padding: 6,
    },
    carName: {
      color: colors.txt,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    metaText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    statRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 16,
    },
    miniStat: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 10,
      gap: 4,
    },
    miniLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    miniValue: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
    },
    unlockBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    unlockBtnOn: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
    },
    unlockIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentDark,
    },
    unlockTitle: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    unlockSub: {
      color: colors.onPrimary,
      opacity: 0.85,
      fontSize: 12,
      marginTop: 1,
    },
    stepHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    blockTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 6,
    },
    link: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    thumb: {
      width: 72,
      height: 50,
      borderRadius: 10,
      backgroundColor: colors.bg2,
      padding: 4,
    },
    rowTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    countdown: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      padding: 10,
    },
    countdownTitle: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: '800',
    },
    infoLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    amount: {
      color: colors.txt,
      fontSize: 18,
      fontWeight: '800',
    },
    amountSmall: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    pastRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    sheetLead: {
      color: colors.muted,
      fontSize: 13,
      marginBottom: 14,
      lineHeight: 18,
    },
    fieldLabel: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8,
    },
    sheetLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 4,
    },
    sheetLabel: {
      color: colors.muted,
      fontSize: 13,
      flex: 1,
    },
    sheetValue: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '600',
    },
    sheetStrong: {
      color: colors.txt,
      fontWeight: '800',
      fontSize: 14,
    },
    payBox: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
  });
