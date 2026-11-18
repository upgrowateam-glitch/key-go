import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CreditCard, FileSignature, MapPin, Navigation, XCircle } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';
import { useThemeColors } from '../../../theme';
import { Badge, Button, Card, ConfirmDialog, Divider, EmptyState, PageHeader, Screen, Section, StatusBadge, Stepper, VehiclePhoto, VEHICLE_PHOTO_ASPECT } from '../../../components/kit';
import { RENTAL_STEPS, currentStepIndex, isOverdue } from '../../../lib/lifecycle';
import { amountDue } from '../../../lib/payments';
import { formatDate, formatINR, formatKm } from '../../../lib/format';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const colors = useThemeColors();
  const text = { color: strong ? colors.txt : colors.muted, fontSize: 13, fontWeight: strong ? ('800' as const) : ('500' as const) };
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <Text style={text}>{label}</Text>
      <Text style={[text, { color: colors.txt, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function BookingDetailScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = decodeURIComponent(id ?? '');
  const { bookings, vehicles, inspections, agreements, currentCustomerId, cancelBooking, today } = useApp();
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  // Customers can only open their own bookings
  const booking = bookings.find((b) => b.id === bookingId && b.customerId === currentCustomerId);
  if (!booking) {
    return (
      <Screen>
        <PageHeader title="Booking not found" back />
        <EmptyState title="We couldn't find this booking" message={`There is no booking ${bookingId} on your account.`} />
      </Screen>
    );
  }

  const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
  const pickup = inspections.find((i) => i.id === booking.pickupInspectionId);
  const ret = inspections.find((i) => i.id === booking.returnInspectionId);
  const agreement = agreements.find((a) => a.id === booking.agreementId);
  const enc = encodeURIComponent(booking.id);
  const due = amountDue(booking);
  const open = booking.status !== 'Completed' && booking.status !== 'Cancelled';
  const cancellable = booking.status === 'Quoted' || booking.status === 'Pending' || booking.status === 'Confirmed';

  return (
    <Screen>
      <PageHeader
        eyebrow="My booking"
        title={booking.vehicleName}
        subtitle={`Booking ${booking.id}`}
        back
        actions={
          <>
            <StatusBadge status={booking.status} />
            {isOverdue(booking, today) ? <Badge label="Return overdue" tone="danger" /> : null}
          </>
        }
      />
      {vehicle ? <VehiclePhoto source={vehicle.imageAsset} style={{ width: '100%', aspectRatio: VEHICLE_PHOTO_ASPECT, marginTop: 8 }} accessibilityLabel={vehicle.name} /> : null}

      {booking.status !== 'Cancelled' ? (
        <View style={{ marginTop: 16 }}>
          <Stepper steps={RENTAL_STEPS} current={currentStepIndex(booking)} />
        </View>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <EmptyState compact title="Booking cancelled" message="This booking was cancelled." icon={(c) => <XCircle size={22} color={c} />} />
        </Card>
      )}

      {open ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {due > 0 ? <Button label={`Pay ${formatINR(due)}`} variant="highlight" icon={(c) => <CreditCard size={16} color={c} />} onPress={() => router.push(`/rental/${enc}/pay` as any)} /> : null}
          {booking.status === 'Confirmed' || agreement ? (
            <Button label={agreement ? 'View agreement' : 'Sign agreement'} variant={agreement ? 'outline' : 'primary'} icon={(c) => <FileSignature size={16} color={c} />} onPress={() => router.push(`/rental/${enc}/agreement` as any)} />
          ) : null}
          {booking.status === 'Active' ? <Button label="Track my car" icon={(c) => <Navigation size={16} color={c} />} onPress={() => router.push(`/rental/${enc}/track` as any)} /> : null}
          {cancellable ? <Button label="Cancel booking" variant="danger" onPress={() => setConfirmCancel(true)} /> : null}
        </View>
      ) : null}

      <Section title="Pickup & return">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MapPin size={15} color={colors.primaryText} />
            <Text style={{ flex: 1, color: colors.txt, fontSize: 14, fontWeight: '700' }}>{booking.pickupLocation}</Text>
          </View>
          <Line label="Pickup" value={`${formatDate(booking.pickupDate)} · ${booking.pickupTime}`} />
          <Line label="Return" value={`${formatDate(booking.returnDate)} · ${booking.returnTime}`} />
          <Line label="Vehicle number" value={booking.vehicleNumber} />
          <Divider />
          <Line label="At pickup" value={pickup ? `Fuel ${pickup.fuelPercent}% · ${formatKm(pickup.odometerKm)} · ${pickup.damageMarks.length} damage mark(s)` : 'KeyGo staff will inspect the car with you'} />
          <Line label="At return" value={ret ? `Fuel ${ret.fuelPercent}% · ${formatKm(ret.odometerKm)} · ${ret.damageMarks.length} damage mark(s)` : 'Inspected when you bring the car back'} />
        </Card>
      </Section>

      <Section title="Price breakdown">
        <Card>
          <Line label={`${formatINR(booking.baseRatePerDay)} × ${booking.days} days`} value={formatINR(booking.baseRatePerDay * booking.days)} />
          {booking.discount ? <Line label="Discounts" value={`− ${formatINR(booking.discount)}`} /> : null}
          <Line label="GST (18%)" value={formatINR(booking.tax)} />
          <Line label="Trip total" value={formatINR(booking.totalAmount)} strong />
          <Line label="Refundable deposit" value={formatINR(booking.depositAmount)} />
          <Divider />
          <Line label="Payment status" value={booking.paymentStatus} />
          {booking.status === 'Completed' ? (
            <>
              <Line label="Fuel, tolls, fines & damage" value={formatINR((booking.fuelCharges ?? 0) + (booking.tollCharges ?? 0) + (booking.fineCharges ?? 0) + (booking.damageCharges ?? 0))} />
              <Line label="Km driven" value={formatKm(booking.kmDriven ?? 0)} />
            </>
          ) : null}
        </Card>
      </Section>

      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel this booking?"
        message={`${booking.vehicleName} will be released for other customers. Refunds follow the KeyGo cancellation policy.`}
        confirmLabel="Cancel booking"
        danger
        onConfirm={() => {
          cancelBooking(booking.id);
          setConfirmCancel(false);
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </Screen>
  );
}
