import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Field, FormRow, Screen, SimulatedNote } from '../components/kit';
import { useApp } from '../context/AppContext';
import { parseISODate } from '../lib/format';
import { register } from '../services/auth';
import { useThemeColors } from '../theme';

export default function RegisterScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { customers, addCustomer, today, showToast } = useApp();
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', dob: '', password: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const errors = {
    firstName: form.firstName.trim() ? undefined : 'Enter your first name',
    lastName: form.lastName.trim() ? undefined : 'Enter your last name',
    phone: /^\+?[0-9 ]{10,15}$/.test(form.phone.trim()) ? undefined : 'Enter a valid phone number',
    email: /^\S+@\S+\.\S+$/.test(form.email.trim()) ? undefined : 'Enter a valid email',
    dob: parseISODate(form.dob) ? undefined : 'Use YYYY-MM-DD',
    password: form.password.length >= 8 ? undefined : 'Use at least 8 characters',
  };

  const submit = async () => {
    setTried(true);
    setError('');
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      const customer = await register(form, customers, today);
      addCustomer(customer);
      showToast('Account created. Upload your documents from Profile before pickup.');
      router.replace('/(tabs)' as any);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.nav, paddingTop: insets.top }}>
      <Screen maxWidth={520} contentStyle={{ paddingTop: 24 }}>
        <Card>
          <Text style={{ color: colors.txt, fontSize: 22, fontWeight: '800', marginBottom: 14 }}>Create your account</Text>
          <FormRow>
            <Field label="First name" value={form.firstName} onChangeText={set('firstName')} required error={tried ? errors.firstName : undefined} />
            <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} required error={tried ? errors.lastName : undefined} />
          </FormRow>
          <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" required error={tried ? errors.phone : undefined} />
          <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" required error={tried ? errors.email : undefined} />
          <Field label="Date of birth" value={form.dob} onChangeText={set('dob')} placeholder="YYYY-MM-DD" required error={tried ? errors.dob : undefined} />
          <Field label="Password" secureTextEntry value={form.password} onChangeText={set('password')} required error={tried ? errors.password : undefined} />
          {error ? <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 10 }}>{error}</Text> : null}
          <Button label={busy ? 'Creating account…' : 'Create account'} fullWidth size="lg" disabled={busy} onPress={submit} />
          <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 14 }}>
            Already registered?{' '}
            <Link href={'/login' as any} replace style={{ color: colors.primaryText, fontWeight: '700' }}>
              Sign in
            </Link>
          </Text>
          <SimulatedNote>Your account is stored on this device only until the KeyGo backend is connected.</SimulatedNote>
        </Card>
      </Screen>
    </View>
  );
}
