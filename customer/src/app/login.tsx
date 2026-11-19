import React, { useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, Screen } from '../components/kit';
import { KeyGoLogo } from '../components/ui/KeyGoLogo';
import { signIn } from '../services/auth';
import { phoneDigits, useContact } from '../hooks/useContact';
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
  const [forgot, setForgot] = useState(false);
  const { contact } = useContact();

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
          <TouchableOpacity accessibilityRole="button" onPress={() => setForgot((f) => !f)} style={{ alignSelf: 'center', marginTop: 12, padding: 4 }}>
            <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: '700' }}>Forgot password?</Text>
          </TouchableOpacity>
          {forgot ? (
            <View style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 12, marginTop: 6, gap: 8 }}>
              <Text style={{ color: colors.txt, fontSize: 13, lineHeight: 19 }}>
                Contact KeyGo and we will set a new password for you after checking it&apos;s you. You can change it later in Profile → Privacy & Security.
              </Text>
              {contact?.phone ? (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button
                    label="WhatsApp KeyGo"
                    size="sm"
                    onPress={() => Linking.openURL(`https://wa.me/${phoneDigits(contact.phone)}?text=${encodeURIComponent(`Hi KeyGo, I forgot my app password. My email is ${email.trim() || '(email)'}.`)}`)}
                  />
                  <Button label={`Call ${contact.phone}`} size="sm" variant="outline" onPress={() => Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`)} />
                </View>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 12.5 }}>Visit or call your KeyGo office.</Text>
              )}
            </View>
          ) : null}
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
