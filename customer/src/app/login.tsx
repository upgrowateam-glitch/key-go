import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, Screen } from '../components/kit';
import { KeyGoLogo } from '../components/ui/KeyGoLogo';
import { signIn } from '../services/auth';
import { useThemeColors } from '../theme';

export default function LoginScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emailError = /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : 'Enter a valid email';
  const passwordError = password ? undefined : 'Enter your password';

  const submit = async () => {
    setTried(true);
    setError('');
    if (emailError || passwordError) return;
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)' as any);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.nav, paddingTop: insets.top }}>
      <Screen maxWidth={480} contentStyle={{ paddingTop: 32 }}>
        <View style={{ marginBottom: 20 }}>
          <KeyGoLogo size={40} showText />
        </View>
        <Card>
          <Text style={{ color: colors.txt, fontSize: 22, fontWeight: '800', marginBottom: 14 }}>Welcome back</Text>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" required error={tried ? emailError : undefined} />
          <Field label="Password" secureTextEntry value={password} onChangeText={setPassword} required error={tried ? passwordError : undefined} />
          {error ? <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 10 }}>{error}</Text> : null}
          <Button label={busy ? 'Signing in…' : 'Sign in'} fullWidth size="lg" disabled={busy} onPress={submit} />
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 14 }}>
            New to KeyGo?{' '}
            <Link href={'/register' as any} replace style={{ color: colors.primaryText, fontWeight: '700' }}>
              Create an account
            </Link>
          </Text>
        </Card>
      </Screen>
    </View>
  );
}
