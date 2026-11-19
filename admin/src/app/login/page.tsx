'use client';

import React, { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'next/navigation';
import Svg, { Path } from 'react-native-svg';
import { Eye, EyeOff, Info, LockKeyhole, LogIn, Mail } from 'lucide-react-native';
import { Button, Field } from '../../components/kit';
import { KeyGoLogo } from '../../components/ui/KeyGoLogo';
import { useStaffSession } from '../../components/portal/PortalShell';
import { useResponsive } from '../../hooks/useResponsive';
import { signIn } from '../../services/auth';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';

const BACKGROUND = { uri: '/images/login-bg.jpg' };

export default function LoginPage() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { width } = useResponsive();
  const { refresh } = useStaffSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Side by side on wide screens; stacked above the card on phones and small tablets
  const wide = width >= 960;

  // Staff sign in with their email or the WhatsApp number they were added with
  const emailError = /^\S+@\S+\.\S+$/.test(email.trim()) || email.replace(/\D/g, '').length >= 10 ? undefined : 'Enter your email or WhatsApp number';
  const passwordError = password ? undefined : 'Enter your password';

  const submit = async () => {
    setTried(true);
    setError('');
    if (emailError || passwordError) return;
    setBusy(true);
    try {
      await signIn(email, password);
      refresh();
      router.replace('/dashboard');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const iconBox = (icon: React.ReactNode) => <View style={styles.fieldIcon}>{icon}</View>;

  return (
    <ImageBackground source={BACKGROUND} resizeMode="cover" style={styles.page}>
      {/* On narrow screens the light side of the photo sits behind the heading, so darken it a little */}
      {!wide ? <View style={styles.phoneShade} /> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.layout, wide ? styles.layoutWide : styles.layoutStacked]}>
        {/* Brand message over the green side of the photo */}
        <View style={[styles.brand, wide ? styles.brandWide : styles.brandStacked]}>
          <KeyGoLogo size={wide ? 46 : 40} showText />
          <Text style={[styles.headline, !wide && { fontSize: 30 }]}>
            Admin <Text style={{ color: colors.highlight }}>Portal</Text>
          </Text>
          <Text style={styles.tagline}>Manage. Monitor. Grow.</Text>
          <View style={styles.rule} />
          {wide ? <Text style={styles.lead}>Take control of your car rental business with powerful admin tools.</Text> : null}
        </View>

        {/* Sign-in card */}
        {/* Less see-through on phones, where the card sits over the darker shaded photo */}
        <View style={[styles.card, { width: wide ? 380 : Math.min(420, width - 32) }, !wide && { backgroundColor: withAlpha('#FFFFFF', 0.78) }]}>
          <View style={styles.cardHeader}>
            <KeyGoLogo size={30} showText />
            <Svg width={150} height={60} viewBox="0 0 150 60" style={styles.swoosh} preserveAspectRatio="none">
              <Path d="M150 6 C 110 40, 70 52, 20 60 L 150 60 Z" fill={withAlpha(colors.highlight, 0.18)} />
              <Path d="M150 20 C 118 44, 82 54, 46 60" stroke={colors.highlight} strokeWidth={3} fill="none" />
            </Svg>
          </View>

          <Text style={styles.title}>Sign in to KeyGo Admin</Text>
          <Text style={styles.subtitle}>For KeyGo owners, administrators and staff.</Text>

          <Field
            label="Email or WhatsApp number"
            required
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="Email or WhatsApp number"
            left={iconBox(<Mail size={15} color={colors.muted} />)}
            error={tried ? emailError : undefined}
          />
          <Field
            label="Password"
            required
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            left={iconBox(<LockKeyhole size={15} color={colors.muted} />)}
            right={
              <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                {showPassword ? <EyeOff size={17} color={colors.muted} /> : <Eye size={17} color={colors.muted} />}
              </Pressable>
            }
            error={tried ? passwordError : undefined}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Signing in…' : 'Sign in'} size="lg" fullWidth disabled={busy} icon={(c) => <LogIn size={17} color={c} />} onPress={submit} />

          <View style={styles.note}>
            <Info size={16} color={colors.primaryText} />
            <Text style={styles.noteText}>Use the staff account an Owner or Admin created for you. Forgot your password? Ask them to reset it in Settings → Users & roles.</Text>
          </View>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    page: { flex: 1, minHeight: '100vh' as never, backgroundColor: colors.nav },
    layout: { flexGrow: 1, width: '100%' },
    // Wide: the card sits at the right edge over the city and the brand message in the top-left corner over the green
    layoutWide: { alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 40, paddingRight: '13%' as never, minHeight: '100vh' as never },
    layoutStacked: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 32, paddingBottom: 32, gap: 24 },
    phoneShade: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.nav, 0.55) },
    brand: { gap: 10 },
    brandWide: { position: 'absolute', top: '7%', left: '4.5%', width: 330 },
    brandStacked: { width: '100%', maxWidth: 420 },
    headline: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', letterSpacing: -0.8, marginTop: 18 },
    tagline: { color: '#FFFFFF', fontSize: 17, fontWeight: '500' },
    rule: { width: 46, height: 3, borderRadius: 2, backgroundColor: colors.highlight, marginVertical: 6 },
    lead: { color: withAlpha('#FFFFFF', 0.9), fontSize: 14.5, lineHeight: 22, maxWidth: 280 },
    // Frosted glass: the photo shows through, blurred, so the text stays readable
    card: {
      backgroundColor: withAlpha('#FFFFFF', 0.42),
      borderWidth: 1,
      borderColor: withAlpha('#FFFFFF', 0.65),
      borderRadius: 20,
      padding: 18,
      backdropFilter: 'blur(16px) saturate(140%)',
      boxShadow: `0px 18px 40px ${withAlpha(colors.shadow, 0.18)}`,
    } as never,
    cardHeader: { backgroundColor: colors.nav, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18, overflow: 'hidden' },
    swoosh: { position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none' },
    title: { color: colors.txt, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
    subtitle: { color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 16 },
    fieldIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: withAlpha(colors.primary, 0.08), alignItems: 'center', justifyContent: 'center' },
    error: { color: colors.danger, fontSize: 13, marginBottom: 10 },
    note: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'flex-start' },
    noteText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  });
