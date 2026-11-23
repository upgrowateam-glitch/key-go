import { useLocalSearchParams, useRouter } from '@/shims/expo-router';
import { Bell, CheckCircle2, ClipboardCheck, FileSignature, KeyRound, Printer, Receipt, RefreshCw, XCircle } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
    Badge,
    Button,
    Card,
    ConfirmDialog,
    Divider,
    EmptyState,
    Field,
    FormRow,
    GpsMapPlaceholder,
    KeyValueGrid,
    PageHeader,
    ProgressBar,
    Screen,
    Section,
    SimulatedNote,
    SplitView,
    StatusBadge,
    Stepper,
    VEHICLE_PHOTO_ASPECT,
    VehiclePhoto,
} from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { findConflicts } from '../../lib/availability';
import { daysBetween, formatDate, formatINR, formatKm } from '../../lib/format';
import { RENTAL_STEPS, currentStepIndex, elapsedDays, isOverdue, reminderState } from '../../lib/lifecycle';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { useStaffSession } from '../../components/portal/PortalShell';
import { canAccess } from '../../services/auth';
import { extensionLabel, extensionSummary } from '../../services/extensions';
import { ExtendRentalSheet } from './ExtendRentalSheet';
import { ExtensionsCard } from './ExtensionsCard';
import type { Booking } from '../../types';

export default function RentalHubScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = decodeURIComponent(id ?? '');
  const { bookings, vehicles, inspections, agreements, fastagLogs, confirmBooking, cancelBooking, completeRental, renewQuote, sendReminder, role, today } = useApp();
  const [reminding, setReminding] = useState(false);
  const { cols } = useResponsive();
  const { session } = useStaffSession();
  const canEditBookings = canAccess(session, 'bookings', 'edit');
  const [extending, setExtending] = useState(false);

  const booking = bookings.find((b) => b.id === bookingId);
  const vehicle = vehicles.find((v) => v.id === booking?.vehicleId);
  const pickup = inspections.find((i) => i.id === booking?.pickupInspectionId);
  const ret = inspections.find((i) => i.id === booking?.returnInspectionId);
  const agreement = agreements.find((a) => a.id === booking?.agreementId);
  const tolls = fastagLogs.filter((l) => l.bookingId === bookingId);
  const unbilledTolls = tolls.filter((l) => !l.billedToCustomer).reduce((s, l) => s + l.amount, 0);

  // Settlement form (pre-filled from the return inspection, tolls and agreement fines; editable by staff)
  // Staff edits override the pre-filled values; untouched fields follow the latest records
  const [pendingAction, setPendingAction] = useState<'confirm' | 'cancel' | null>(null);
  const [edits, setEdits] = useState<{ fuel?: string; toll?: string; fine?: string; damage?: string }>({});
  const fuel = edits.fuel ?? '';
  const toll = edits.toll ?? String(unbilledTolls);
  const fine = edits.fine ?? '0';
  const damage = edits.damage ?? String(ret?.estimatedDamageCost ?? 0);
  const setFuel = (v: string) => setEdits((e) => ({ ...e, fuel: v }));
  const setToll = (v: string) => setEdits((e) => ({ ...e, toll: v }));
  const setFine = (v: string) => setEdits((e) => ({ ...e, fine: v }));
  const setDamage = (v: string) => setEdits((e) => ({ ...e, damage: v }));

  const settlement = useMemo(() => {
    const n = (s: string) => Math.max(0, parseInt(s.replace(/[^0-9]/g, ''), 10) || 0);
    const extras = n(fuel) + n(toll) + n(fine) + n(damage);
    const deposit = booking?.depositAmount ?? 0;
    return { fuel: n(fuel), toll: n(toll), fine: n(fine), damage: n(damage), extras, refund: Math.max(0, deposit - extras), due: Math.max(0, extras - deposit) };
  }, [fuel, toll, fine, damage, booking?.depositAmount]);

  if (!booking) {
    return (
      <Screen>
        <PageHeader title="Rental not found" back />
        <EmptyState title="Unknown booking" message={`No booking with id ${bookingId}.`} />
      </Screen>
    );
  }

  const conflicts = findConflicts(bookings, booking, { excludeBookingId: booking.id, today });
  const step = currentStepIndex(booking);
  const enc = encodeURIComponent(booking.id);
  const overdue = isOverdue(booking, today);
  const reminder = reminderState(booking, today);
  const quoteExpired = (booking.status === 'Quoted' || booking.status === 'Pending') && !!booking.quoteValidUntil && Date.parse(booking.quoteValidUntil) < Date.now();
  const fuelDrop = pickup && ret ? Math.max(0, pickup.fuelPercent - ret.fuelPercent) : 0;
  const isOps = role === 'operations';

  const nextCard = () => {
    if (booking.status === 'Cancelled') {
      return (
        <Card>
          <EmptyState title="Booking cancelled" message="This booking was cancelled. The vehicle has been released." icon={(c) => <XCircle size={22} color={c} />} compact />
        </Card>
      );
    }
    switch (step) {
      case 0:
        return (
          <Card>
            <Text style={styles.cardTitle}>Quote ready for confirmation</Text>
            <Text style={styles.cardSub}>Review the quote with the customer, then confirm to reserve the vehicle and schedule the pickup reminder.</Text>
            <QuoteLines booking={booking} />
            {booking.quoteValidUntil ? (
              <Text style={[styles.cardSub, { marginTop: 8 }, quoteExpired && { color: colors.danger, fontWeight: '700' }]}>
                {quoteExpired ? 'This quotation has expired' : 'Valid until'}{' '}
                {new Date(booking.quoteValidUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                {quoteExpired ? ' — renew it to confirm.' : ''}
              </Text>
            ) : null}
            {conflicts.length ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 10 }}>{`${booking.vehicleName} is already held by ${conflicts[0].id} from ${formatDate(conflicts[0].pickupDate, false)} to ${formatDate(conflicts[0].returnDate, false)}. Change the dates or vehicle before confirming.`}</Text> : null}
            <View style={styles.actionsRow}>
              {quoteExpired ? (
                <Button label="Renew quotation" icon={(c) => <RefreshCw size={16} color={c} />} onPress={() => renewQuote(booking.id)} />
              ) : (
                <Button label="Confirm booking" disabled={conflicts.length > 0} icon={(c) => <CheckCircle2 size={16} color={c} />} onPress={() => setPendingAction('confirm')} />
              )}
              <Button label="Quotation" variant="outline" icon={(c) => <Printer size={16} color={c} />} onPress={() => router.push(`/bookings/${enc}/quotation` as any)} />
              <Button label="Cancel quote" variant="danger" onPress={() => setPendingAction('cancel')} />
            </View>
          </Card>
        );
      case 2:
        return (
          <Card>
            <Text style={styles.cardTitle}>Next: rental agreement</Text>
            <Text style={styles.cardSub}>Set deposit, discount and fines, preview the contract and capture the customer&apos;s signature.</Text>
            <View style={styles.actionsRow}>
              <Button label="Prepare & sign agreement" icon={(c) => <FileSignature size={16} color={c} />} onPress={() => router.push(`/bookings/${enc}/agreement` as any)} />
            </View>
          </Card>
        );
      case 3:
        return (
          <Card>
            <Text style={styles.cardTitle}>Next: pickup inspection</Text>
            <Text style={styles.cardSub}>Record photos, existing damage, fuel level and odometer before handing over the keys.</Text>
            <View style={styles.actionsRow}>
              <Button label="Start pickup inspection" icon={(c) => <ClipboardCheck size={16} color={c} />} onPress={() => router.push(`/bookings/${enc}/inspection?type=Pickup` as any)} />
            </View>
          </Card>
        );
      case 4: {
        const elapsed = elapsedDays(booking, today);
        return (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={styles.cardTitle}>Rental in progress</Text>
              {overdue ? <Badge label={`Overdue by ${daysBetween(booking.returnDate, today)} day(s)`} tone="danger" /> : <Badge label="On time" tone="success" />}
            </View>
            <KeyValueGrid
              cols={cols(2, 4, 4)}
              items={[
                { label: 'Duration', value: `Day ${Math.min(elapsed, booking.days)} of ${booking.days}` },
                { label: 'Km driven', value: formatKm(booking.kmDriven ?? 0) },
                { label: 'Return due', value: `${formatDate(booking.returnDate, false)} · ${booking.returnTime}` },
                { label: 'Tolls so far', value: formatINR(tolls.reduce((s, l) => s + l.amount, 0)) },
              ]}
            />
            <ProgressBar value={elapsed / Math.max(1, booking.days)} tone={overdue ? 'danger' : 'primary'} />
            {vehicle ? (
              <View style={{ marginTop: 14 }}>
                <GpsMapPlaceholder
                  height={180}
                  markers={[{ id: vehicle.id, label: `${vehicle.gps.area} · ${vehicle.gps.speedKmh} km/h`, x: 0.62, y: 0.4, tone: overdue ? 'danger' : 'primary' }]}
                  route={[{ x: 0.1, y: 0.85 }, { x: 0.3, y: 0.7 }, { x: 0.42, y: 0.55 }, { x: 0.62, y: 0.4 }]}
                  caption={`Simulated GPS · updated ${vehicle.gps.updatedAt}`}
                />
              </View>
            ) : null}
            <View style={styles.actionsRow}>
              <Button label="Start return inspection" icon={(c) => <ClipboardCheck size={16} color={c} />} onPress={() => router.push(`/bookings/${enc}/inspection?type=Return` as any)} />
            </View>
          </Card>
        );
      }
      case 6:
        return (
          <Card>
            <Text style={styles.cardTitle}>Settle & complete rental</Text>
            <Text style={styles.cardSub}>
              Charges are pre-filled from the return inspection, FASTag tolls and agreement. Adjust if needed — they are deducted from the security deposit.
            </Text>
            <FormRow>
              <Field
                label="Fuel charge (₹)"
                value={fuel}
                onChangeText={setFuel}
                keyboardType="numeric"
                placeholder="0"
                hint={fuelDrop > 0 ? `Returned with ${fuelDrop}% less fuel than pickup` : 'Fuel level matched pickup'}
              />
              <Field label="Toll charges (₹)" value={toll} onChangeText={setToll} keyboardType="numeric" hint={`${tolls.length} FASTag entries on this rental`} />
            </FormRow>
            <FormRow>
              <Field
                label="Fines / penalties (₹)"
                value={fine}
                onChangeText={setFine}
                keyboardType="numeric"
                hint={agreement?.fines.length ? `Agreement fines: ${agreement.fines.map((f) => `${f.label} ${formatINR(f.amount)}`).join(', ')}` : 'Late return, traffic challans, etc.'}
              />
              <Field label="Damage charges (₹)" value={damage} onChangeText={setDamage} keyboardType="numeric" hint={ret?.damageMarks.length ? `${ret.damageMarks.length} new damage mark(s) at return` : 'No new damage recorded'} />
            </FormRow>
            <Divider />
            <Line label="Security deposit held" value={formatINR(booking.depositAmount)} />
            <Line label="Deductions" value={settlement.extras ? `− ${formatINR(settlement.extras)}` : formatINR(0)} />
            <Line label={settlement.due ? 'Balance due from customer' : 'Refund to customer'} value={formatINR(settlement.due || settlement.refund)} strong />
            <View style={styles.actionsRow}>
              <Button
                label="Complete rental"
                icon={(c) => <CheckCircle2 size={16} color={c} />}
                onPress={() => completeRental(booking.id, { fuelCharges: settlement.fuel, tollCharges: settlement.toll, fineCharges: settlement.fine, damageCharges: settlement.damage })}
              />
            </View>
            <SimulatedNote>Refunds and payments are simulated — no money moves in the UI phase.</SimulatedNote>
          </Card>
        );
      default: {
        const extras = (booking.fuelCharges ?? 0) + (booking.tollCharges ?? 0) + (booking.fineCharges ?? 0) + (booking.damageCharges ?? 0);
        return (
          <Card tone="soft">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Receipt size={20} color={colors.secondaryText} />
              <Text style={styles.cardTitle}>Rental completed{booking.completedAt ? ` · ${formatDate(booking.completedAt)}` : ''}</Text>
            </View>
            <Divider />
            <Line label="Rental amount" value={formatINR(booking.totalAmount)} />
            <Line label="Fuel" value={formatINR(booking.fuelCharges ?? 0)} />
            <Line label="Tolls" value={formatINR(booking.tollCharges ?? 0)} />
            <Line label="Fines" value={formatINR(booking.fineCharges ?? 0)} />
            <Line label="Damage" value={formatINR(booking.damageCharges ?? 0)} />
            <Line label="Km driven" value={formatKm(booking.kmDriven ?? 0)} />
            <Divider />
            <Line label="Deposit refunded" value={formatINR(Math.max(0, booking.depositAmount - extras))} strong />
          </Card>
        );
      }
    }
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Rental workflow"
        title={`${booking.id} · ${booking.customerName}`}
        subtitle={`${booking.vehicleName} · ${formatDate(booking.pickupDate, false)} → ${formatDate(booking.returnDate, false)}`}
        back
        actions={
          <>
            <StatusBadge status={booking.status} />
            {overdue ? <Badge label="Overdue" tone="danger" /> : null}
          </>
        }
      />

      <View style={{ marginTop: 8 }}>
        <Stepper steps={RENTAL_STEPS} current={booking.status === 'Cancelled' ? -1 : step} />
      </View>

      <SplitView
        sideWidth={380}
        main={
          <View>
            <Section title="Next step" style={{ marginTop: 16 }}>
              {nextCard()}
            </Section>
            <Section title="Extensions">
              <ExtensionsCard booking={booking} canEdit={canEditBookings} onExtend={() => setExtending(true)} />
            </Section>
            <Section title="Records">
              <Card padded={false}>
                <RecordRow
                  icon={<FileSignature size={16} color={colors.primaryText} />}
                  title="Rental agreement"
                  detail={agreement ? `${agreement.id} · signed ${formatDate(agreement.signedDate, false)} · ${agreement.status}` : 'Not signed yet'}
                  action={agreement || step >= 2 ? <Button label={agreement ? 'View' : 'Prepare'} size="sm" variant="outline" onPress={() => router.push(`/bookings/${enc}/agreement` as any)} /> : null}
                />
                <RecordRow
                  icon={<ClipboardCheck size={16} color={colors.primaryText} />}
                  title="Pickup inspection"
                  detail={pickup ? `${pickup.id} · fuel ${pickup.fuelPercent}% · ${formatKm(pickup.odometerKm)} · ${pickup.damageMarks.length} mark(s)` : 'Pending'}
                  action={pickup ? <Button label="View" size="sm" variant="outline" onPress={() => router.push(`/bookings/${enc}/inspection?type=Pickup` as any)} /> : null}
                />
                <RecordRow
                  icon={<ClipboardCheck size={16} color={colors.primaryText} />}
                  title="Return inspection"
                  detail={ret ? `${ret.id} · fuel ${ret.fuelPercent}% · ${formatKm(ret.odometerKm)} · est. damage ${formatINR(ret.estimatedDamageCost)}` : 'Pending'}
                  action={ret ? <Button label="View" size="sm" variant="outline" onPress={() => router.push(`/bookings/${enc}/inspection?type=Return` as any)} /> : null}
                />
                <RecordRow
                  icon={<KeyRound size={16} color={colors.primaryText} />}
                  title="FASTag tolls"
                  detail={`${tolls.length} entries · ${formatINR(tolls.reduce((s, l) => s + l.amount, 0))}${unbilledTolls ? ` · ${formatINR(unbilledTolls)} unbilled` : ''}`}
                  action={isOps ? <Button label="FASTag" size="sm" variant="ghost" onPress={() => router.push('/fastag' as any)} /> : null}
                  last
                />
              </Card>
            </Section>
          </View>
        }
        side={
          <Section title="Booking summary" style={{ marginTop: 16 }}>
            <Card>
              <VehiclePhoto source={vehicle?.imageAsset} style={styles.carImage} accessibilityLabel={booking.vehicleName} />
              <Text style={styles.cardTitle}>{booking.vehicleName}</Text>
              <Text style={styles.cardSub}>
                {booking.vehicleNumber} · {booking.vehicleCategory}
              </Text>
              <Divider />
              <Line label="Customer" value={booking.customerName} />
              <Line label="Phone" value={booking.customerPhone || '—'} />
              <Line label="Reservation date" value={formatDate(booking.createdAt)} />
              <Line label="Pickup" value={`${formatDate(booking.pickupDate, false)} · ${booking.pickupTime}`} />
              <Line label="Return" value={`${formatDate(booking.returnDate, false)} · ${booking.returnTime}${extensionSummary(booking).approved.length ? ' (extended)' : ''}`} />
              {extensionSummary(booking).pending ? <Line label="Extension asked" value={`${extensionLabel(extensionSummary(booking).pending!)} · waiting for you`} /> : null}
              <Line label="Pickup location" value={booking.pickupLocation} />
              <Line label="Term · days" value={`${booking.term} · ${booking.days}${booking.extraHours ? ` days + ${booking.extraHours} h` : ''}`} />
              <Line label="Purpose" value={booking.purpose} />
              <Line label="Classification" value={booking.classification} />
              <Line label="Payment" value={booking.paymentStatus} />
              <Divider />
              <QuoteLines booking={booking} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <Bell size={14} color={reminder === 'none' ? colors.muted : colors.warmText} />
                <Text style={[styles.cardSub, { flex: 1 }]}>
                  {reminder === 'sent'
                    ? `Pickup reminder sent${booking.reminderLog ? ` ${new Date(booking.reminderLog.sentAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${booking.reminderLog.channels.length ? booking.reminderLog.channels.map((c) => (c === 'app' ? 'app' : 'WhatsApp')).join(' + ') : 'not delivered'}` : ''}`
                    : reminder === 'scheduled'
                      ? `Pickup reminder scheduled for ${formatDate(booking.reminderScheduledFor!, false)}`
                      : booking.status === 'Confirmed'
                        ? 'Pickup reminder due — sent automatically within a few minutes'
                        : 'No pickup reminder scheduled'}
                </Text>
                {booking.status === 'Confirmed' && isOps ? (
                  <Button
                    label={reminding ? 'Sending…' : reminder === 'sent' ? 'Send again' : 'Send now'}
                    variant="outline"
                    size="sm"
                    disabled={reminding}
                    onPress={async () => {
                      setReminding(true);
                      await sendReminder(booking.id);
                      setReminding(false);
                    }}
                  />
                ) : null}
              </View>
              {booking.reminderLog?.whatsappError ? <Text style={[styles.cardSub, { color: colors.warmText, marginTop: 4 }]}>WhatsApp: {booking.reminderLog.whatsappError}</Text> : null}
              {isOps && booking.customerId ? (
                <Button label="Open customer profile" variant="ghost" size="sm" onPress={() => router.push(`/customers/${booking.customerId}` as any)} style={{ marginTop: 8 }} />
              ) : null}
            </Card>
          </Section>
        }
      />
      {extending ? <ExtendRentalSheet booking={booking} onClose={() => setExtending(false)} /> : null}
      <ConfirmDialog
        visible={pendingAction !== null}
        title={pendingAction === 'confirm' ? 'Confirm this booking?' : 'Cancel this quote?'}
        message={pendingAction === 'confirm' ? `${booking.vehicleName} will be reserved for ${booking.customerName} and the pickup reminder scheduled.` : 'The quote will be cancelled and the vehicle released.'}
        confirmLabel={pendingAction === 'confirm' ? 'Confirm booking' : 'Cancel quote'}
        danger={pendingAction === 'cancel'}
        onConfirm={() => {
          if (pendingAction === 'confirm') confirmBooking(booking.id);
          else cancelBooking(booking.id);
          setPendingAction(null);
        }}
        onCancel={() => setPendingAction(null)}
      />
    </Screen>
  );
}

function QuoteLines({ booking }: { booking: Booking }) {
  // Extension days are charged separately (their own line), so the base line shows the original days
  const ext = extensionSummary(booking);
  const baseDays = Math.max(1, booking.days - ext.days);
  return (
    <View style={{ marginTop: 8 }}>
      <Line label={`${formatINR(booking.baseRatePerDay)} × ${baseDays} days`} value={formatINR(booking.baseRatePerDay * baseDays)} />
      {ext.approved.length ? <Line label={`Extensions (${ext.approved.map(extensionLabel).join(', ')})`} value={formatINR(ext.subtotal)} /> : null}
      {booking.discount ? <Line label="Discounts" value={`− ${formatINR(booking.discount)}`} /> : null}
      <Line label="GST (18%)" value={formatINR(booking.tax)} />
      <Line label="Total" value={formatINR(booking.totalAmount)} strong />
      <Line label="Refundable deposit" value={formatINR(booking.depositAmount)} />
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && styles.lineStrong]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.lineStrong]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function RecordRow({ icon, title, detail, action, last }: { icon: React.ReactNode; title: string; detail: string; action?: React.ReactNode; last?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.recordRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.recordIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.recordTitle}>{title}</Text>
        <Text style={styles.cardSub} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      {action}
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
    cardSub: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2,
      lineHeight: 18,
      flexShrink: 1,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 16,
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
      flexShrink: 1,
    },
    lineStrong: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    carImage: {
      width: '100%',
      aspectRatio: VEHICLE_PHOTO_ASPECT,
      marginBottom: 10,
    },
    recordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    recordIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
  });
