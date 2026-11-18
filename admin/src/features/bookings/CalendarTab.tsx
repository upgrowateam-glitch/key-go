import { useRouter } from '@/shims/expo-router';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Card, ChipGroup, EmptyState, IconButton, Legend, ListRow, Section, SegmentedControl, StatusBadge, statusTone, toneColors } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR } from '../../lib/format';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking } from '../../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const VIEWS = ['By day', 'By vehicle'] as const;
const LEGEND_STATUSES = ['Quoted', 'Confirmed', 'Active', 'Completed'] as const;
const MAX_CHIPS = 3;
const VEHICLE_DAY_WIDTH = 30;

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const occupies = (b: Booking, iso: string) => b.pickupDate <= iso && iso <= b.returnDate;

export function CalendarTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { bookings, vehicles, today } = useApp();

  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)) - 1);
  const [view, setView] = useState<(typeof VIEWS)[number]>('By day');
  const [vehicleId, setVehicleId] = useState('all');
  const [selected, setSelected] = useState(today);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
    setSelected(isoDay(d.getUTCFullYear(), d.getUTCMonth(), 1));
  };
  const goToToday = () => {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)) - 1);
    setSelected(today);
  };

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, i) => isoDay(year, month, i + 1));
  const cells: (string | null)[] = [...Array(leadingBlanks).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  const visible = useMemo(() => bookings.filter((b) => b.status !== 'Cancelled' && (vehicleId === 'all' || b.vehicleId === vehicleId)), [bookings, vehicleId]);
  const selectedBookings = visible.filter((b) => occupies(b, selected));
  const openBooking = (b: Booking) => router.push(`/bookings/${encodeURIComponent(b.id)}` as any);

  const vehicleOptions = useMemo(() => ['all', ...vehicles.filter((v) => v.status !== 'Sold').map((v) => v.id)], [vehicles]);
  const vehicleLabels = useMemo(() => {
    const labels: Record<string, string> = { all: 'All vehicles' };
    vehicles.forEach((v) => (labels[v.id] = v.vehicleNumber));
    return labels;
  }, [vehicles]);

  const toneOf = (status: string) => toneColors(colors, statusTone(status));

  const dayGrid = (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {isPhone ? w[0] : w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={`blank-${i}`} style={[styles.cell, styles.cellBlank]} />;
          const dayBookings = visible.filter((b) => occupies(b, iso));
          const isSelected = iso === selected;
          return (
            <TouchableOpacity
              key={iso}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${formatDate(iso)}, ${dayBookings.length} booking${dayBookings.length === 1 ? '' : 's'}`}
              onPress={() => setSelected(iso)}
              style={[styles.cell, isPhone && { minHeight: 56 }, isSelected && styles.cellSelected]}>
              <Text style={[styles.dayNumber, iso === today && styles.dayToday]}>{Number(iso.slice(8))}</Text>
              {isPhone ? (
                dayBookings.length ? <Text style={styles.count}>{dayBookings.length}</Text> : null
              ) : (
                <>
                  {dayBookings.slice(0, MAX_CHIPS).map((b) => {
                    const t = toneOf(b.status);
                    return (
                      <TouchableOpacity
                        key={b.id}
                        accessibilityRole="link"
                        accessibilityLabel={`Open booking ${b.id}, ${b.customerName}`}
                        onPress={() => openBooking(b)}
                        style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
                        <Text style={[styles.chipText, { color: t.text }]} numberOfLines={1}>
                          {b.id} · {b.vehicleNumber}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {dayBookings.length > MAX_CHIPS ? <Text style={styles.more}>+{dayBookings.length - MAX_CHIPS} more</Text> : null}
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );

  const shownVehicles = vehicles.filter((v) => v.status !== 'Sold' && (vehicleId === 'all' || v.id === vehicleId));
  const vehicleGrid = (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      {shownVehicles.length === 0 ? (
        <EmptyState compact title="No vehicles" message="Add a vehicle to see its bookings here." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.vehicleRow}>
              <View style={styles.vehicleLabel} />
              {days.map((iso) => (
                <TouchableOpacity key={iso} accessibilityRole="button" accessibilityLabel={formatDate(iso)} onPress={() => setSelected(iso)} style={styles.vehicleDayHead}>
                  <Text style={[styles.vehicleDayText, iso === today && styles.dayToday, iso === selected && { color: colors.primaryText, fontWeight: '800' }]}>{Number(iso.slice(8))}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {shownVehicles.map((v) => {
              const own = visible.filter((b) => b.vehicleId === v.id);
              return (
                <View key={v.id} style={styles.vehicleRow}>
                  <View style={styles.vehicleLabel}>
                    <Text style={styles.vehicleName} numberOfLines={1}>{v.name}</Text>
                    <Text style={styles.vehicleSub} numberOfLines={1}>{v.vehicleNumber}</Text>
                  </View>
                  {days.map((iso) => {
                    const b = own.find((x) => occupies(x, iso));
                    if (!b) return <View key={iso} style={styles.vehicleDay} />;
                    const t = toneOf(b.status);
                    return (
                      <TouchableOpacity
                        key={iso}
                        accessibilityRole="link"
                        accessibilityLabel={`${formatDate(iso)}: booking ${b.id}, ${b.customerName}`}
                        onPress={() => openBooking(b)}
                        style={[styles.vehicleDay, { backgroundColor: t.bg }]}>
                        <View style={[styles.vehicleMark, { backgroundColor: t.text }]} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Card>
  );

  return (
    <View>
      <Card style={{ gap: 12, marginBottom: 12 }}>
        <View style={styles.toolbar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton label="Previous month" onPress={() => shift(-1)} icon={(c) => <ChevronLeft size={18} color={c} />} />
            <Text style={styles.monthTitle} accessibilityRole="header">
              {MONTHS[month]} {year}
            </Text>
            <IconButton label="Next month" onPress={() => shift(1)} icon={(c) => <ChevronRight size={18} color={c} />} />
            <Button label="Today" variant="ghost" size="sm" onPress={goToToday} />
          </View>
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />
        </View>
        <ChipGroup options={vehicleOptions} value={vehicleId} onChange={setVehicleId} labels={vehicleLabels} scroll />
        <Legend items={LEGEND_STATUSES.map((s) => ({ label: s, color: toneOf(s).text }))} />
      </Card>

      {view === 'By day' ? dayGrid : vehicleGrid}

      <Section title={formatDate(selected)} subtitle={`${selectedBookings.length} booking${selectedBookings.length === 1 ? '' : 's'} on this day`}>
        <Card style={{ paddingVertical: 4 }}>
          {selectedBookings.length === 0 ? (
            <EmptyState compact title="Nothing booked" message="Select another day, or create a booking." icon={(c) => <CalendarDays size={22} color={c} />} action={<Button label="Create booking" size="sm" onPress={() => router.push('/bookings?tab=create-booking' as any)} />} />
          ) : (
            selectedBookings.map((b, i) => (
              <ListRow
                key={b.id}
                title={`${b.id} · ${b.customerName}`}
                subtitle={`${b.vehicleName} (${b.vehicleNumber}) · ${formatDate(b.pickupDate, false)} ${b.pickupTime} – ${formatDate(b.returnDate, false)} ${b.returnTime} · ${formatINR(b.totalAmount)}`}
                right={<StatusBadge status={b.status} />}
                onPress={() => openBooking(b)}
                style={i === selectedBookings.length - 1 ? { borderBottomWidth: 0 } : undefined}
              />
            ))
          )}
        </Card>
      </Section>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
    monthTitle: { color: colors.txt, fontSize: 16, fontWeight: '800', minWidth: 140, textAlign: 'center' },
    weekRow: { flexDirection: 'row', backgroundColor: colors.secondarySoft, borderBottomWidth: 1, borderBottomColor: colors.line },
    weekday: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 8, color: colors.txt, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, minHeight: 104, padding: 6, gap: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
    cellBlank: { backgroundColor: colors.bg },
    cellSelected: { backgroundColor: colors.primarySoft },
    dayNumber: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    dayToday: { color: colors.primaryText, fontWeight: '800', textDecorationLine: 'underline' },
    count: { color: colors.primaryText, fontSize: 12, fontWeight: '800' },
    chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
    chipText: { fontSize: 10, fontWeight: '700' },
    more: { color: colors.muted, fontSize: 10, fontWeight: '600' },
    vehicleRow: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: colors.line },
    vehicleLabel: { width: 150, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.line },
    vehicleName: { color: colors.txt, fontSize: 12, fontWeight: '700' },
    vehicleSub: { color: colors.muted, fontSize: 11 },
    vehicleDayHead: { width: VEHICLE_DAY_WIDTH, paddingVertical: 8, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.secondarySoft },
    vehicleDayText: { color: colors.txt, fontSize: 11, fontWeight: '700' },
    vehicleDay: { width: VEHICLE_DAY_WIDTH, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.line },
    vehicleMark: { width: 14, height: 6, borderRadius: 3 },
  });
