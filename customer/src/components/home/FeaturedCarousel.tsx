import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { formatINR } from '../../lib/format';

const SHOWROOM_CAR = require('../../../assets/images/keygo-yellow-car.jpg');

export const featuredCardHeight = (width: number) => Math.round(width / 1.5);

/** Featured card: the yellow car on the lit showroom platform, with the starting price and the delivery promise on top. */
export function FeaturedCarousel({ width, lowestPrice, onOpenFleet }: { width: number; lowestPrice: number; onOpenFleet: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const height = featuredCardHeight(width);

  return (
    <View style={[styles.card, { width, height }]}>
      <TouchableOpacity activeOpacity={0.92} accessibilityRole="button" accessibilityLabel="Browse the fleet" onPress={onOpenFleet} style={{ width, height }}>
        <Image source={SHOWROOM_CAR} resizeMode="cover" style={{ width, height }} accessibilityLabel="Yellow sports car parked on a lit showroom platform" accessibilityIgnoresInvertColors />
      </TouchableOpacity>

      <View style={[styles.tag, { left: 12 }]}>
        <Text style={styles.tagLabel}>Starting at</Text>
        <Text style={styles.tagValue}>{Number.isFinite(lowestPrice) ? `${formatINR(lowestPrice)}/day` : 'See fleet'}</Text>
      </View>
      <View style={[styles.tag, { right: 12 }]}>
        <Text style={styles.tagLabel}>Free delivery</Text>
        <Text style={styles.tagValue}>Under 60 min</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.photoStage, alignSelf: 'center' },
    tag: { position: 'absolute', top: 14, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, pointerEvents: 'none' },
    tagLabel: { color: colors.muted, fontSize: 11.5 },
    tagValue: { color: colors.txt, fontSize: 15, fontWeight: '800', marginTop: 2 },
  });
