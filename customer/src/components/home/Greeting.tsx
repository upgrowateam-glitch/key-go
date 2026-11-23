import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useThemedStyles, type ThemeColors } from '../../theme';

type Part = 'morning' | 'afternoon' | 'evening';

const SIZE = 56;
/** Warm colour of the "Good morning" words for each part of the day. */
const TONE: Record<Part, string> = { morning: '#E0A100', afternoon: '#E8740C', evening: '#7B8CE8' };

/**
 * The home greeting: a living sky icon (a glowing sun in the morning and afternoon, a crescent moon with twinkling
 * stars in the evening), then "Good morning," and the customer's name large below it. Fades in when the home opens
 * (in place: a sliding entrance left the row shifted down on some Android phones, overlapping the badge below).
 */
export function Greeting({ text, part, name }: { text: string; part: Part; name: string }) {
  const styles = useThemedStyles(makeStyles);
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(1, { duration: 500 });
  }, [shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View style={[styles.row, fade]} accessible accessibilityRole="header" accessibilityLabel={name ? `${text}, ${name}` : text}>
      {part === 'evening' ? <Moon /> : <Sun strong={part === 'afternoon'} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* one line: "Good morning," in the time-of-day colour, then the name in bold; shrinks a little if long */}
        <Text style={styles.line} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          <Text style={[styles.hello, { color: TONE[part] }]}>{name ? `${text}, ` : text}</Text>
          {name ? <Text style={styles.name}>{name}</Text> : null}
        </Text>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- sun

const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

function Sun({ strong }: { strong: boolean }) {
  const still = useReducedMotion();
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    spin.value = withRepeat(withTiming(360, { duration: 24000, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(breathe);
    };
  }, [still, spin, breathe]);
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 + breathe.value * 0.45, transform: [{ scale: 0.92 + breathe.value * 0.14 }] }));
  const core = strong ? ['#FFFFFF', '#FFF1A6', '#FFC62E', '#FF9A1A'] : ['#FFFDF0', '#FFE27A', '#FFB52E', '#F08A12'];

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      {/* soft glow around the sun */}
      <Animated.View style={[StyleSheet.absoluteFill, halo]}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="sunHalo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0.3" stopColor="#FFC93C" stopOpacity="0.55" />
              <Stop offset="0.65" stopColor="#FFB52E" stopOpacity="0.18" />
              <Stop offset="1" stopColor="#FFB52E" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#sunHalo)" />
        </Svg>
      </Animated.View>
      {/* tapered rays, turning slowly */}
      <Animated.View style={[StyleSheet.absoluteFill, rays]}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="sunRay" cx="50" cy="50" r="46" gradientUnits="userSpaceOnUse">
              <Stop offset="0.45" stopColor="#FFD24A" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFB52E" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <G>
            {RAYS.map((a, i) => (
              <Path key={a} d={i % 2 ? 'M 50 9 L 53 30 L 47 30 Z' : 'M 50 4 L 54.5 30 L 45.5 30 Z'} fill="url(#sunRay)" transform={`rotate(${a} 50 50)`} />
            ))}
          </G>
        </Svg>
      </Animated.View>
      {/* the sun's glowing ball: white-hot centre to deep orange edge, with a soft light spot */}
      <Svg style={StyleSheet.absoluteFill} width={SIZE} height={SIZE} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="sunCore" cx="44" cy="42" r="26" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={core[0]} />
            <Stop offset="0.35" stopColor={core[1]} />
            <Stop offset="0.8" stopColor={core[2]} />
            <Stop offset="1" stopColor={core[3]} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="21" fill="url(#sunCore)" />
        <Circle cx="50" cy="50" r="21" fill="none" stroke="#FFE9A0" strokeOpacity="0.6" strokeWidth="1" />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- moon

const STARS = [
  { x: 14, y: 22, r: 2.2, delay: 0 },
  { x: 84, y: 16, r: 1.8, delay: 0.35 },
  { x: 88, y: 70, r: 1.6, delay: 0.7 },
  { x: 20, y: 82, r: 1.4, delay: 0.5 },
];

function Moon() {
  const still = useReducedMotion();
  const twinkle = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    twinkle.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(twinkle);
  }, [still, twinkle]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.6 + Math.sin(twinkle.value * Math.PI * 2) * 0.25 }));

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Animated.View style={[StyleSheet.absoluteFill, glow]}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="moonHalo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0.3" stopColor="#B9C6FF" stopOpacity="0.5" />
              <Stop offset="1" stopColor="#B9C6FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#moonHalo)" />
        </Svg>
      </Animated.View>
      <Svg style={StyleSheet.absoluteFill} width={SIZE} height={SIZE} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="moonFace" cx="40" cy="40" r="30" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.6" stopColor="#F1EFD9" />
            <Stop offset="1" stopColor="#CFCBB0" />
          </RadialGradient>
        </Defs>
        {/* crescent: a full disc with a second disc cut out of its right side */}
        <Path d="M 62 26 A 26 26 0 1 0 74 66 A 21 21 0 1 1 62 26 Z" fill="url(#moonFace)" />
        <Circle cx="38" cy="44" r="3.2" fill="#BDB89A" opacity="0.6" />
        <Circle cx="44" cy="62" r="2.4" fill="#BDB89A" opacity="0.5" />
        <Circle cx="33" cy="58" r="1.6" fill="#BDB89A" opacity="0.5" />
      </Svg>
      {STARS.map((s, i) => (
        <Star key={i} {...s} twinkle={twinkle} still={still} />
      ))}
    </View>
  );
}

function Star({ x, y, r, delay, twinkle, still }: { x: number; y: number; r: number; delay: number; twinkle: { value: number }; still: boolean }) {
  const style = useAnimatedStyle(() => {
    const t = (twinkle.value + delay) % 1;
    return { opacity: still ? 0.8 : 0.25 + Math.abs(Math.sin(t * Math.PI)) * 0.75 };
  });
  const px = (SIZE * r) / 100;
  return (
    <Animated.View style={[{ position: 'absolute', left: (SIZE * x) / 100 - px * 2, top: (SIZE * y) / 100 - px * 2, width: px * 4, height: px * 4 }, style]}>
      <Svg width={px * 4} height={px * 4} viewBox="0 0 20 20">
        <Path d="M 10 0 L 12 8 L 20 10 L 12 12 L 10 20 L 8 12 L 0 10 L 8 8 Z" fill="#FFF7D6" />
      </Svg>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, minHeight: 56 },
    line: { fontSize: 22, lineHeight: 28, includeFontPadding: false },
    hello: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
    name: { color: colors.txt, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  });
