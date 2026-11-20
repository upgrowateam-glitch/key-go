import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { Badge, Button, EmptyState, FormSheet, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { daysBetween, formatDate } from '../../lib/format';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking, Driver } from '../../types';
import { leaveDuring } from './availability';

/** Licences expiring within this many days are flagged. */
const LICENCE_WARN_DAYS = 90;

export function licenceState(expiry: string, today: string): { label: string; tone: 'danger' | 'warning' | 'success' } {
  const d = daysBetween(today, expiry);
  if (d < 0) return { label: 'Expired', tone: 'danger' };
  if (d <= LICENCE_WARN_DAYS) return { label: `Expires in ${d}d`, tone: 'warning' };
  return { label: 'Valid', tone: 'success' };
}

/** Confirmed or active bookings with no driver yet. */
export function useAssignableBookings() {
  const { drivers, bookings } = useApp();
  return useMemo(() => {
    const assigned = new Set(drivers.flatMap((d) => d.assignments.map((a) => a.bookingId)));
    return bookings.filter((b) => (b.status === 'Confirmed' || b.status === 'Active') && !b.driverId && !assigned.has(b.id));
  }, [drivers, bookings]);
}

/** The open assignment of this driver that overlaps the booking's dates, if any. */
function findClash(driver: Driver, booking: Booking, bookings: Booking[]) {
  return driver.assignments.find((a) => {
    if (a.status === 'Completed') return false;
    const other = bookings.find((b) => b.id === a.bookingId);
    return !!other && other.pickupDate <= booking.returnDate && other.returnDate >= booking.pickupDate;
  });
}

export function AssignDriverSheet({ driverId, bookingId, onClose }: { driverId?: string; bookingId?: string; onClose: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { drivers, bookings, today, assignDriverToBooking } = useApp();
  const assignable = useAssignableBookings();
  const [pickedBooking, setPickedBooking] = useState<string | null>(bookingId ?? null);
  const [pickedDriver, setPickedDriver] = useState<string | null>(driverId ?? null);
  const [submitted, setSubmitted] = useState(false);

  const booking = bookings.find((b) => b.id === pickedBooking);
  const driver = drivers.find((d) => d.id === pickedDriver);
  const fixedBooking = !!bookingId;
  const fixedDriver = !!driverId;

  const licenceExpired = driver ? daysBetween(today, driver.licenseExpiry) < 0 : false;
  // The licence must stay valid until the trip ends, and the driver must not be on leave
  const licenceEndsEarly = driver && booking && !licenceExpired ? driver.licenseExpiry < booking.returnDate : false;
  const leave = driver && booking ? leaveDuring(driver, booking.pickupDate, booking.returnDate) : undefined;
  const clash = driver && booking ? findClash(driver, booking, bookings) : undefined;
  const error = !booking
    ? 'Choose a booking'
    : !driver
      ? 'Choose a driver'
      : licenceExpired
        ? `${driver.name}'s licence has expired, so this driver cannot be assigned.`
        : licenceEndsEarly
          ? `${driver.name}'s licence expires on ${formatDate(driver.licenseExpiry)}, before this trip ends.`
          : leave
            ? `${driver.name} is on leave from ${formatDate(leave.from)} to ${formatDate(leave.to)}.`
            : clash
          ? `${driver.name} is already on ${clash.bookingId} during these dates.`
          : undefined;

  const confirm = () => {
    setSubmitted(true);
    if (error || !booking || !driver) return;
    assignDriverToBooking(booking.id, driver.id);
    onClose();
  };

  const title = fixedDriver && driver ? `Assign ${driver.name}` : fixedBooking ? `Assign driver to ${bookingId}` : 'Assign to booking';
  return (
    <FormSheet
      visible
      title={title}
      onClose={onClose}
      footer={
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Assign driver" disabled={assignable.length === 0 && !fixedBooking} onPress={confirm} />
        </View>
      }>
      {submitted && error ? <Text style={styles.error}>{error}</Text> : null}
      {!fixedBooking ? (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.sub}>Confirmed or active bookings that have no driver yet.</Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            {assignable.length === 0 ? (
              <EmptyState compact title="Nothing to assign" message="Every confirmed or active booking already has a driver." />
            ) : (
              assignable.map((b) => (
                <Option
                  key={b.id}
                  selected={pickedBooking === b.id}
                  label={`Booking ${b.id}, ${b.customerName}`}
                  title={`${b.id} · ${b.customerName}`}
                  subtitle={`${b.vehicleName} (${b.vehicleNumber}) · ${formatDate(b.pickupDate)} → ${formatDate(b.returnDate)}`}
                  right={<StatusBadge status={b.status} />}
                  onPress={() => setPickedBooking(b.id)}
                />
              ))
            )}
          </View>
        </View>
      ) : null}
      {!fixedDriver ? (
        <View style={{ gap: 8 }}>
          <Text style={[styles.sub, { color: colors.txt, fontWeight: '700' }]}>Driver</Text>
          {drivers.map((d) => {
            const ls = licenceState(d.licenseExpiry, today);
            return (
              <Option
                key={d.id}
                selected={pickedDriver === d.id}
                label={`Driver ${d.name}`}
                title={d.name}
                subtitle={`${d.dutyStatus} · licence ${formatDate(d.licenseExpiry)}`}
                right={ls.tone !== 'success' ? <Badge label={ls.label} tone={ls.tone} /> : <StatusBadge status={d.dutyStatus} />}
                onPress={() => setPickedDriver(d.id)}
              />
            );
          })}
        </View>
      ) : null}
    </FormSheet>
  );
}

function Option({ selected, label, title, subtitle, right, onPress }: { selected: boolean; label: string; title: string; subtitle: string; right: React.ReactNode; onPress: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.option, selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
      {selected ? <CheckCircle2 size={18} color={colors.primaryText} /> : <Circle size={18} color={colors.muted} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      {right}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    name: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    sub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 1,
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 10,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
    },
  });
