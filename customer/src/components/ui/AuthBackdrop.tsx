import React, { type ReactNode } from 'react';
import { Image, ScrollView, Text, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { KeyGoLogo } from './KeyGoLogo';

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Background for the sign-in and sign-up screens: a KeyGo picture under a dark green fade, the logo and a welcome
 * line at the top, and the form (children) lower down. Scrolls when the keyboard is open.
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
  return (
    <View style={{ flex: 1, backgroundColor: '#072A20' }}>
      <Image source={image} resizeMode="cover" style={[FILL, { width: '100%', height: '100%' }]} />
      <Svg style={FILL} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id="authFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#072A20" stopOpacity="0.55" />
            <Stop offset="0.3" stopColor="#072A20" stopOpacity="0.25" />
            <Stop offset="0.55" stopColor="#072A20" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#072A20" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#authFade)" />
      </Svg>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth, alignSelf: 'center', flexGrow: 1 }}>
          <KeyGoLogo size={36} showText />
          {/* pushes the welcome text and the form towards the bottom, over the darker part of the picture */}
          <View style={{ flexGrow: 1, minHeight: 120 }} />
          {titleInCard ? null : (
            <>
              <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '800', letterSpacing: -0.6 }}>{title}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 18 }}>{subtitle}</Text>
            </>
          )}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 24,
              padding: 20,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 10,
            }}>
            {titleInCard ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#1F2421', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>{title}</Text>
                <Text style={{ color: '#5B6B62', fontSize: 14, lineHeight: 20, marginTop: 4 }}>{subtitle}</Text>
              </View>
            ) : null}
            {children}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
