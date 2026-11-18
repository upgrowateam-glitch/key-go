import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { KeyGoLogo } from '../components/ui/KeyGoLogo';
import { useAuth } from '../services/auth';
import { useThemeColors } from '../theme';

const SPLASH_MS = 900;

/** Branded splash, then routes to onboarding, sign-in or the app. */
export default function SplashScreen() {
  const colors = useThemeColors();
  const { onboarded, customerId } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (ready) return <Redirect href={(!onboarded ? '/onboarding' : customerId ? '/(tabs)' : '/login') as any} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.nav }}>
      <KeyGoLogo size={56} showText showTagline />
    </View>
  );
}
