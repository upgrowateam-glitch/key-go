import React, { useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Heart, Users, Settings, Fuel, ChevronRight, ArrowRight, CheckCircle2, Clock, Wrench } from 'lucide-react-native';
import { Vehicle } from '../../types';
import { VehiclePhoto, VEHICLE_PHOTO_ASPECT } from '../kit';
import { boxShadow, useThemeColors, useThemedStyles, BRAND, type ThemeColors } from '../../theme';
import { Badge, Button } from '../kit/controls';
import { formatINR } from '../../lib/format';

// On web a role of button renders a <button>, and these cards contain their own favourite button
const CARD_ROLE = Platform.OS === 'web' ? undefined : 'button';


interface CarCardProps {
  vehicle: Vehicle;
  /** Fixed width (carousels). Omit to fill the parent (grids). */
  cardWidth?: number;
  onPressRent?: (vehicle: Vehicle) => void;
  onPressDetails?: (vehicle: Vehicle) => void;
  /**
   * default = vertical photo card; compact = horizontal row with a small thumbnail;
   * catalog = browsing card with a large photo, status on the photo and a "View details" action.
   */
  variant?: 'default' | 'compact' | 'catalog';
}

/** Customer-facing availability label (never exposes fleet-internal states such as "Sold"). */
export function customerAvailability(v: Vehicle): { label: string; bookable: boolean } {
  switch (v.status) {
    case 'Available':
      return { label: 'Available', bookable: true };
    case 'Reserved':
    case 'On Rent':
      return { label: 'Booked', bookable: false };
    case 'Maintenance':
      return { label: 'In service', bookable: false };
    default:
      return { label: 'Unavailable', bookable: false };
  }
}

export const CarCard: React.FC<CarCardProps> = ({ vehicle, cardWidth, onPressRent, onPressDetails, variant = 'default' }) => {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [isFav, setIsFav] = useState(false);
  const { label: availability, bookable } = customerAvailability(vehicle);
  const source = vehicle.imageAsset;
  const subtitle = [vehicle.brand, vehicle.type].filter(Boolean).join(' · ');

  const openDetails = () => onPressDetails?.(vehicle);
  const onPrimary = () => (bookable ? onPressRent?.(vehicle) : onPressDetails?.(vehicle));

  if (variant === 'catalog') {
    const StatusIcon = bookable ? CheckCircle2 : vehicle.status === 'Maintenance' ? Wrench : Clock;
    const statusStyle = bookable ? styles.statusAvailable : vehicle.status === 'Maintenance' ? styles.statusService : styles.statusBooked;
    return (
      <TouchableOpacity
        activeOpacity={0.92}
        accessibilityRole={CARD_ROLE}
        accessibilityLabel={`${[vehicle.brand, vehicle.name].filter(Boolean).join(' ')}, ${formatINR(vehicle.pricePerDay)} per day, ${availability}`}
        onPress={openDetails}
        style={[styles.catalogCard, cardWidth ? { width: cardWidth } : null]}>
        <View style={styles.catalogPhoto}>
          <VehiclePhoto source={vehicle.imageAsset} style={StyleSheet.absoluteFill} radius={0} accessibilityLabel={`${vehicle.name} photo`} />
          {/* Unavailable cars are visibly dimmed so the state reads before any text */}
          {!bookable ? <View style={[styles.catalogDim, { pointerEvents: 'none' }]} /> : null}
          <View style={[styles.catalogPhotoTop, { pointerEvents: 'none' }]}>
            <View style={[styles.statusPill, statusStyle]}>
              <StatusIcon size={13} color={BRAND.white} />
              <Text style={styles.statusPillText}>{availability}</Text>
            </View>
            {vehicle.badge ? (
              <View style={styles.catalogBadge}>
                <Text style={styles.badgePillText}>{vehicle.badge}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.catalogBody}>
          <View style={styles.catalogTitleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.catalogTitle} numberOfLines={1}>
                {vehicle.name}
              </Text>
              <Text style={styles.carType} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.catalogPrice}>
                {formatINR(vehicle.pricePerDay)}
                <Text style={styles.priceUnit}> /day</Text>
              </Text>
            </View>
          </View>

          <View style={styles.catalogFoot}>
            <View style={styles.catalogSpecs}>
              <View style={styles.specItem} accessibilityLabel={`${vehicle.seats} seats`}>
                <Users size={13} color={colors.primaryText} />
                <Text style={styles.specText}>{vehicle.seats}</Text>
              </View>
              <View style={styles.specItem}>
                <Settings size={13} color={colors.primaryText} />
                <Text style={styles.specText}>{vehicle.transmission}</Text>
              </View>
              <View style={styles.specItem}>
                <Fuel size={13} color={colors.primaryText} />
                <Text style={styles.specText}>{vehicle.fuel}</Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`View details of ${vehicle.name}`}
              activeOpacity={0.85}
              onPress={openDetails}
              style={[styles.detailsBtn, !bookable && styles.detailsBtnMuted]}>
              <Text style={[styles.detailsBtnText, !bookable && { color: colors.primaryText }]}>View details</Text>
              <View style={[styles.detailsBtnIcon, !bookable && { backgroundColor: colors.primarySoft }]}>
                <ArrowRight size={13} color={bookable ? colors.onHighlight : colors.primaryText} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${vehicle.name}, ${formatINR(vehicle.pricePerDay)} per day, ${availability}`}
        onPress={openDetails}
        style={[styles.compact, cardWidth ? { width: cardWidth } : null, !bookable && styles.dimmed]}>
        <View style={styles.thumb}>
          <VehiclePhoto source={source} style={{ width: '100%', height: '100%' }} radius={0} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {vehicle.name}
          </Text>
          <Text style={styles.compactSub} numberOfLines={1}>
            {vehicle.seats} seats · {vehicle.transmission} · {vehicle.fuel}
          </Text>
          <View style={styles.compactFoot}>
            <Text style={styles.compactPrice}>
              {formatINR(vehicle.pricePerDay)}
              <Text style={styles.priceUnit}> /day</Text>
            </Text>
            <Badge label={availability} tone={bookable ? 'success' : 'neutral'} />
          </View>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      accessibilityRole={CARD_ROLE}
      accessibilityLabel={`${vehicle.name} details`}
      style={[styles.card, cardWidth ? { width: cardWidth } : null]}
      onPress={openDetails}>
      <View style={styles.artworkArea}>
        <VehiclePhoto source={source} style={[StyleSheet.absoluteFill, !bookable && { opacity: 0.7 }]} radius={0} accessibilityLabel={`${vehicle.name} photo`} />
        <View style={styles.topRow}>
          {vehicle.badge ? (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{vehicle.badge}</Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={isFav ? 'Remove from favourites' : 'Add to favourites'}
            accessibilityState={{ selected: isFav }}
            style={[styles.favBtn, isFav && styles.favBtnActive]}
            onPress={() => setIsFav(!isFav)}>
            <Heart size={15} color={isFav ? colors.danger : colors.muted} fill={isFav ? colors.danger : 'transparent'} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.carTitle} numberOfLines={1}>
              {vehicle.name}
            </Text>
            <Text style={styles.carType} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Badge label={availability} tone={bookable ? 'success' : 'neutral'} />
        </View>

        <View style={styles.specsRow}>
          <View style={styles.specItem}>
            <Users size={13} color={colors.secondaryText} />
            <Text style={styles.specText}>{vehicle.seats} seats</Text>
          </View>
          <View style={styles.specItem}>
            <Settings size={13} color={colors.secondaryText} />
            <Text style={styles.specText}>{vehicle.transmission}</Text>
          </View>
          <View style={styles.specItem}>
            <Fuel size={13} color={colors.secondaryText} />
            <Text style={styles.specText}>{vehicle.fuel}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View>
            <Text style={styles.priceLabel}>From</Text>
            <Text style={styles.priceValue}>
              {formatINR(vehicle.pricePerDay)}
              <Text style={styles.priceUnit}> /day</Text>
            </Text>
          </View>
          <Button
            label={bookable ? 'Rent now' : 'View details'}
            variant={bookable ? 'primary' : 'outline'}
            size="sm"
            onPress={onPrimary}
            accessibilityHint={bookable ? 'Opens vehicle details to book' : 'This vehicle is not bookable right now'}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      ...boxShadow(colors.shadow, { y: 2, blur: 10, opacity: 0.05 }),
      elevation: 1,
    },
    artworkArea: {
      aspectRatio: VEHICLE_PHOTO_ASPECT,
      backgroundColor: colors.bg2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingTop: 22,
    },
    carPhoto: {
      width: '100%',
      height: '100%',
    },
    topRow: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    badgePill: {
      backgroundColor: colors.highlightSoft,
      borderWidth: 1,
      borderColor: colors.highlight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgePillText: {
      color: colors.onHighlight,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    favBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      justifyContent: 'center',
      alignItems: 'center',
    },
    favBtnActive: {
      backgroundColor: colors.dangerGlow,
      borderColor: colors.dangerGlow,
    },
    body: {
      padding: 14,
      gap: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    carTitle: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    carType: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    specsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.line,
    },
    specItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    specText: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '500',
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    priceLabel: {
      color: colors.muted,
      fontSize: 11,
    },
    priceValue: {
      color: colors.txt,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    priceUnit: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '500',
    },
    catalogCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      ...boxShadow(colors.shadow, { y: 6, blur: 16, opacity: 0.08 }),
      elevation: 3,
    },
    catalogPhoto: {
      aspectRatio: VEHICLE_PHOTO_ASPECT,
      backgroundColor: colors.bg2,
    },
    catalogDim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15,26,21,0.28)',
    },
    catalogPhotoTop: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    statusAvailable: {
      backgroundColor: colors.success,
    },
    statusBooked: {
      backgroundColor: 'rgba(20,28,24,0.82)',
    },
    statusService: {
      backgroundColor: colors.warning,
    },
    statusPillText: {
      color: BRAND.white,
      fontSize: 12,
      fontWeight: '800',
    },
    catalogBadge: {
      backgroundColor: colors.highlight,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    catalogBody: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 12,
      gap: 10,
    },
    catalogTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    catalogTitle: {
      color: colors.txt,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    catalogPrice: {
      color: colors.primaryText,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    catalogFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    catalogSpecs: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 10,
      rowGap: 4,
    },
    detailsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingLeft: 14,
      paddingRight: 5,
      paddingVertical: 5,
      minHeight: 36,
    },
    detailsBtnMuted: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    detailsBtnText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    detailsBtnIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.highlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 10,
    },
    dimmed: {
      backgroundColor: colors.bg2,
    },
    thumb: {
      width: 96,
      height: 68,
      borderRadius: 12,
      backgroundColor: colors.bg2,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    compactTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    compactSub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    compactFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 6,
    },
    compactPrice: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
  });
