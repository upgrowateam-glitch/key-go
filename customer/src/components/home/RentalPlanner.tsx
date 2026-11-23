import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ArrowRight, CalendarCheck, CalendarRange, ChevronRight, Clock3, MapPin, Search, UserRound } from 'lucide-react-native';
import { Button, Field, FormSheet } from '../kit';
import { boxShadow, useThemedStyles, useThemeColors, withAlpha, type ThemeColors } from '../../theme';
import { DateField } from '../ui/DateField';
import { addDaysYmd, textToYmd, todayYmd } from '../ui/DateCalendar';
import { daysBetween } from '../../lib/format';
import { useApp } from '../../context/AppContext';

const RENTAL_TYPES = [
  { key: 'Daily', label: 'Daily', hint: 'By the day', Icon: CalendarCheck },
  { key: 'Monthly', label: 'Monthly', hint: '30 days +', Icon: CalendarRange },
  { key: 'With Driver', label: 'With Driver', hint: 'We drive you', Icon: UserRound },
] as const;
type RentalType = (typeof RENTAL_TYPES)[number]['key'];

const QUICK_LOCATIONS = ['Bengaluru International Airport (BLR)', 'KeyGo Hub, Indiranagar', 'Koramangala', 'MG Road'];
const MAP = 'M10 0 C40 30 60 40 70 120 M0 55 H170 M95 0 L120 120 M60 20 C100 30 130 10 170 30 M40 95 C80 80 120 100 170 85 M140 0 L150 120';

/**
 * Home "Plan your rental" card: a green header, the rental type as three tiles, then the trip (pick-up place, pick-up
 * and return dates with the trip length) in one panel, and the search button.
 */
export function RentalPlanner({ onSearch }: { onSearch: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { bookingDraft, setBookingDraft } = useApp();
  const [type, setType] = useState<RentalType>('Daily');
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
  const days = daysBetween(bookingDraft.pickupDate, bookingDraft.returnDate);

  const openLocation = () => {
    setLocationDraft(bookingDraft.pickupLocation);
    setLocationOpen(true);
  };
  const saveLocation = (value: string) => {
    setBookingDraft((prev) => ({ ...prev, pickupLocation: value.trim() }));
    setLocationOpen(false);
  };

  return (
    <View style={styles.card}>
      {/* green header with faint street-map lines */}
      <View style={styles.head}>
        <Svg width={190} height={120} viewBox="0 0 170 120" style={styles.map}>
          <Path d={MAP} stroke={colors.onPrimary} strokeWidth={5} fill="none" opacity={0.12} />
        </Svg>
        <View style={styles.headIcon}>
          <MapPin size={18} color={colors.onHighlight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">
            Plan your rental
          </Text>
          <Text style={styles.sub}>Choose the best option for your journey</Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* rental type */}
        <View style={styles.types} accessibilityRole="radiogroup">
          {RENTAL_TYPES.map(({ key, label, hint, Icon }) => {
            const active = type === key;
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityState={{ checked: active }}
                activeOpacity={0.85}
                style={[styles.type, active && styles.typeActive]}
                onPress={() => {
                  setType(key);
                  setBookingDraft((prev) => ({ ...prev, term: key === 'Monthly' ? 'Monthly' : 'Daily' }));
                }}>
                <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                  <Icon size={17} color={active ? colors.onPrimary : colors.primaryText} />
                </View>
                <Text style={[styles.typeText, active && styles.typeTextActive]} numberOfLines={1} adjustsFontSizeToFit>
                  {label}
                </Text>
                <Text style={styles.typeHint} numberOfLines={1}>
                  {hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* the trip: where, from, to */}
        <View style={styles.trip}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Pick-up location: ${bookingDraft.pickupLocation || 'not set'}. Change`}
            style={styles.location}
            activeOpacity={0.8}
            onPress={openLocation}>
            <View style={styles.pin}>
              <MapPin size={17} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.smallCaps}>Pick-up location</Text>
              <Text style={[styles.locationText, !bookingDraft.pickupLocation && { color: colors.muted }]} numberOfLines={1}>
                {bookingDraft.pickupLocation || 'City, airport or address'}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={styles.dates}>
            <DateField
              tile
              style={{ flex: 1 }}
              label="Pick-up date"
              value={bookingDraft.pickupDate}
              onChange={(text) => setBookingDraft((prev) => ({ ...prev, pickupDate: text }))}
              min={todayYmd()}
            />
            <View style={styles.arrow}>
              <ArrowRight size={15} color={colors.primaryText} />
            </View>
            <DateField
              tile
              style={{ flex: 1 }}
              label="Return date"
              value={bookingDraft.returnDate}
              onChange={(text) => setBookingDraft((prev) => ({ ...prev, returnDate: text }))}
              min={addDaysYmd(textToYmd(bookingDraft.pickupDate) ?? todayYmd(), 1)}
              rangeFrom={textToYmd(bookingDraft.pickupDate)}
            />
          </View>
          {days > 0 ? (
            <View style={styles.length}>
              <Clock3 size={13} color={colors.primaryText} />
              <Text style={styles.lengthText}>
                {days} day{days === 1 ? '' : 's'} trip
              </Text>
            </View>
          ) : null}
        </View>

        <Button label="Search available cars" variant="highlight" size="lg" fullWidth onPress={onSearch} icon={(c) => <Search size={17} color={c} />} />
      </View>

      <FormSheet
        visible={locationOpen}
        title="Pick-up location"
        onClose={() => setLocationOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setLocationOpen(false)} />
            <Button label="Use this location" disabled={!locationDraft.trim()} onPress={() => saveLocation(locationDraft)} />
          </>
        }>
        <Field label="City, airport or address" value={locationDraft} onChangeText={setLocationDraft} left={<MapPin size={16} color={colors.primaryText} />} />
        {QUICK_LOCATIONS.map((place) => (
          <TouchableOpacity key={place} accessibilityRole="button" style={styles.quick} onPress={() => saveLocation(place)}>
            <MapPin size={15} color={colors.muted} />
            <Text style={styles.quickText}>{place}</Text>
          </TouchableOpacity>
        ))}
      </FormSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      ...boxShadow(colors.shadow, { y: 8, blur: 18, opacity: 0.1 }),
      elevation: 3,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
    map: { position: 'absolute', top: -10, right: -20, pointerEvents: 'none' },
    headIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.highlight },
    title: { color: colors.onPrimary, fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },
    sub: { color: withAlpha(colors.onPrimary, 0.78), fontSize: 13, lineHeight: 18, marginTop: 2 },
    body: { padding: 16, paddingTop: 16, gap: 14 },
    types: { flexDirection: 'row', gap: 8 },
    type: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.card,
    },
    typeActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2, marginBottom: 7 },
    typeIconActive: { backgroundColor: colors.primary },
    typeText: { color: colors.txt, fontSize: 13, lineHeight: 17, fontWeight: '700' },
    typeTextActive: { color: colors.primaryText, fontWeight: '800' },
    typeHint: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 1 },
    trip: { backgroundColor: colors.bg, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 10 },
    location: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    pin: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
    smallCaps: { color: colors.muted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
    locationText: { color: colors.txt, fontSize: 14.5, lineHeight: 20, fontWeight: '700', marginTop: 2 },
    dates: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    arrow: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
    },
    length: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.highlightSoft,
    },
    lengthText: { color: colors.txt, fontSize: 12.5, fontWeight: '700' },
    quick: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line },
    quickText: { color: colors.txt, fontSize: 14 },
  });
