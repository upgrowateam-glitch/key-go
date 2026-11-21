import React, { useEffect, useState } from 'react';
import { Image, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** Size of the slide picture in pixels, and where the car's tail lights are in it. */
const PICTURE = { width: 840, height: 1871 };
const TAIL_LIGHTS = [
  { x: 58, y: 1040, w: 120, h: 18 },
  { x: 163, y: 1043, w: 104, h: 22 },
];
/** Speed streaks along the road, below the car (picture coordinates). */
const STREAKS = [
  { x: 120, y: 1180, len: 260, delay: 0 },
  { x: 40, y: 1255, len: 340, delay: 700 },
  { x: 260, y: 1215, len: 220, delay: 1400 },
  { x: 0, y: 1320, len: 300, delay: 2100 },
];
const EASE = Easing.inOut(Easing.quad);
const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

type Place = (x: number, y: number) => { left: number; top: number };

/**
 * The first welcome slide's picture with a "driving" feel: the picture slowly moves forward and sideways like a
 * camera following the car, the tail lights glow, and faint speed streaks sweep along the road. Stays still when
 * the phone is set to reduce motion.
 */
export function DrivingBackground({ source }: { source: ImageSourcePropType }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const still = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    // camera following the car: slow push-in and drift, then back
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: EASE, reduceMotion: ReduceMotion.System }), -1, true);
    return () => cancelAnimation(drift);
  }, [still, drift]);

  const camera = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(drift.value, [0, 1], [1, 1.07]) },
      { translateX: interpolate(drift.value, [0, 1], [0, -10]) },
      { translateY: interpolate(drift.value, [0, 1], [0, -6]) },
    ],
  }));

  // Where the picture lands on this screen ("cover": fills the screen, centred)
  const s = box.w && box.h ? Math.max(box.w / PICTURE.width, box.h / PICTURE.height) : 0;
  const ox = (box.w - PICTURE.width * s) / 2;
  const oy = (box.h - PICTURE.height * s) / 2;
  const at: Place = (x, y) => ({ left: ox + x * s, top: oy + y * s });

  return (
    <View style={[FILL, { overflow: 'hidden' }]} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="none">
      <Animated.View style={[FILL, camera]}>
        <Image source={source} resizeMode="cover" style={[FILL, { width: '100%', height: '100%' }]} />
        {s && !still ? TAIL_LIGHTS.map((t, i) => <TailLight key={`light${i}`} light={t} scale={s} at={at} />) : null}
        {s && !still ? STREAKS.map((st, i) => <Streak key={`streak${i}`} streak={st} scale={s} at={at} />) : null}
      </Animated.View>
    </View>
  );
}

/** A soft red glow over one tail light, breathing in and out. */
function TailLight({ light: t, scale: s, at }: { light: (typeof TAIL_LIGHTS)[number]; scale: number; at: Place }) {
  const glow = useSharedValue(0.25);
  useEffect(() => {
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: EASE }), withTiming(0.25, { duration: 1100, easing: EASE })), -1);
    return () => cancelAnimation(glow);
  }, [glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          ...at(t.x - t.w / 2 - 14, t.y - t.h / 2 - 12),
          width: (t.w + 28) * s,
          height: (t.h + 24) * s,
          borderRadius: 40 * s,
          backgroundColor: 'rgba(255, 70, 40, 0.45)',
        },
        style,
      ]}
    />
  );
}

/** A faint light streak sweeping along the road, repeating. */
function Streak({ streak: st, scale: s, at }: { streak: (typeof STREAKS)[number]; scale: number; at: Place }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      st.delay,
      withRepeat(withSequence(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 1500 })), -1)
    );
    return () => cancelAnimation(p);
  }, [p, st.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2, 0.7, 1], [0, 0.9, 0.5, 0]),
    transform: [{ rotate: '-14deg' }, { translateX: interpolate(p.value, [0, 1], [-60 * s, 380 * s]) }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', ...at(st.x, st.y), width: st.len * s, height: Math.max(2, 3 * s), borderRadius: 2, backgroundColor: 'rgba(255, 226, 150, 0.55)' },
        style,
      ]}
    />
  );
}
