import React, { useState, type ReactNode } from 'react';
import { Image, Text, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { KeyGoLogo } from './KeyGoLogo';
import { GLASS } from './GlassField';

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
const SIDE = 20;
const BLUR = 22;

/**
 * Background for the sign-in and sign-up screens: a KeyGo picture under a dark green fade, the logo at the top and
 * the form on a frosted-glass card lower down. Scrolls when the keyboard is open.
 *
 * The glass: inside the card sits a blurred copy of the same picture, lined up with the picture behind the card (and
 * kept lined up while scrolling), under a light tint and a fine white border. This looks like a real background blur
 * without needing a native blur module.
 */
export function AuthBackdrop({
  image,
  title,
  subtitle,
  maxWidth = 480,
  titleInCard = false,
  children,
}: {
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
  maxWidth?: number;
  /** Long forms: put the title inside the card so it never sits on a busy part of the picture. */
  titleInCard?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const top = insets.top + 16;
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const [column, setColumn] = useState({ w: 0 });
  const [card, setCard] = useState({ x: 0, y: 0 });
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // Where the card sits on the screen (before scrolling), so the blurred copy lines up with the picture behind it
  const cardLeft = SIDE + Math.max(0, (screen.w - SIDE * 2 - column.w) / 2) + card.x;
  const cardTop = top + card.y;
  const behind = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.value }] }));

  return (
    <View
      style={{ flex: 1, backgroundColor: '#072A20' }}
      onLayout={(e: LayoutChangeEvent) => setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Image source={image} resizeMode="cover" style={[FILL, { width: '100%', height: '100%' }]} />
      <Svg style={FILL} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id="authFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#072A20" stopOpacity="0.55" />
            <Stop offset="0.3" stopColor="#072A20" stopOpacity="0.2" />
            <Stop offset="0.6" stopColor="#072A20" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#072A20" stopOpacity="0.85" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#authFade)" />
      </Svg>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: top, paddingBottom: insets.bottom + 24, paddingHorizontal: SIDE }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}>
        <View
          style={{ width: '100%', maxWidth, alignSelf: 'center', flexGrow: 1 }}
          onLayout={(e: LayoutChangeEvent) => setColumn({ w: e.nativeEvent.layout.width })}>
          <KeyGoLogo size={36} showText />
          {/* pushes the welcome text and the form towards the bottom, over the darker part of the picture */}
          <View style={{ flexGrow: 1, minHeight: 120 }} />
          {titleInCard ? null : (
            <>
              <Text style={{ color: GLASS.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>{title}</Text>
              <Text style={{ color: GLASS.soft, fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 18 }}>{subtitle}</Text>
            </>
          )}
          <View
            onLayout={(e: LayoutChangeEvent) => setCard({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y })}
            style={{
              borderRadius: 26,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.26)',
              backgroundColor: 'rgba(7,42,32,0.35)',
            }}>
            {/* frosted glass: the picture behind the card, blurred */}
            {screen.w ? (
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -cardLeft, top: -cardTop, width: screen.w, height: screen.h }, behind]}>
                <Image source={image} resizeMode="cover" blurRadius={BLUR} style={{ width: '100%', height: '100%' }} />
              </Animated.View>
            ) : null}
            {/* tint, plus a soft light edge at the top like glass */}
            <View pointerEvents="none" style={[FILL, { backgroundColor: 'rgba(10,46,34,0.42)' }]} />
            <Svg style={FILL} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
              <Defs>
                <LinearGradient id="glassSheen" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
                  <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0.04" />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="100" fill="url(#glassSheen)" />
            </Svg>
            <View style={{ padding: 22 }}>
              {titleInCard ? (
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ color: GLASS.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.4 }}>{title}</Text>
                  <Text style={{ color: GLASS.soft, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{subtitle}</Text>
                </View>
              ) : null}
              {children}
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
