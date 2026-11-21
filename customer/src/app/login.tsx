import React, { useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { Button } from '../components/kit';
import { GLASS, GlassField } from '../components/ui/GlassField';
import { AuthBackdrop } from '../components/ui/AuthBackdrop';
import { signIn } from '../services/auth';
import { phoneDigits, useContact } from '../hooks/useContact';

export default function LoginScreen() {
  const router = useRouter();
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
    <AuthBackdrop
      image={require('../../assets/images/onboarding-1.jpg')}
      title="Welcome back"
      subtitle="Sign in to book a car, sign your agreement and follow your trip.">
      <View>
        <GlassField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail size={18} color={GLASS.soft} />}
          required
          error={tried ? emailError : undefined}
        />
        <GlassField
          label="Password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          icon={<Lock size={18} color={GLASS.soft} />}
          required
          error={tried ? passwordError : undefined}
        />
        {error ? <Text style={{ color: GLASS.error, fontSize: 13, marginBottom: 10, fontWeight: '600' }}>{error}</Text> : null}
        <Button label={busy ? 'Signing in…' : 'Sign in'} variant="highlight" fullWidth size="lg" disabled={busy} onPress={submit} />
        <TouchableOpacity accessibilityRole="button" onPress={() => setForgot((f) => !f)} style={{ alignSelf: 'center', marginTop: 12, padding: 4 }}>
          <Text style={{ color: GLASS.link, fontSize: 13, fontWeight: '700' }}>Forgot password?</Text>
        </TouchableOpacity>
        {forgot ? (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderWidth: 1,
              borderColor: GLASS.fieldBorder,
              borderRadius: 14,
              padding: 12,
              marginTop: 6,
              gap: 8,
            }}>
            <Text style={{ color: GLASS.text, fontSize: 13, lineHeight: 19 }}>
              Contact KeyGo and we will set a new password for you after checking it&apos;s you. You can change it later in Profile → Privacy & Security.
            </Text>
            {contact?.phone ? (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  label="WhatsApp KeyGo"
                  size="sm"
                  variant="highlight"
                  onPress={() =>
                    Linking.openURL(
                      `https://wa.me/${phoneDigits(contact.phone)}?text=${encodeURIComponent(`Hi KeyGo, I forgot my app password. My email is ${email.trim() || '(email)'}.`)}`
                    )
                  }
                />
                <Button
                  label={`Call ${contact.phone}`}
                  size="sm"
                  variant="outline"
                  onPress={() => Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`)}
                />
              </View>
            ) : (
              <Text style={{ color: GLASS.soft, fontSize: 12.5 }}>Visit or call your KeyGo office.</Text>
            )}
          </View>
        ) : null}
        <Text style={{ color: GLASS.soft, fontSize: 13, textAlign: 'center', marginTop: 14 }}>
          New to KeyGo?{' '}
          <Link href={'/register' as any} replace style={{ color: GLASS.link, fontWeight: '700' }}>
            Create an account
          </Link>
        </Text>
      </View>
    </AuthBackdrop>
  );
}
