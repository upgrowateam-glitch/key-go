import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bell, CheckCircle2, Send } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, StatusBadge, Tone, VehiclePhoto } from '../../components/kit';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { useApp } from '../../context/AppContext';
import { formatDate, formatINR, parseISODate, toISODate } from '../../lib/format';
import { reminderState } from '../../lib/lifecycle';
import type { Booking, BookingClassification, RentalPurpose, RentalTerm, Vehicle, VehicleType } from '../../types';

export const STATUS_FILTERS = ['All', 'Quoted', 'Confirmed', 'Active', 'Completed', 'Cancelled'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const TERMS: readonly RentalTerm[] = ['Daily', 'Weekly', 'Monthly'];
export const TERM_FILTERS = ['All', ...TERMS] as const;
export const PURPOSES: readonly RentalPurpose[] = ['Personal', 'Business', 'Outstation', 'Vacation'];
export const CLASSIFICATIONS: readonly BookingClassification[] = ['Online', 'Walk-in', 'Corporate', 'Repeat customer', 'Referral'];
export const CLASS_FILTERS = ['All', ...CLASSIFICATIONS] as const;
export const CATEGORIES: readonly VehicleType[] = ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Electric', 'Luxury'];
export const CATEGORY_FILTERS = ['All', ...CATEGORIES] as const;

export const CLASS_TONE: Record<BookingClassification, Tone> = {
  Online: 'info',
  'Walk-in': 'neutral',
  Corporate: 'primary',
  'Repeat customer': 'success',
  Referral: 'violet',
};

export const matchesStatus = (b: Booking, f: StatusFilter) =>
  f === 'All' || b.status === f || (f === 'Quoted' && b.status === 'Pending');

// ---------------------------------------------------------------- Reminder indicator

export function ReminderIndicator({ booking, compact }: { booking: Booking; compact?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { today } = useApp();
  const state = reminderState(booking, today);
  if (state === 'none') {
    return (
      <Text style={styles.muted} accessibilityLabel="No reminder">
        —
      </Text>
    );
  }
  if (state === 'sent') {
    return <Badge label="Reminder sent" tone="success" icon={(c) => <CheckCircle2 size={12} color={c} />} />;
  }
  const date = formatDate(booking.reminderScheduledFor ?? '', false);
  const dueToday = booking.reminderScheduledFor === today;
  return (
    <View
      style={styles.reminderChip}
      accessibilityLabel={`Pickup reminder scheduled for ${date}, two days before pickup`}>
      <Bell size={12} color={colors.onHighlight} />
      {compact ? (
        <View>
          <Text style={styles.reminderText}>Reminder{dueToday ? ' · today' : ''}</Text>
          <Text style={styles.reminderSub}>{date} (T-2)</Text>
        </View>
      ) : (
        <Text style={styles.reminderText}>
          Reminder · {date} (T-2){dueToday ? ' · due today' : ''}
        </Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Small helpers

export function VehicleThumb({ vehicle, width = 56 }: { vehicle?: Vehicle; width?: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.thumb, { width, height: width * 0.62 }]}>
      <VehiclePhoto source={vehicle?.imageAsset} style={{ width: '100%', height: '100%' }} radius={0} />
    </View>
  );
}

export function sendReminderLabel(b: Booking) {
  if (b.status === 'Active') return 'Send return reminder';
  if (b.status === 'Confirmed' || b.status === 'Quoted' || b.status === 'Pending') return 'Send pickup reminder';
  return null;
}

// ---------------------------------------------------------------- Phone / tablet card

export function BookingCard({ booking, vehicle, onPress, onSendReminder }: { booking: Booking; vehicle?: Vehicle; onPress: () => void; onSendReminder: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const b = booking;
  const reminderLabel = sendReminderLabel(b);
  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardId}>{b.id}</Text>
          <Text style={styles.cardSub}>Reserved {formatDate(b.createdAt)}</Text>
        </View>
        <StatusBadge status={b.status} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={b.customerName} size={34} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.strong} numberOfLines={1}>
            {b.customerName}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {b.customerPhone || 'No phone on file'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <VehicleThumb vehicle={vehicle} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.strong} numberOfLines={1}>
            {b.vehicleName}
          </Text>
          <Text style={styles.cardSub} numberOfLines={1}>
            {b.vehicleNumber} · {b.vehicleCategory}
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kvLabel}>Pickup</Text>
          <Text style={styles.kvValue}>{formatDate(b.pickupDate)}</Text>
          <Text style={styles.cardSub}>{b.pickupTime}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kvLabel}>Return</Text>
          <Text style={styles.kvValue}>{formatDate(b.returnDate)}</Text>
          <Text style={styles.cardSub}>{b.returnTime}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Badge label={`${b.term} · ${b.days}d`} tone="neutral" />
        <Badge label={b.purpose} tone="neutral" />
        <Badge label={b.classification} tone={CLASS_TONE[b.classification]} />
      </View>

      <View style={[styles.rowBetween, { alignItems: 'center', flexWrap: 'wrap', gap: 8 }]}>
        <View>
          <Text style={styles.kvLabel}>Amount</Text>
          <Text style={styles.amount}>{formatINR(b.totalAmount)}</Text>
        </View>
        <ReminderIndicator booking={b} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button label="Open booking" variant="outline" size="sm" onPress={onPress} />
        {reminderLabel ? (
          <Button
            label={`${reminderLabel} (preview)`}
            variant="ghost"
            size="sm"
            icon={(c) => <Send size={14} color={c} />}
            onPress={onSendReminder}
          />
        ) : null}
      </View>
    </Card>
  );
}

export function QuoteLine({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'discount' }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.quoteLine}>
      <Text style={[styles.quoteLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.quoteValue, strong && styles.quoteTotal, tone === 'discount' && { color: colors.secondaryText }]}>{value}</Text>
    </View>
  );
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;
export const validDate = (s: string) => {
  const d = DATE_RE.test(s) ? parseISODate(s) : null;
  return !!d && toISODate(d) === s;
};

/** Links a sent reminder to its booking: the delivery log lives in AppContext and survives switching tabs. */
export function reminderPreview(b: Booking) {
  return b.status === 'Active'
    ? `KeyGo: Return reminder for ${b.id} on ${formatDate(b.returnDate, false)} at ${b.returnTime}`
    : `KeyGo: Pickup reminder for ${b.id} on ${formatDate(b.pickupDate, false)} at ${b.pickupTime}`;
}

export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    muted: { color: colors.muted, fontSize: 13 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    strong: { color: colors.txt, fontSize: 14, fontWeight: '700' },
    cardId: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    cardSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
    kvLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 2 },
    kvValue: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    amount: { color: colors.txt, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
    dateRow: { flexDirection: 'row', gap: 12, backgroundColor: colors.bg, borderRadius: 12, padding: 10 },
    thumb: {
      borderRadius: 8,
      backgroundColor: colors.bg2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    cell: { color: colors.txt, fontSize: 13 },
    cellStrong: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    cellSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
    reminderChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: colors.highlightSoft,
      borderColor: colors.highlight,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexShrink: 1,
    },
    reminderText: { color: colors.onHighlight, fontSize: 11, fontWeight: '700', flexShrink: 1 },
    reminderSub: { color: colors.onHighlight, fontSize: 10, fontWeight: '600' },
    sendBtn: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    formHeading: { color: colors.txt, fontSize: 14, fontWeight: '800', marginBottom: 10 },
    fieldLabel: { color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    hint: { color: colors.muted, fontSize: 11, marginTop: 6, lineHeight: 15 },
    link: { color: colors.primaryText, fontSize: 12, fontWeight: '700', marginTop: 4 },
    errorText: { color: colors.danger, fontSize: 11, fontWeight: '600', marginTop: 4 },
    pickList: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden' },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      backgroundColor: colors.card,
    },
    pickRowActive: { backgroundColor: colors.primarySoft },
    quoteLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
    quoteLabel: { color: colors.muted, fontSize: 13, flex: 1 },
    quoteValue: { color: colors.txt, fontSize: 13, fontWeight: '600' },
    quoteTotal: { fontSize: 17, fontWeight: '800', color: colors.txt },
    quoteDivider: { height: 1, backgroundColor: colors.secondaryBorder, marginVertical: 6 },
  });
