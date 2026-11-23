import React, { useEffect, useState } from 'react';
import { Image, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Size of the slide picture in pixels, and the clock in it (the painted hands were removed from the picture). */
const PICTURE = { width: 840, height: 1960 };
const CLOCK = { x: 706, y: 396, ring: 166 };
const HANDS = {
  hour: { length: 62, width: 12, tail: 10, color: '#F2BD48' },
  minute: { length: 92, width: 8, tail: 12, color: '#F6EBCB' },
  second: { length: 104, width: 3, tail: 24, color: '#FFBA00' },
};
/** The booked days (16–20) on the painted calendar: centres, cell size and the calendar's tilt. */
const BOOKED = [
  { x: 237, y: 745 },
  { x: 311, y: 734 },
  { x: 383, y: 722 },
  { x: 454, y: 711 },
  { x: 523, y: 700 },
];
const CELL = { w: 68, h: 60, tilt: -9 };
const INTRO_MS = 1800;
const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/** Angles of the hands for a time, in degrees from 12 o'clock. */
function anglesAt(d: Date) {
  const s = d.getSeconds() + d.getMilliseconds() / 1000;
  const m = d.getMinutes() + s / 60;
  const h = (d.getHours() % 12) + m / 60;
  return { hour: h * 30, minute: m * 6, second: s * 6 };
}

/**
 * The second welcome slide's picture with a working clock, animated to catch the eye when the slide opens:
 * - the hands spin round from 12 o'clock to the phone's real time (the minute hand takes an extra full turn);
 * - then the second hand ticks every second with a small mechanical bounce, and hour and minute keep real time;
 * - gold rings ripple out from the clock now and then;
 * - a glow runs across the booked days (16 → 20) on the calendar, like a trip being picked.
 * With reduced motion the hands just show the time.
 */
export function ClockBackground({ source }: { source: ImageSourcePropType }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [now, setNow] = useState(() => new Date());
  const still = useReducedMotion();
  const intro = useSharedValue(still ? 1 : 0);
  const second = useSharedValue(anglesAt(new Date()).second);
  const ripple = useSharedValue(0);
  const wave = useSharedValue(0);

  // Hour and minute hands follow the time
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (still) return;
    // 1) spin in
    intro.value = 0;
    intro.value = withTiming(1, { duration: INTRO_MS, easing: Easing.out(Easing.cubic) });
    // second hand: from 12 o'clock, one extra turn, to the real second (counted without wrapping, so it never runs backwards)
    const whole = (ms: number) => Math.floor(ms / 1000) * 6;
    // whole(t) % 360 is the second hand's position at t, so `base` makes the hand land there after one extra turn
    const landing = whole(Date.now() + INTRO_MS);
    const base = landing - (landing % 360) - 360;
    second.value = 0;
    second.value = withTiming(landing - base, { duration: INTRO_MS, easing: Easing.out(Easing.cubic) });
    // 2) then tick on each new second, with a little overshoot
    let ticker: ReturnType<typeof setInterval> | undefined;
    const tick = () => {
      const target = whole(Date.now()) - base;
      second.value = withSequence(
        withTiming(target + 1.6, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(target, { duration: 160, easing: Easing.inOut(Easing.quad) })
      );
    };
    const startTicking = setTimeout(
      () => {
        tick();
        ticker = setInterval(tick, 1000);
      },
      INTRO_MS + (1000 - ((Date.now() + INTRO_MS) % 1000))
    );
    // 3) ripples from the clock ring, and 4) the glow across the booked days
    ripple.value = withDelay(INTRO_MS - 400, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
    wave.value = withDelay(INTRO_MS - 600, withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1, false));
    return () => {
      clearTimeout(startTicking);
      if (ticker) clearInterval(ticker);
      [intro, second, ripple, wave].forEach(cancelAnimation);
    };
  }, [still, intro, second, ripple, wave]);

  const s = box.w && box.h ? Math.max(box.w / PICTURE.width, box.h / PICTURE.height) : 0;
  const ox = (box.w - PICTURE.width * s) / 2;
  const oy = (box.h - PICTURE.height * s) / 2;
  const cx = ox + CLOCK.x * s;
  const cy = oy + CLOCK.y * s;
  const a = anglesAt(now);

  return (
    <View style={FILL} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="none">
      <Image source={source} resizeMode="cover" style={[FILL, { width: '100%', height: '100%' }]} />
      {s ? (
        <>
          {!still ? BOOKED.map((d, i) => <DayGlow key={i} i={i} x={ox + d.x * s} y={oy + d.y * s} scale={s} wave={wave} />) : null}
          {!still ? (
            <>
              <Ripple cx={cx} cy={cy} scale={s} progress={ripple} offset={0} />
              <Ripple cx={cx} cy={cy} scale={s} progress={ripple} offset={0.5} />
            </>
          ) : null}
          {/* hour: from 12 to the time; minute: one extra turn on the way */}
          <Hand cx={cx} cy={cy} scale={s} spec={HANDS.hour} angle={a.hour} intro={intro} extra={0} />
          <Hand cx={cx} cy={cy} scale={s} spec={HANDS.minute} angle={a.minute} intro={intro} extra={360} />
          {still ? (
            <Hand cx={cx} cy={cy} scale={s} spec={HANDS.second} angle={a.second} intro={intro} extra={0} />
          ) : (
            <TickingHand cx={cx} cy={cy} scale={s} angle={second} />
          )}
          {/* gold centre cap */}
          <View
            style={{
              position: 'absolute',
              left: cx - 13 * s,
              top: cy - 13 * s,
              width: 26 * s,
              height: 26 * s,
              borderRadius: 13 * s,
              backgroundColor: '#F2BD48',
              borderWidth: Math.max(1, 4 * s),
              borderColor: '#0A3A1C',
            }}
          />
        </>
      ) : null}
    </View>
  );
}

type Spec = (typeof HANDS)[keyof typeof HANDS];

/**
 * A hand turning around the clock centre. The view is twice the hand's length, centred on the clock, so rotating
 * it turns the visible top half around the centre.
 */
function handBox(cx: number, cy: number, scale: number, spec: Spec) {
  const half = (spec.length + spec.tail) * scale;
  return { position: 'absolute' as const, left: cx - (spec.width * scale) / 2, top: cy - half, width: spec.width * scale, height: half * 2 };
}

function HandShape({ scale, spec }: { scale: number; spec: Spec }) {
  const half = (spec.length + spec.tail) * scale;
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: half - spec.length * scale,
        width: spec.width * scale,
        height: (spec.length + spec.tail) * scale,
        borderRadius: (spec.width * scale) / 2,
        backgroundColor: spec.color,
      }}
    />
  );
}

/** Hour or minute hand: spins in from 12 o'clock (plus `extra` degrees) while `intro` goes 0 → 1, then shows the time. */
function Hand({
  cx,
  cy,
  scale,
  spec,
  angle,
  intro,
  extra,
}: {
  cx: number;
  cy: number;
  scale: number;
  spec: Spec;
  angle: number;
  intro: SharedValue<number>;
  extra: number;
}) {
  // (angle + 360) looks the same as angle, so the minute hand simply stays there after its extra turn
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${(angle + extra) * intro.value}deg` }] }));
  return (
    <Animated.View style={[handBox(cx, cy, scale, spec), style]}>
      <HandShape scale={scale} spec={spec} />
    </Animated.View>
  );
}

function TickingHand({ cx, cy, scale, angle }: { cx: number; cy: number; scale: number; angle: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <Animated.View style={[handBox(cx, cy, scale, HANDS.second), style]}>
      <HandShape scale={scale} spec={HANDS.second} />
    </Animated.View>
  );
}

/** A gold ring growing out from the clock's rim and fading away. */
function Ripple({ cx, cy, scale, progress, offset }: { cx: number; cy: number; scale: number; progress: SharedValue<number>; offset: number }) {
  const r = CLOCK.ring * scale;
  const style = useAnimatedStyle(() => {
    const p = (progress.value + offset) % 1;
    return { opacity: interpolate(p, [0, 0.12, 1], [0, 0.95, 0]), transform: [{ scale: interpolate(p, [0, 1], [0.98, 1.32]) }] };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: Math.max(2, 7 * scale),
          borderColor: '#FFD45C',
        },
        style,
      ]}
    />
  );
}

/** Light passing over one booked day; the days light up one after another, 16 → 20. */
function DayGlow({ i, x, y, scale, wave }: { i: number; x: number; y: number; scale: number; wave: SharedValue<number> }) {
  const w = CELL.w * scale;
  const h = CELL.h * scale;
  const style = useAnimatedStyle(() => {
    const at = 0.1 + i * 0.1; // when this day is brightest in the cycle
    return { opacity: interpolate(wave.value, [at - 0.1, at, at + 0.14], [0, 1, 0], 'clamp') };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - w / 2,
          top: y - h / 2,
          width: w,
          height: h,
          borderRadius: 12 * scale,
          backgroundColor: 'rgba(255,241,168,0.32)',
          borderWidth: Math.max(1.5, 4 * scale),
          borderColor: '#FFFFFF',
          transform: [{ rotate: `${CELL.tilt}deg` }],
        },
        style,
      ]}
    />
  );
}
