'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { Button, Field } from '../../components/kit';
import { KeyGoLogo } from '../../components/ui/KeyGoLogo';
import { useStaffSession } from '../../components/portal/PortalShell';
import { useResponsive } from '../../hooks/useResponsive';
import { acceptInvite, fetchInvite, type StaffRole } from '../../services/auth';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';

const BACKGROUND = { uri: '/images/login-bg.jpg' };

/** Opened from an invitation link: the new staff member sets their own password and is signed in. */
function InviteCard() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const { width } = useResponsive();
  const { refresh } = useStaffSession();
  const [invite, setInvite] = useState<{ name: string; email: string; phone?: string; role: StaffRole } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('This invitation link is incomplete. Open the full link you were sent.');
      return;
    }
    fetchInvite(token).then(setInvite, (e: Error) => setLoadError(e.message));
  }, [token]);

  const passwordError = password.length < 8 ? 'Use at least 8 characters' : undefined;
  const againError = again !== password ? 'The two passwords do not match' : undefined;

  const submit = async () => {
    setTried(true);
    setError('');
    if (passwordError || againError) return;
    setBusy(true);
    try {
      await acceptInvite(token, password);
      refresh();
      router.replace('/dashboard');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const eye = (
    <Pressable accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow((s) => !s)} hitSlop={8}>
      {show ? <EyeOff size={17} color={colors.muted} /> : <Eye size={17} color={colors.muted} />}
    </Pressable>
  );

  return (
    <View style={[styles.card, { width: Math.min(420, width - 32) }]}>
      <View style={styles.cardHeader}>
        <KeyGoLogo size={30} showText />
      </View>
      {loadError ? (
        <View style={{ gap: 12 }}>
          <View style={styles.row}>
            <CircleAlert size={20} color={colors.danger} />
            <Text style={styles.title}>Invitation not available</Text>
          </View>
          <Text style={styles.subtitle}>{loadError}</Text>
          <Button label="Go to sign in" variant="outline" onPress={() => router.replace('/login')} />
        </View>
      ) : !invite ? (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View>
          <Text style={styles.title}>Welcome to KeyGo, {invite.name.split(' ')[0]}</Text>
          <Text style={styles.subtitle}>
            You were invited as <Text style={{ fontWeight: '800', color: colors.txt }}>{invite.role === 'Owner' ? 'Owner (Super Admin)' : invite.role}</Text>. Choose a password to finish setting up your account.
          </Text>
          <Field label={invite.email ? 'Email' : 'WhatsApp number'} value={invite.email || invite.phone || ''} editable={false} hint={invite.email && invite.phone ? `You can sign in with this email or ${invite.phone}.` : 'You will sign in with this.'} />
          <Field label="New password" required secureTextEntry={!show} value={password} onChangeText={setPassword} left={<LockKeyhole size={15} color={colors.muted} />} right={eye} error={tried ? passwordError : undefined} hint="At least 8 characters." />
          <Field label="New password again" required secureTextEntry={!show} value={again} onChangeText={setAgain} left={<LockKeyhole size={15} color={colors.muted} />} error={tried ? againError : undefined} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Setting up…' : 'Set password and sign in'} size="lg" fullWidth disabled={busy} icon={(c) => <ShieldCheck size={17} color={c} />} onPress={submit} />
          <Text style={[styles.subtitle, { marginTop: 12, marginBottom: 0 }]}>This link works once. Keep your password private.</Text>
        </View>
      )}
    </View>
  );
}

export default function InvitePage() {
  const styles = useThemedStyles(makeStyles);
  return (
    <ImageBackground source={BACKGROUND} resizeMode="cover" style={styles.page}>
      <View style={styles.shade} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.layout}>
        <Suspense fallback={null}>
          <InviteCard />
        </Suspense>
      </ScrollView>
    </ImageBackground>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    page: { flex: 1, minHeight: '100vh' as never, backgroundColor: colors.nav },
    shade: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.nav, 0.45) },
    layout: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 16, minHeight: '100vh' as never },
    card: {
      backgroundColor: withAlpha('#FFFFFF', 0.86),
      borderWidth: 1,
      borderColor: withAlpha('#FFFFFF', 0.65),
      borderRadius: 20,
      padding: 18,
      backdropFilter: 'blur(16px) saturate(140%)',
      boxShadow: `0px 18px 40px ${withAlpha(colors.shadow, 0.22)}`,
    } as never,
    cardHeader: { backgroundColor: colors.nav, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: colors.txt, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
    subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 16 },
    error: { color: colors.danger, fontSize: 13, marginBottom: 10 },
  });
