import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { formatINR } from '../../lib/format';

const SHOWROOM_CAR = require('../../../assets/images/keygo-yellow-car.jpg');
/** The picture's size, and the front half of the platform's glowing rim in it (left end → round the front → right end). */
const PICTURE = { width: 1672, height: 941 };
const RIM = 'M 229 662 A 612 84 0 0 0 1453 662';
const RIM_LENGTH = 1372;
const STREAK = 300;
const TURN_MS = 3600;
const ORBIT_MS = 9000;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const featuredCardHeight = (width: number) => Math.round(width / 1.5);

/**
 * Featured card: the yellow car on the lit showroom platform, with the starting price and the delivery promise on top.
 * It moves like a turntable: lights run round the platform's rim, and the view sways and zooms slowly as if the camera
 * were circling the car. With reduced motion it stays still.
 */
export function FeaturedCarousel({ width, lowestPrice, onOpenFleet }: { width: number; lowestPrice: number; onOpenFleet: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const height = featuredCardHeight(width);
  const still = useReducedMotion();
  const turn = useSharedValue(0);
  const orbit = useSharedValue(0.5);

  useEffect(() => {
    if (still) return;
    turn.value = withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    orbit.value = 0;
    orbit.value = withRepeat(withTiming(1, { duration: ORBIT_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(turn);
      cancelAnimation(orbit);
    };
  }, [still, turn, orbit]);

  // camera: drift side to side and zoom in a little at the ends, like walking round the car
  const camera = useAnimatedStyle(() => {
    const side = (orbit.value - 0.5) * 2; // -1 … 1
    return { transform: [{ translateX: -side * width * 0.03 }, { scale: 1.07 + Math.abs(side) * 0.03 }] };
  });

  return (
    <View style={[styles.card, { width, height }]}>
      <TouchableOpacity activeOpacity={0.92} accessibilityRole="button" accessibilityLabel="Browse the fleet" onPress={onOpenFleet} style={{ width, height }}>
        <Animated.View style={[{ width, height }, still ? null : camera]}>
          <Image
            source={SHOWROOM_CAR}
            resizeMode="cover"
            style={{ width, height }}
            accessibilityLabel="Yellow sports car on a turning showroom platform"
            accessibilityIgnoresInvertColors
          />
          {!still ? (
            // same "cover" mapping as the picture, so the lights sit on the rim
            <Svg
              style={StyleSheet.absoluteFill}
              width={width}
              height={height}
              viewBox={`0 0 ${PICTURE.width} ${PICTURE.height}`}
              preserveAspectRatio="xMidYMid slice"
              pointerEvents="none">
              <RimLight turn={turn} offset={0} />
              <RimLight turn={turn} offset={0.5} />
            </Svg>
          ) : null}
        </Animated.View>
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

/** A streak of light travelling round the front of the platform rim (a soft wide glow under a bright core). */
function RimLight({ turn, offset }: { turn: SharedValue<number>; offset: number }) {
  const props = useAnimatedProps(() => {
    const p = (turn.value + offset) % 1;
    // fade in at the left end and out at the right end, as if going round behind the car
    const fade = Math.min(1, p * 6, (1 - p) * 6);
    return { strokeDashoffset: STREAK - p * (RIM_LENGTH + STREAK), strokeOpacity: fade };
  });
  return (
    <>
      <AnimatedPath
        d={RIM}
        fill="none"
        stroke="#5CFFC0"
        strokeWidth={26}
        strokeLinecap="round"
        strokeDasharray={[STREAK, RIM_LENGTH * 2]}
        opacity={0.28}
        animatedProps={props}
      />
      <AnimatedPath
        d={RIM}
        fill="none"
        stroke="#E9FFF5"
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={[STREAK * 0.7, RIM_LENGTH * 2]}
        animatedProps={props}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.photoStage, alignSelf: 'center' },
    tag: { position: 'absolute', top: 14, borderRadius: 14, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 8, pointerEvents: 'none' },
    tagLabel: { color: colors.muted, fontSize: 11.5 },
    tagValue: { color: colors.txt, fontSize: 15, fontWeight: '800', marginTop: 2 },
  });
