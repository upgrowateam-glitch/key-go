import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Lock, Mail, Phone, User } from 'lucide-react-native';
import { Button, FormRow } from '../components/kit';
import { GLASS, GlassField } from '../components/ui/GlassField';
import { GlassDateField } from '../components/ui/GlassDateField';
import { AuthBackdrop } from '../components/ui/AuthBackdrop';
import { useApp } from '../context/AppContext';
import { parseISODate } from '../lib/format';
import { register } from '../services/auth';

export default function RegisterScreen() {
  const router = useRouter();
  const { showToast } = useApp();
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
      await register(form);
      showToast('Account created. Upload your documents from Profile before pickup.');
      router.replace('/(tabs)' as any);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthBackdrop
      image={require('../../assets/images/onboarding-3.jpg')}
      title="Create your account"
      subtitle="It takes a minute. Add your documents later from your profile."
      maxWidth={520}
      titleInCard>
      <View>
        <FormRow>
          <GlassField
            label="First name"
            value={form.firstName}
            onChangeText={set('firstName')}
            autoComplete="given-name"
            placeholder="e.g. Arjun"
            icon={<User size={18} color={GLASS.soft} />}
            required
            error={tried ? errors.firstName : undefined}
          />
          <GlassField
            label="Last name"
            value={form.lastName}
            onChangeText={set('lastName')}
            autoComplete="family-name"
            placeholder="e.g. Menon"
            icon={<User size={18} color={GLASS.soft} />}
            required
            error={tried ? errors.lastName : undefined}
          />
        </FormRow>
        <GlassField
          label="Phone"
          value={form.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="98765 43210"
          icon={<Phone size={18} color={GLASS.soft} />}
          required
          error={tried ? errors.phone : undefined}
        />
        <GlassField
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail size={18} color={GLASS.soft} />}
          required
          error={tried ? errors.email : undefined}
        />
        <GlassDateField
          label="Date of birth"
          value={form.dob}
          onChange={set('dob')}
          placeholder="Pick your date of birth"
          required
          error={tried ? errors.dob : undefined}
        />
        <GlassField
          label="Password"
          secureTextEntry
          autoComplete="new-password"
          value={form.password}
          onChangeText={set('password')}
          placeholder="At least 8 characters"
          icon={<Lock size={18} color={GLASS.soft} />}
          required
          error={tried ? errors.password : undefined}
        />
        {error ? <Text style={{ color: GLASS.error, fontSize: 13, marginBottom: 10, fontWeight: '600' }}>{error}</Text> : null}
        <Button label={busy ? 'Creating account…' : 'Create account'} variant="highlight" fullWidth size="lg" disabled={busy} onPress={submit} />
        <Text style={{ color: GLASS.soft, fontSize: 13, textAlign: 'center', marginTop: 14 }}>
          Already registered?{' '}
          <Link href={'/login' as any} replace style={{ color: GLASS.link, fontWeight: '700' }}>
            Sign in
          </Link>
        </Text>
      </View>
    </AuthBackdrop>
  );
}
