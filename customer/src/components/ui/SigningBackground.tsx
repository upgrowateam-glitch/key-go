import React, { useEffect, useState } from 'react';
import { Image, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Size of the slide picture (the painted signature was removed from it) and its signature line. */
const PICTURE = { width: 941, height: 2150 };
const LINE_A = { x: 272, y: 687 };
const LINE_B = { x: 530, y: 623 };
const INK = '#0E4A27';

/** A flowing hand-written signature, drawn along the signature line (u = along the line, v = above it). */
const SIGNATURE: [number, number][][] = [
  [[0, 8], [14, 40], [34, 58], [36, 30]],
  [[36, 30], [37, 12], [24, 4], [30, -2]],
  [[30, -2], [38, -8], [50, 22], [58, 40]],
  [[58, 40], [62, 50], [66, 30], [64, 14]],
  [[64, 14], [63, 4], [74, 0], [82, 16]],
  [[82, 16], [88, 28], [96, 30], [102, 18]],
  [[102, 18], [108, 6], [116, 4], [122, 16]],
  [[122, 16], [128, 28], [138, 30], [146, 20]],
  [[146, 20], [156, 8], [168, 6], [180, 14]],
  [[180, 14], [195, 24], [215, 22], [232, 10]],
];

/** Signature points in picture pixels, their running length, and the SVG path. Worked out once. */
const STROKE = (() => {
  const len = Math.hypot(LINE_B.x - LINE_A.x, LINE_B.y - LINE_A.y);
  const d = { x: (LINE_B.x - LINE_A.x) / len, y: (LINE_B.y - LINE_A.y) / len };
  const n = { x: d.y, y: -d.x };
  const o = { x: LINE_A.x + d.x * 14 + n.x * 9, y: LINE_A.y + d.y * 14 + n.y * 9 };
  const toPicture = (u: number, v: number) => ({ x: o.x + u * d.x + v * n.x, y: o.y + u * d.y + v * n.y });
  const xs: number[] = [];
  const ys: number[] = [];
  SIGNATURE.forEach(([p0, p1, p2, p3], segment) => {
    for (let i = segment === 0 ? 0 : 1; i <= 24; i++) {
      const t = i / 24;
      const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, e = t ** 3;
      const p = toPicture(a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]);
      xs.push(p.x);
      ys.push(p.y);
    }
  });
  const cum = [0];
  for (let i = 1; i < xs.length; i++) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return { xs, ys, cum, total: cum[cum.length - 1], path };
})();

/** One cycle, in seconds: pen glides in, signs, lifts away; signature stays, then fades before the next one. */
const T = { enter: 0.8, write: 2.8, lift: 0.7, hold: 2.4, fade: 0.8 };
const CYCLE = T.enter + T.write + T.lift + T.hold + T.fade;
const PEN = { size: 230, tipX: 42, tipY: 188 };

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * The third welcome slide's picture with a golden fountain pen signing the agreement: it glides in, writes the
 * signature stroke by stroke with a soft golden glow at the nib, and lifts away. Only the pen moves; the picture
 * stays exactly as it is. With reduced motion the signature is simply shown.
 */
export function SigningBackground({ source }: { source: ImageSourcePropType }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const still = useReducedMotion();
  const clock = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    clock.value = 0;
    clock.value = withRepeat(withTiming(CYCLE, { duration: CYCLE * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [still, clock]);

  const s = box.w && box.h ? Math.max(box.w / PICTURE.width, box.h / PICTURE.height) : 0;
  const ox = (box.w - PICTURE.width * s) / 2;
  const oy = (box.h - PICTURE.height * s) / 2;

  /** How much of the signature is written (0..1) at time t, with a natural ease. */
  const written = (t: number) => {
    'worklet';
    const k = Math.min(1, Math.max(0, (t - T.enter) / T.write));
    return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  };
  /** The nib's position on the signature, in picture pixels. */
  const tipAt = (w: number) => {
    'worklet';
    const target = w * STROKE.total;
    let i = 1;
    while (i < STROKE.cum.length - 1 && STROKE.cum[i] < target) i++;
    const seg = STROKE.cum[i] - STROKE.cum[i - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - STROKE.cum[i - 1]) / seg));
    return { x: STROKE.xs[i - 1] + (STROKE.xs[i] - STROKE.xs[i - 1]) * f, y: STROKE.ys[i - 1] + (STROKE.ys[i] - STROKE.ys[i - 1]) * f };
  };

  const inkProps = useAnimatedProps(() => {
    if (still) return { strokeDashoffset: 0, opacity: 1 };
    const t = clock.value;
    const fadeStart = CYCLE - T.fade;
    return {
      strokeDashoffset: STROKE.total * (1 - written(t)),
      opacity: t > fadeStart ? 1 - (t - fadeStart) / T.fade : 1,
    };
  });

  const penStyle = useAnimatedStyle(() => {
    if (!s) return { opacity: 0 };
    const t = clock.value;
    const w = written(t);
    const tip = tipAt(w);
    // gliding in from above-right, and lifting away the same way
    let away = 0;
    if (t < T.enter) away = 1 - t / T.enter;
    else if (t > T.enter + T.write) away = Math.min(1, (t - T.enter - T.write) / T.lift);
    const ease = away * away * (3 - 2 * away);
    const lift = { x: 60 * ease, y: -90 * ease };
    // a gentle rocking of the pen while it writes
    const rock = t > T.enter && t < T.enter + T.write ? Math.sin(t * 9) * 2.5 : 0;
    const visible = t < T.enter + T.write + T.lift ? 1 - (t > T.enter + T.write ? ease : t < T.enter ? ease : 0) : 0;
    return {
      opacity: visible,
      transform: [
        { translateX: ox + (tip.x + lift.x) * s - PEN.tipX * s },
        { translateY: oy + (tip.y + lift.y) * s - PEN.tipY * s },
        { rotate: `${rock}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    if (!s) return { opacity: 0 };
    const t = clock.value;
    const tip = tipAt(written(t));
    const writing = t > T.enter && t < T.enter + T.write;
    return {
      opacity: writing ? 0.55 + Math.sin(t * 14) * 0.25 : 0,
      transform: [{ translateX: ox + tip.x * s - 30 * s }, { translateY: oy + tip.y * s - 30 * s }],
    };
  });

  return (
    <View style={FILL} onLayout={(e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} pointerEvents="none">
      <Image source={source} resizeMode="cover" style={[FILL, { width: '100%', height: '100%' }]} />
      {s ? (
        <>
          {/* The ink, drawn in picture pixels; "slice" places it exactly like the picture's cover fit */}
          <Svg style={FILL} width="100%" height="100%" viewBox={`0 0 ${PICTURE.width} ${PICTURE.height}`} preserveAspectRatio="xMidYMid slice">
            <AnimatedPath
              d={STROKE.path}
              stroke={INK}
              strokeWidth={4.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[STROKE.total, STROKE.total]}
              animatedProps={inkProps}
            />
          </Svg>
          {!still ? (
            <>
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 60 * s, height: 60 * s }, glowStyle]}>
                <Svg width="100%" height="100%" viewBox="0 0 60 60">
                  <Defs>
                    <RadialGradient id="nibGlow" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor="#FFE08A" stopOpacity="0.95" />
                      <Stop offset="0.35" stopColor="#FFBA00" stopOpacity="0.55" />
                      <Stop offset="1" stopColor="#FFBA00" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx="30" cy="30" r="30" fill="url(#nibGlow)" />
                </Svg>
              </Animated.View>
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: PEN.size * s, height: PEN.size * s }, penStyle]}>
                <FountainPen />
              </Animated.View>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** A sleek golden fountain pen, nib at (42, 188) of a 230 x 230 box, pointing down-left like a pen in use. */
function FountainPen() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${PEN.size} ${PEN.size}`}>
      <Defs>
        <LinearGradient id="penGold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF1B8" />
          <Stop offset="0.35" stopColor="#F4C24A" />
          <Stop offset="0.7" stopColor="#B9851C" />
          <Stop offset="1" stopColor="#7A5510" />
        </LinearGradient>
        <LinearGradient id="penDark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A3A3A" />
          <Stop offset="0.5" stopColor="#151515" />
          <Stop offset="1" stopColor="#050505" />
        </LinearGradient>
        <LinearGradient id="nibGold" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFE9A6" />
          <Stop offset="1" stopColor="#C8921E" />
        </LinearGradient>
      </Defs>
      {/* drawn along the x axis from the nib, then turned to point down-left */}
      <G transform={`translate(${PEN.tipX} ${PEN.tipY}) rotate(-48)`}>
        {/* soft shadow */}
        <Rect x="10" y="9" width="200" height="17" rx="8.5" fill="#000" opacity="0.18" />
        {/* nib */}
        <Polygon points="0,0 26,-7 26,7" fill="url(#nibGold)" />
        <Line x1="3" y1="0" x2="22" y2="0" stroke="#7A5510" strokeWidth="1.2" />
        <Circle cx="18" cy="0" r="1.8" fill="#7A5510" />
        {/* grip */}
        <Rect x="25" y="-8" width="30" height="16" rx="5" fill="url(#penDark)" />
        <Rect x="53" y="-9" width="5" height="18" rx="1.5" fill="url(#penGold)" />
        {/* barrel */}
        <Rect x="57" y="-9.5" width="120" height="19" rx="9" fill="url(#penGold)" />
        <Rect x="62" y="-6.5" width="110" height="3" rx="1.5" fill="#FFF6D6" opacity="0.55" />
        <Rect x="112" y="-10" width="5" height="20" rx="1.5" fill="#7A5510" opacity="0.6" />
        {/* clip */}
        <Path d="M 130 -9.5 L 172 -9.5 Q 176 -9.5 176 -13 L 176 -15 L 128 -15 Z" fill="url(#penGold)" />
        {/* end cap */}
        <Rect x="174" y="-9" width="14" height="18" rx="8" fill="url(#penDark)" />
      </G>
    </Svg>
  );
}
