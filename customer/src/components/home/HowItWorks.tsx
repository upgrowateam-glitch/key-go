import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarRange, ChevronDown, CreditCard, KeyRound, Search } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { boxShadow, useThemedStyles, useThemeColors, withAlpha, type ThemeColors } from '../../theme';

const STEPS = [
  { step: '01', title: 'Choose a car', desc: 'Browse verified cars with real photos and specs.', Icon: Search },
  { step: '02', title: 'Pick your dates', desc: 'Rent for a day, a week or a whole month.', Icon: CalendarRange },
  { step: '03', title: 'Pay securely', desc: 'UPI, cards or wallets. Deposit returned after the trip.', Icon: CreditCard },
  { step: '04', title: 'Get the keys', desc: 'Delivered to your door, sanitized and ready to go.', Icon: KeyRound },
];
const STAGGER = 140;

/**
 * "Keys in hand in 4 easy steps": first a single card with the title; tapping it brings in the four step cards one
 * after another, each swinging in from a tilt along a timeline. Tapping again folds them away.
 */
export function HowItWorks() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const still = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const turn = useSharedValue(0);
  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);
  const progress = [p0, p1, p2, p3];
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    clearTimeout(hideTimer.current);
    turn.set(withTiming(next ? 1 : 0, { duration: 260 }));
    if (next) {
      setMounted(true);
      progress.forEach((p, i) => {
        p.set(0);
        p.set(still ? 1 : withDelay(120 + i * STAGGER, withSpring(1, { damping: 14, stiffness: 120, mass: 0.9 })));
      });
    } else {
      // fold away from the last card up
      progress.forEach((p, i) =>
        p.set(still ? 0 : withDelay((progress.length - 1 - i) * 60, withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })))
      );
      hideTimer.current = setTimeout(() => setMounted(false), still ? 0 : 60 * progress.length + 240);
    }
  };

  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Keys in hand in 4 easy steps"
        accessibilityHint={open ? 'Hides the steps' : 'Shows the steps'}
        onPress={toggle}
        style={({ pressed }) => [styles.head, pressed && { transform: [{ scale: 0.985 }] }]}>
        <View style={styles.keyBadge}>
          <KeyRound size={22} color={colors.onHighlight} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Keys in hand in 4 easy steps</Text>
          <Text style={styles.sub}>Book in 2 minutes from your phone. We handle the rest.</Text>
          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <React.Fragment key={s.step}>
                <View style={styles.dot}>
                  <s.Icon size={12} color={colors.onPrimary} />
                </View>
                {i < STEPS.length - 1 ? <View style={styles.dash} /> : null}
              </React.Fragment>
            ))}
            <Text style={styles.see}>{open ? 'Hide' : 'See how'}</Text>
          </View>
        </View>
        <Animated.View style={[styles.chevron, chevron]}>
          <ChevronDown size={18} color={colors.onPrimary} />
        </Animated.View>
      </Pressable>

      {mounted ? (
        <View style={styles.list}>
          {STEPS.map((s, i) => (
            <StepCard key={s.step} item={s} progress={progress[i]} last={i === STEPS.length - 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function StepCard({ item, progress, last }: { item: (typeof STEPS)[number]; progress: SharedValue<number>; last: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // swings in: from tipped back and turned a little, low and see-through, to flat and in place
  const card = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: Math.min(1, t * 1.6),
      transform: [
        { perspective: 800 },
        { translateY: (1 - t) * 36 },
        { rotateX: `${(1 - t) * 55}deg` },
        { rotateZ: `${(1 - t) * -7}deg` },
        { scale: 0.9 + t * 0.1 },
      ],
    };
  });
  const badge = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.4 + progress.value * 0.6 }] }));
  const line = useAnimatedStyle(() => ({ transform: [{ scaleY: progress.value }], opacity: progress.value }));

  return (
    <View style={styles.row}>
      {/* timeline */}
      <View style={styles.rail}>
        <Animated.View style={[styles.num, badge]}>
          <Text style={styles.numText}>{item.step}</Text>
        </Animated.View>
        {!last ? <Animated.View style={[styles.railLine, line]} /> : null}
      </View>
      <Animated.View style={[styles.card, card]}>
        <View style={styles.icon}>
          <item.Icon size={20} color={colors.primaryText} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDesc}>{item.desc}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: colors.primary,
      ...boxShadow(colors.shadow, { y: 8, blur: 18, opacity: 0.12 }),
      elevation: 3,
    },
    keyBadge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.highlight },
    title: { color: colors.onPrimary, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.3 },
    sub: { color: withAlpha(colors.onPrimary, 0.75), fontSize: 12.5, lineHeight: 17, marginTop: 2 },
    dots: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.onPrimary, 0.16) },
    dash: { width: 10, height: 2, borderRadius: 1, backgroundColor: withAlpha(colors.onPrimary, 0.3), marginHorizontal: 3 },
    see: { color: colors.highlight, fontSize: 12.5, fontWeight: '800', marginLeft: 10 },
    chevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.onPrimary, 0.14) },
    list: { marginTop: 14 },
    row: { flexDirection: 'row', gap: 12 },
    rail: { width: 34, alignItems: 'center' },
    num: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.highlight, marginTop: 14 },
    numText: { color: colors.onHighlight, fontSize: 12, fontWeight: '800' },
    railLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: colors.primaryBorder, marginVertical: 4, transformOrigin: 'top' },
    card: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginBottom: 12,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      ...boxShadow(colors.shadow, { y: 4, blur: 10, opacity: 0.07 }),
      elevation: 2,
    },
    icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
    cardTitle: { color: colors.txt, fontSize: 15.5, lineHeight: 20, fontWeight: '800' },
    cardDesc: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  });
