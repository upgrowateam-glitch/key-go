'use client';

import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'next/navigation';
import { Button, Card, Field, Screen } from '../../components/kit';
import { KeyGoLogo } from '../../components/ui/KeyGoLogo';
import { useStaffSession } from '../../components/portal/PortalShell';
import { signIn } from '../../services/auth';
import { useThemeColors } from '../../theme';

export default function LoginPage() {
  const colors = useThemeColors();
  const router = useRouter();
  const { refresh } = useStaffSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const emailError = /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : 'Enter a valid work email';
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.nav }}>
      <Screen maxWidth={440} contentStyle={{ paddingTop: 64 }}>
        <Card>
          <View style={{ backgroundColor: colors.nav, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <KeyGoLogo size={34} showText />
          </View>
          <Text style={{ color: colors.txt, fontSize: 22, fontWeight: '800', marginBottom: 4 }}>Sign in to KeyGo Admin</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 16 }}>For KeyGo owners, administrators and staff.</Text>
          <Field label="Work email" value={email} onChangeText={setEmail} keyboardType="email-address" required error={tried ? emailError : undefined} />
          <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} required error={tried ? passwordError : undefined} />
          {error ? <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 10 }}>{error}</Text> : null}
          <Button label={busy ? 'Signing in…' : 'Sign in'} fullWidth disabled={busy} onPress={submit} />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>Use the staff account an Owner or Admin created for you. Forgot your password? Ask them to reset it in Settings → Users & roles.</Text>
        </Card>
      </Screen>
    </View>
  );
}
