import React, { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

/** Ellipse traced by the platform's lit edge, as fractions of the image width/height. */
export interface RingGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** A background fog bank: [cx, cy, rx, ry] as fractions of the image. Keep them clear of the car. */
export type FogBank = [number, number, number, number];

interface ShowroomHeroProps {
  source: ImageSourcePropType;
  /** Width / height of the image. */
  imageAspect: number;
  width: number;
  height: number;
  ring: RingGeometry;
  ringColor?: string;
  fog?: FogBank[];
  radius?: number;
  accessibilityLabel?: string;
  /** Hold the scene still (no side-to-side float), e.g. when something is placed on the platform. */
  still?: boolean;
  children?: React.ReactNode;
}

const COMET_TRAIL = [0, 0.018, 0.036, 0.054, 0.072];
const FOG_COLOR = '#7FA89F';

/**
 * Showroom hero built on one flat image: the scene floats very slightly side to side, a highlight
 * travels along the platform's lit edge (drawn as an overlay aligned to the ring in the image, so the
 * platform itself never spins) and soft fog drifts in the background. With reduced motion enabled it
 * is a still image with a steady ring glow.
 */
export function ShowroomHero({
  source,
  imageAspect,
  width,
  height,
  ring,
  ringColor = '#3CF0A0',
  fog = [],
  radius = 20,
  accessibilityLabel,
  still = false,
  children,
}: ShowroomHeroProps) {
  const reduceMotion = useReducedMotion();
  // Overlays wait for the photo, so the ring glow never shows on an empty stage
  const [loaded, setLoaded] = useState(false);
  const reveal = useSharedValue(0);

  // The image fills the height and is centred; the frame is narrower than the image, so the pan
  // below always has spare image on both sides (callers keep the scene inside the visible part).
  const imgH = height;
  const imgW = Math.max(width * 1.03, imgH * imageAspect);
  const imgLeft = (width - imgW) / 2;
  const k = { x: imgW, y: imgH };

  const float = useSharedValue(0.5); // side-to-side 0 ↔ 1
  const comet = useSharedValue(0); // 0 → 1 along the front of the ring
  const glow = useSharedValue(0.5); // ring glow pulse 0 ↔ 1
  const fogDrift = useSharedValue(0.5); // background fog 0 ↔ 1

  useEffect(() => {
    if (reduceMotion) {
      float.value = 0.5;
      comet.value = 0;
      glow.value = 0.5;
      fogDrift.value = 0.5;
      return;
    }
    // Everything starts on mount, with no hold before the motion begins
    const loop = (ms: number) => withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (!still) {
      float.value = 0;
      float.value = loop(6000);
    }
    comet.value = 0;
    comet.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.linear }), -1, false);
    glow.value = 0;
    glow.value = loop(2400);
    fogDrift.value = 0;
    fogDrift.value = loop(14000);
  }, [reduceMotion, still, float, comet, glow, fogDrift]);

  useEffect(() => {
    if (loaded) reveal.value = reduceMotion ? 1 : withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [loaded, reduceMotion, reveal]);

  const sceneStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateX: (float.value - 0.5) * width * 0.014 }],
  }));
  const fogStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + fogDrift.value * 0.25,
    transform: [{ translateX: (fogDrift.value - 0.5) * width * 0.05 }],
  }));
  const ringGlowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.35 }));

  // Front (visible) half of the ring, in image pixels: from the left end, under the car, to the right end
  const rcx = ring.cx * k.x;
  const rcy = ring.cy * k.y;
  const rrx = ring.rx * k.x;
  const rry = ring.ry * k.y;
  const frontArc = `M ${rcx - rrx} ${rcy} A ${rrx} ${rry} 0 0 0 ${rcx + rrx} ${rcy}`;
  const cometW = Math.max(34, imgW * 0.075);
  const cometH = Math.max(10, cometW * 0.3);

  return (
    <View style={[styles.stage, { width, height, borderRadius: radius }]}>
      <Animated.View style={[styles.abs, { left: imgLeft, top: 0, width: imgW, height: imgH }, sceneStyle]} testID="showroom-scene">
        {/* Explicit size: react-native-web otherwise applies the asset's pixel size */}
        <Image
          source={source}
          resizeMode="cover"
          style={{ width: imgW, height: imgH }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          accessibilityLabel={accessibilityLabel}
          accessibilityIgnoresInvertColors
        />

        {/* Background fog, kept to the dark areas beside and above the car */}
        {fog.length ? (
          <Animated.View style={[StyleSheet.absoluteFill, fogStyle, { pointerEvents: 'none' }]}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="kgHeroFog" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0" stopColor={FOG_COLOR} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={FOG_COLOR} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              {fog.map(([x, y, rx, ry], i) => (
                <Ellipse key={i} cx={x * 100} cy={y * 100} rx={rx * 100} ry={ry * 100} fill="url(#kgHeroFog)" />
              ))}
            </Svg>
          </Animated.View>
        ) : null}

        {/* Soft pulse along the lit edge */}
        <Animated.View style={[StyleSheet.absoluteFill, ringGlowStyle, { pointerEvents: 'none' }]}>
          <Svg width={imgW} height={imgH} viewBox={`0 0 ${imgW} ${imgH}`}>
            <Path d={frontArc} stroke={ringColor} strokeOpacity={0.35} strokeWidth={Math.max(4, imgH * 0.018)} fill="none" strokeLinecap="round" />
            <Path d={frontArc} stroke="#D9FFEE" strokeOpacity={0.55} strokeWidth={Math.max(1, imgH * 0.004)} fill="none" />
          </Svg>
        </Animated.View>

        {/* Highlight travelling along the ring, with a fading tail */}
        {reduceMotion
          ? null
          : COMET_TRAIL.map((lag, i) => (
              <CometDot
                key={i}
                progress={comet}
                lag={lag}
                strength={1 - i / COMET_TRAIL.length}
                cx={rcx}
                cy={rcy}
                rx={rrx}
                ry={rry}
                w={cometW * (1 - i * 0.12)}
                h={cometH * (1 - i * 0.12)}
                color={ringColor}
                id={i}
              />
            ))}
      </Animated.View>

      {children}
    </View>
  );
}

function CometDot({
  progress,
  lag,
  strength,
  cx,
  cy,
  rx,
  ry,
  w,
  h,
  color,
  id,
}: {
  progress: SharedValue<number>;
  lag: number;
  strength: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  w: number;
  h: number;
  color: string;
  id: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value - lag;
    if (p <= 0 || p >= 1) return { opacity: 0 };
    // Left end (angle π) → under the car (π/2) → right end (0): the visible front of the ring
    const t = Math.PI * (1 - p);
    const x = cx + rx * Math.cos(t);
    const y = cy + ry * Math.sin(t);
    const angle = Math.atan2(ry * Math.cos(t), -rx * Math.sin(t));
    return {
      // Fades in and out at the ends, where the ring turns away behind the platform
      opacity: strength * Math.sin(p * Math.PI),
      transform: [{ translateX: x - w / 2 }, { translateY: y - h / 2 }, { rotate: `${angle}rad` }],
    };
  });
  return (
    <Animated.View style={[styles.abs, { left: 0, top: 0, width: w, height: h }, style, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={`kgComet${id}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="0.3" stopColor={color} stopOpacity={0.9} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#kgComet${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: '#050807',
    overflow: 'hidden',
  },
  abs: {
    position: 'absolute',
  },
});
