import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Calendar, CalendarCheck, ChevronRight, MapPin, Search, User } from 'lucide-react-native';
import { Button, Field, FormSheet } from '../kit';
import { boxShadow, useThemedStyles, useThemeColors, type ThemeColors } from '../../theme';
import { useApp } from '../../context/AppContext';

const RENTAL_TYPES = [
  { key: 'Daily', label: 'Daily rental', Icon: CalendarCheck, filled: false },
  { key: 'Monthly', label: 'Monthly', Icon: CalendarCheck, filled: false },
  { key: 'With Driver', label: 'With Driver', Icon: User, filled: true },
] as const;
type RentalType = (typeof RENTAL_TYPES)[number]['key'];

const QUICK_LOCATIONS = ['Bengaluru International Airport (BLR)', 'KeyGo Hub, Indiranagar', 'Koramangala', 'MG Road'];

export function RentalPlanner({ onSearch }: { onSearch: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { bookingDraft, setBookingDraft } = useApp();
  const [type, setType] = useState<RentalType>('Daily');
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');

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
      {/* Faint street-map lines in the corner, decorative only */}
      <Svg width={170} height={120} viewBox="0 0 170 120" style={styles.map}>
        <Path d="M10 0 C40 30 60 40 70 120 M0 55 H170 M95 0 L120 120 M60 20 C100 30 130 10 170 30 M40 95 C80 80 120 100 170 85 M140 0 L150 120" stroke={colors.lineStrong} strokeWidth={6} fill="none" opacity={0.35} />
        <Path d="M10 0 C40 30 60 40 70 120 M0 55 H170 M95 0 L120 120 M60 20 C100 30 130 10 170 30 M40 95 C80 80 120 100 170 85 M140 0 L150 120" stroke={colors.card} strokeWidth={4} fill="none" />
      </Svg>
      <View style={styles.titleRow}>
        <View style={styles.titleBar} />
        <Text style={styles.title} accessibilityRole="header">
          Plan your rental
        </Text>
      </View>
      <View style={styles.subRow}>
        <View style={styles.subBar} />
        <Text style={styles.sub}>Choose the best option for your journey</Text>
      </View>

      <View style={styles.types} accessibilityRole="radiogroup">
        {RENTAL_TYPES.map(({ key, label, Icon, filled }) => {
          const active = type === key;
          return (
            <TouchableOpacity
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={[styles.type, active && styles.typeActive]}
              onPress={() => {
                setType(key);
                setBookingDraft((prev) => ({ ...prev, term: key === 'Monthly' ? 'Monthly' : 'Daily' }));
              }}>
              <Icon size={15} color={active ? colors.onPrimary : colors.primaryText} fill={filled ? (active ? colors.onPrimary : colors.primaryText) : 'none'} />
              <Text style={[styles.typeText, active && { color: colors.onPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.locationLabel}>
        <MapPin size={16} color={colors.card} fill={colors.primaryText} />
        <Text style={styles.label}>Pick-up location</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Pick-up location: ${bookingDraft.pickupLocation || 'not set'}. Change`} style={styles.location} onPress={openLocation}>
        <MapPin size={19} color={colors.primaryText} />
        <Text style={[styles.locationText, !bookingDraft.pickupLocation && { color: colors.muted }]} numberOfLines={1}>
          {bookingDraft.pickupLocation || 'City, airport or address'}
        </Text>
        <ChevronRight size={20} color={colors.txt} />
      </TouchableOpacity>

      <View style={styles.dates}>
        <Field
          style={{ flex: 1 }}
          label="Pick-up date"
          value={bookingDraft.pickupDate}
          onChangeText={(text) => setBookingDraft((prev) => ({ ...prev, pickupDate: text }))}
          placeholder="YYYY-MM-DD"
          left={<Calendar size={15} color={colors.primaryText} />}
        />
        <Field
          style={{ flex: 1 }}
          label="Return date"
          value={bookingDraft.returnDate}
          onChangeText={(text) => setBookingDraft((prev) => ({ ...prev, returnDate: text }))}
          placeholder="YYYY-MM-DD"
          left={<Calendar size={15} color={colors.primaryText} />}
        />
      </View>
      <Button label="Search available cars" size="lg" fullWidth onPress={onSearch} icon={(c) => <Search size={16} color={c} />} />

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
      padding: 18,
      overflow: 'hidden',
      ...boxShadow(colors.shadow, { y: 6, blur: 14, opacity: 0.08 }),
      elevation: 2,
    },
    map: { position: 'absolute', top: 0, right: 0, pointerEvents: 'none' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    titleBar: { width: 4, height: 24, borderRadius: 2, backgroundColor: colors.primary },
    title: { color: colors.txt, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    subBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.secondaryBorder },
    sub: { color: colors.txt, fontSize: 13 },
    types: { flexDirection: 'row', gap: 6, marginTop: 16 },
    type: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 4,
      paddingVertical: 13,
      borderRadius: 999,
      backgroundColor: colors.bg2,
      minWidth: 0,
    },
    typeActive: { backgroundColor: colors.primary },
    typeText: { color: colors.txt, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
    locationLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 10 },
    label: { color: colors.txt, fontSize: 14, fontWeight: '700' },
    location: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 15,
      marginBottom: 14,
      ...boxShadow(colors.shadow, { y: 2, blur: 6, opacity: 0.06 }),
      elevation: 1,
    },
    locationText: { flex: 1, color: colors.txt, fontSize: 13.5 },
    dates: { flexDirection: 'row', gap: 10 },
    quick: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.line },
    quickText: { color: colors.txt, fontSize: 14 },
  });
