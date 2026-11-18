import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { heldPeriods } from '../../lib/availability';
import {
  Users,
  Settings,
  Fuel,
  Car,
  Check,
  ShieldCheck,
  Navigation,
  KeyRound,
  Headphones,
  Sparkles,
  Truck,
  CalendarClock,
  FileCheck2,
  CarFront,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import {
  Screen,
  PageHeader,
  Card,
  Section,
  Grid,
  SplitView,
  ActionBar,
  Button,
  Badge,
  SegmentedControl,
  Divider,
  EmptyState,
  VehiclePhoto,
  VEHICLE_PHOTO_ASPECT,
} from '../../components/kit';
import { customerAvailability } from '../../components/ui/CarCard';
import { useResponsive } from '../../hooks/useResponsive';
import { computeQuote, PRICING_RULES } from '../../lib/pricing';
import { formatDate, formatINR } from '../../lib/format';
import { RentalTerm } from '../../types';

const TERMS = ['Daily', 'Weekly', 'Monthly'] as const;
const TERM_UNIT: Record<RentalTerm, string> = { Daily: 'day', Weekly: 'week', Monthly: 'month' };

const PERKS = [
  { label: 'Comprehensive insurance included', Icon: ShieldCheck },
  { label: 'Unlimited kilometres, no mileage caps', Icon: Navigation },
  { label: 'Doorstep delivery and pickup', Icon: Truck },
  { label: 'Sanitized and inspected before handover', Icon: Sparkles },
  { label: 'Keyless smartphone unlock', Icon: KeyRound },
  { label: '24/7 roadside assistance', Icon: Headphones },
];

export default function VehicleDetailsScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop, cols } = useResponsive();
  const { vehicles, bookings, setBookingDraft, today } = useApp();
  const [term, setTerm] = useState<RentalTerm>('Daily');

  const vehicle = vehicles.find((v) => v.id === id);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as any));

  // Earliest date a booked car is expected back (no customer details are exposed)
  const nextFree = useMemo(() => {
    if (!vehicle) return null;
    const dates = bookings
      .filter((b) => b.vehicleId === vehicle.id && (b.status === 'Active' || b.status === 'Confirmed'))
      .map((b) => b.returnDate)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }, [bookings, vehicle]);

  if (!vehicle || vehicle.status === 'Sold') {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
        <Screen>
          <PageHeader title="Vehicle not found" back={goBack} />
          <Card style={{ marginTop: 16 }}>
            <EmptyState
              title="This car is no longer available"
              message="It may have been removed from the fleet. Browse other cars instead."
              icon={(c) => <Car size={22} color={c} />}
              action={<Button label="Browse fleet" onPress={() => router.replace('/(tabs)/explore' as any)} />}
            />
          </Card>
        </Screen>
      </View>
    );
  }

  const { label: availability, bookable } = customerAvailability(vehicle);
  const held = heldPeriods(bookings, vehicle.id, today);
  const days = PRICING_RULES.minDays[term];
  const quote = computeQuote(vehicle, days, term);
  const allTerms = TERMS.map((t) => ({ t, q: computeQuote(vehicle, PRICING_RULES.minDays[t], t) }));
  const subtitle = [vehicle.brand, vehicle.type].filter(Boolean).join(' · ');

  const handleBook = () => {
    setBookingDraft((prev) => ({ ...prev, term }));
    router.push(`/booking?vehicleId=${encodeURIComponent(vehicle.id)}` as any);
  };

  const specs = [
    { label: 'Seats', value: `${vehicle.seats} seats`, Icon: Users },
    { label: 'Transmission', value: vehicle.transmission === 'Auto' ? 'Automatic' : 'Manual', Icon: Settings },
    { label: 'Fuel', value: vehicle.fuel, Icon: Fuel },
    { label: 'Category', value: vehicle.type, Icon: CarFront },
  ];

  const hero = (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={[styles.heroArea, { aspectRatio: VEHICLE_PHOTO_ASPECT }]}>
        <VehiclePhoto
          source={vehicle.imageAsset}
          style={StyleSheet.absoluteFill}
          radius={0}
          accessibilityLabel={`${vehicle.name} photo`}
        />
        {vehicle.badge ? (
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>{vehicle.badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.heroFoot}>
        <View style={styles.swatchRow}>
          <View style={[styles.swatch, { backgroundColor: vehicle.color }]} />
          <Text style={styles.swatchText}>Colour as pictured. Exact car may vary within the same model.</Text>
        </View>
        {vehicle.photoCredit ? (
          <Text
            style={styles.creditText}
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(vehicle.photoCredit!.url)}>
            Photo: {vehicle.photoCredit.author} · {vehicle.photoCredit.license} · Wikimedia Commons
          </Text>
        ) : null}
      </View>
    </Card>
  );

  const main = (
    <View>
      {hero}

      <Section title="Specifications">
        <Grid cols={cols(2, 4, 4)} gap={12}>
          {specs.map((s) => (
            <Card key={s.label} style={styles.specCard}>
              <View style={styles.specIcon}>
                <s.Icon size={18} color={colors.primaryText} />
              </View>
              <Text style={styles.specLabel}>{s.label}</Text>
              <Text style={styles.specVal}>{s.value}</Text>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section title="Included with every rental">
        <Card>
          <Grid cols={cols(1, 2, 2)} gap={4}>
            {PERKS.map((p) => (
              <View key={p.label} style={styles.perkRow}>
                <View style={styles.perkIcon}>
                  <p.Icon size={15} color={colors.secondaryText} />
                </View>
                <Text style={styles.perkText}>{p.label}</Text>
              </View>
            ))}
          </Grid>
        </Card>
      </Section>

      <Section title="Good to know">
        <Card>
          {[
            { t: 'Documents at pickup', d: 'Valid driving licence and a government ID. Upload them once in your profile.', Icon: FileCheck2 },
            {
              t: 'Refundable security deposit',
              d: `${formatINR(quote.deposit)} held for this category and refunded after the return inspection, less any tolls, fines or damage.`,
              Icon: ShieldCheck,
            },
            { t: 'Fuel / charge policy', d: 'Configurable — final policy pending business rules.', Icon: Fuel },
          ].map((row, i) => (
            <View key={row.t} style={[styles.knowRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
              <row.Icon size={18} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Text style={styles.knowTitle}>{row.t}</Text>
                <Text style={styles.knowDesc}>{row.d}</Text>
              </View>
            </View>
          ))}
        </Card>
      </Section>
    </View>
  );

  const side = (
    <View>
      <Section title="Price by term" style={isDesktop ? { marginTop: 0 } : undefined}>
        <Card>
          <SegmentedControl options={TERMS} value={term} onChange={setTerm} style={{ alignSelf: 'stretch' }} />
          <View style={{ marginTop: 14 }}>
            <Text style={styles.quoteHead}>
              {formatINR(quote.total)}
              <Text style={styles.quoteUnit}> / {TERM_UNIT[term]} incl. tax</Text>
            </Text>
            <Text style={styles.quoteSub}>
              {days} {days === 1 ? 'day' : 'days'} at {formatINR(Math.round(quote.subtotal / days))}/day effective
            </Text>
          </View>
          <Divider />
          <PriceLine label={`${formatINR(vehicle.pricePerDay)} × ${days} ${days === 1 ? 'day' : 'days'}`} value={formatINR(quote.base)} />
          {quote.termDiscount > 0 ? (
            <PriceLine label={`${term} rate saving (${Math.round((quote.termDiscount / quote.base) * 100)}%)`} value={formatINR(-quote.termDiscount)} positive />
          ) : null}
          <PriceLine label={`GST (${Math.round(PRICING_RULES.taxRate * 100)}%)`} value={formatINR(quote.tax)} />
          <Divider />
          <PriceLine label="Total" value={formatINR(quote.total)} strong />
          <PriceLine label="Refundable deposit" value={formatINR(quote.deposit)} muted />
          <Text style={styles.fine}>Sample pricing — final rates and taxes are confirmed at booking.</Text>
        </Card>

        <Card tone="soft" style={{ marginTop: 12 }}>
          <Text style={styles.compareTitle}>Compare terms</Text>
          {allTerms.map(({ t, q }) => (
            <View key={t} style={styles.compareRow}>
              <Text style={[styles.compareLabel, t === term && { fontWeight: '800', color: colors.txt }]}>
                {t} ({PRICING_RULES.minDays[t]} {PRICING_RULES.minDays[t] === 1 ? 'day' : 'days'})
              </Text>
              <Text style={styles.compareVal}>{formatINR(Math.round(q.subtotal / q.days))}/day</Text>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Availability" subtitle={held.length ? `Booked: ${held.map((h) => `${formatDate(h.from, false)} – ${formatDate(h.to, false)}`).join(', ')}` : 'No upcoming bookings'}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CalendarClock size={20} color={bookable ? colors.success : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.availTitle}>{bookable ? 'Ready to book' : 'Not bookable right now'}</Text>
              <Text style={styles.knowDesc}>
                {bookable
                  ? 'Pick your dates on the next step. Pickup reminder is sent 2 days before.'
                  : nextFree
                    ? `Currently booked. Expected back around ${formatDate(nextFree)}.`
                    : vehicle.status === 'Maintenance'
                      ? 'This car is being serviced. Check back soon or choose a similar car.'
                      : 'Check back soon or choose a similar car.'}
              </Text>
            </View>
            <Badge label={availability} tone={bookable ? 'success' : 'neutral'} />
          </View>
          {!bookable ? (
            <Button
              label="See similar cars"
              variant="outline"
              size="sm"
              style={{ marginTop: 12 }}
              onPress={() => router.push('/(tabs)/explore' as any)}
            />
          ) : null}
        </Card>
      </Section>
    </View>
  );

  const footer = (
    <View style={{ paddingBottom: insets.bottom }}>
      <ActionBar>
        <View style={{ flex: 1 }}>
          <Text style={styles.barLabel}>{term} · {days} {days === 1 ? 'day' : 'days'}</Text>
          <Text style={styles.barPrice}>
            {formatINR(quote.total)}
            <Text style={styles.quoteUnit}> incl. tax</Text>
          </Text>
        </View>
        <Button
          label={bookable ? 'Book this car' : 'Unavailable'}
          size="lg"
          disabled={!bookable}
          onPress={handleBook}
          icon={bookable ? (c) => <Check size={16} color={c} /> : undefined}
          accessibilityHint={bookable ? 'Continue to booking' : 'This car cannot be booked right now'}
        />
      </ActionBar>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
      <Screen footer={footer} bottomInset={32}>
        <PageHeader
          eyebrow="Vehicle details"
          title={vehicle.name}
          subtitle={subtitle}
          back={goBack}
          actions={<Badge label={availability} tone={bookable ? 'success' : 'neutral'} />}
        />
        <View style={{ marginTop: 12 }}>
          <SplitView main={main} side={side} sideWidth={380} />
        </View>
      </Screen>
    </View>
  );
}

function PriceLine({ label, value, strong, muted, positive }: { label: string; value: string; strong?: boolean; muted?: boolean; positive?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.priceLine}>
      <Text style={[styles.priceLabel, strong && { color: colors.txt, fontWeight: '800' }]}>{label}</Text>
      <Text
        style={[
          styles.priceValue,
          strong && { fontSize: 16, fontWeight: '800' },
          muted && { color: colors.muted },
          positive && { color: colors.success },
        ]}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    heroArea: {
      backgroundColor: colors.bg2,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    heroGlow: {
      position: 'absolute',
      width: '60%',
      height: '40%',
      bottom: '18%',
      borderRadius: 999,
      opacity: 0.12,
    },
    heroImg: {
      width: '100%',
      height: '100%',
    },
    badgePill: {
      position: 'absolute',
      top: 12,
      left: 12,
      backgroundColor: colors.highlightSoft,
      borderWidth: 1,
      borderColor: colors.highlight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgePillText: {
      color: colors.onHighlight,
      fontSize: 11,
      fontWeight: '800',
    },
    heroFoot: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    swatchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    swatch: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.lineStrong,
    },
    swatchText: {
      color: colors.muted,
      fontSize: 12,
      flex: 1,
    },
    creditText: {
      color: colors.muted,
      fontSize: 10,
      marginTop: 6,
      textDecorationLine: 'underline',
    },
    specCard: {
      padding: 14,
    },
    specIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    specLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    specVal: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 2,
    },
    perkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    perkIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: colors.secondarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    perkText: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    knowRow: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 12,
    },
    knowTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    knowDesc: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    quoteHead: {
      color: colors.txt,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    quoteUnit: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '500',
      letterSpacing: 0,
    },
    quoteSub: {
      color: colors.secondaryText,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 2,
    },
    priceLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
      gap: 12,
    },
    priceLabel: {
      color: colors.muted,
      fontSize: 13,
      flex: 1,
    },
    priceValue: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    fine: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 10,
      lineHeight: 15,
    },
    compareTitle: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 6,
    },
    compareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    compareLabel: {
      color: colors.muted,
      fontSize: 13,
    },
    compareVal: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    availTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
    },
    barLabel: {
      color: colors.muted,
      fontSize: 12,
    },
    barPrice: {
      color: colors.txt,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
  });
