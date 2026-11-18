import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { useReducedMotion } from 'react-native-reanimated';
import * as THREE from 'three';
import { PARKED_POSE_S, CarScene, CarScenePalette, createCarScene } from './car3d/carScene';
import { mix, useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

// Shown if the device can't run the 3D scene
const HERO_FALLBACK_IMAGE = require('../../../assets/images/hero_car_fallback.png');

interface TurntableCarProps {
  width?: number;
  height?: number;
}

// Real-time 3D hero: a procedural coupe assembles itself, then drives forward
export const TurntableCar: React.FC<TurntableCarProps> = ({
  width = 320,
  height = 180,
}) => {
  const reduceMotion = useReducedMotion();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const palette: CarScenePalette = {
    background: colors.bg,
    floor: mix(colors.bg, '#FFFFFF', 0.85),
    accent: colors.primary,
    paint: colors.primary,
    smoke: mix(colors.bg, colors.txt, 0.28),
  };
  // A new theme rebuilds the scene with the new colors
  const sceneKey = `${reduceMotion ? 'still' : 'animated'}-${colors.primary}-${colors.bg}`;
  const frameRef = useRef<number | null>(null);
  const sceneRef = useRef<CarScene | null>(null);
  const [glFailed, setGlFailed] = useState(false);

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    // A remount (e.g. reduced-motion toggled) creates a new context; tear down the old one
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    sceneRef.current?.dispose();

    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;

    // three.js expects a canvas; expo-gl only provides the context
    const canvas = {
      width: w,
      height: h,
      style: {},
      clientWidth: w,
      clientHeight: h,
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;

    let scene: CarScene;
    try {
      const renderer = createRenderer(gl, canvas);
      renderer.setPixelRatio(1);
      scene = createCarScene(renderer, w, h, {
        // Image-based reflections are reliable on web; native uses the studio lights only
        useEnvironment: Platform.OS === 'web',
        palette,
      });
    } catch (error) {
      console.warn('3D hero car unavailable, showing still image instead:', error);
      setGlFailed(true);
      return;
    }
    sceneRef.current = scene;

    const present = () => (gl as { endFrameEXP?: () => void }).endFrameEXP?.();

    if (reduceMotion) {
      scene.render(PARKED_POSE_S, 0);
      present();
      return;
    }

    // The clock starts once the first frame is on screen, so a slow first frame can't skip the intro
    let start = 0;
    let last = 0;
    const loop = () => {
      if (!sceneRef.current) return;
      const now = Date.now();
      if (start === 0) start = last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        scene.render((now - start) / 1000, dt);
      } catch (error) {
        console.warn('3D hero car render failed, showing still image instead:', error);
        sceneRef.current = null;
        scene.dispose();
        setGlFailed(true);
        return;
      }
      present();
      frameRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  return (
    <View style={[styles.container, { width, height }]}>
      {glFailed ? (
        <Image source={HERO_FALLBACK_IMAGE} style={StyleSheet.absoluteFill} resizeMode="contain" />
      ) : (
        <GLView
          key={sceneKey}
          style={StyleSheet.absoluteFill}
          onContextCreate={onContextCreate}
        />
      )}
    </View>
  );
};

// three.js (r163+) needs WebGL 2. expo-gl's WebGL2 context also passes `instanceof WebGLRenderingContext`
// (per the WebGL spec), which three.js misreads as WebGL 1 — so hide that global while constructing.
function createRenderer(gl: ExpoWebGLRenderingContext, canvas: HTMLCanvasElement) {
  const g = globalThis as { WebGLRenderingContext?: unknown; WebGL2RenderingContext?: unknown };
  const isWebGL2 =
    typeof g.WebGL2RenderingContext === 'function' &&
    gl instanceof (g.WebGL2RenderingContext as typeof WebGL2RenderingContext);
  if (!isWebGL2) {
    throw new Error('WebGL 2 is not available on this device');
  }

  const webgl1 = g.WebGLRenderingContext;
  g.WebGLRenderingContext = undefined;
  try {
    return new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  } finally {
    g.WebGLRenderingContext = webgl1;
  }
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
