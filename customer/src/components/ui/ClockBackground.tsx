import React, { useEffect, useState } from 'react';
import { Image, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** Size of the slide picture in pixels, and the clock in it (the painted hands were removed from the picture). */
const PICTURE = { width: 840, height: 1960 };
const CLOCK = { x: 706, y: 396 };
const HANDS = {
  hour: { length: 62, width: 12, tail: 10, color: '#F2BD48' },
  minute: { length: 92, width: 8, tail: 12, color: '#F6EBCB' },
  second: { length: 104, width: 3, tail: 24, color: '#FFBA00' },
};
const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/** Angles of the hands for a time, in degrees from 12 o'clock. */
function anglesAt(d: Date) {
  const s = d.getSeconds() + d.getMilliseconds() / 1000;
  const m = d.getMinutes() + s / 60;
  const h = (d.getHours() % 12) + m / 60;
  return { hour: h * 30, minute: m * 6, second: s * 6 };
}

/**
 * The second welcome slide's picture with a working clock: hour and minute hands show the phone's time and the
 * second hand sweeps round. With reduced motion the hands show the time without the sweep.
 */
export function ClockBackground({ source }: { source: ImageSourcePropType }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [now, setNow] = useState(() => new Date());
  const still = useReducedMotion();
  const sweep = useSharedValue(anglesAt(new Date()).second);

  // Hour and minute hands follow the time (a small step every second is invisible at their speed)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Second hand: one smooth turn per minute, from where it is now
  useEffect(() => {
    if (still) return;
    const start = anglesAt(new Date()).second;
    sweep.value = start;
    sweep.value = withRepeat(withTiming(start + 360, { duration: 60000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(sweep);
  }, [still, sweep]);

  const s = box.w && box.h ? Math.max(box.w / PICTURE.width, box.h / PICTURE.height) : 0;
  const cx = (box.w - PICTURE.width * s) / 2 + CLOCK.x * s;
  const cy = (box.h - PICTURE.height * s) / 2 + CLOCK.y * s;
  const a = anglesAt(now);

  return (
    <View style={FILL} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="none">
      <Image source={source} resizeMode="cover" style={[FILL, { width: '100%', height: '100%' }]} />
      {s ? (
        <>
          <Hand cx={cx} cy={cy} scale={s} spec={HANDS.hour} angle={a.hour} />
          <Hand cx={cx} cy={cy} scale={s} spec={HANDS.minute} angle={a.minute} />
          {still ? <Hand cx={cx} cy={cy} scale={s} spec={HANDS.second} angle={a.second} /> : <SweepingHand cx={cx} cy={cy} scale={s} sweep={sweep} />}
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

function Hand({ cx, cy, scale, spec, angle }: { cx: number; cy: number; scale: number; spec: Spec; angle: number }) {
  return (
    <View style={[handBox(cx, cy, scale, spec), { transform: [{ rotate: `${angle}deg` }] }]}>
      <HandShape scale={scale} spec={spec} />
    </View>
  );
}

function SweepingHand({ cx, cy, scale, sweep }: { cx: number; cy: number; scale: number; sweep: { value: number } }) {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.value}deg` }] }));
  return (
    <Animated.View style={[handBox(cx, cy, scale, HANDS.second), style]}>
      <HandShape scale={scale} spec={HANDS.second} />
    </Animated.View>
  );
}
