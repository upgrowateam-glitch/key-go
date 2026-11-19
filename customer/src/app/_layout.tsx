import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, EmptyState } from '../components/kit';
import { AppUpdatePrompt } from '../components/ui/AppUpdatePrompt';
import { KeyGoToast } from '../components/ui/KeyGoToast';
import { AppProvider, SignedOutProvider } from '../context/AppContext';
import { useAuth } from '../services/auth';
import { loadWorkspace, type Workspace } from '../services/workspace';
import { ThemeProvider, useThemeColors } from '../theme';

function ThemedStack() {
  const colors = useThemeColors();
  return (
    <>
      {/* Status bar sits on the primary-colored nav bar */}
      <StatusBar style={colors.onNav === '#FFFFFF' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="car/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="booking/index" />
        <Stack.Screen name="rental/[id]/index" />
        <Stack.Screen name="rental/[id]/agreement" />
        <Stack.Screen name="rental/[id]/pay" />
        <Stack.Screen name="rental/[id]/track" />
        <Stack.Screen name="account/[section]" />
      </Stack>
      <KeyGoToast />
      <AppUpdatePrompt />
    </>
  );
}

/** Signed in: loads the customer's data from the KeyGo server. Signed out: only the sign-in screens are needed. */
function Workspace_() {
  const colors = useThemeColors();
  const { token, customerId } = useAuth();
  // The web build first renders as signed out and only then reads the saved sign-in. Waiting for that keeps a
  // deep link (a trip, the profile) from being redirected to sign-in and back to Home.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!token || !customerId) {
    return (
      <SignedOutProvider>
        <ThemedStack />
      </SignedOutProvider>
    );
  }
  return <SignedIn key={customerId} />;
}

function SignedIn() {
  const colors = useThemeColors();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [error, setError] = useState('');

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    loadWorkspace().then(setWorkspace, (e: Error) => setError(e.message));
  }, [attempt]);

  const load = () => {
    setError('');
    setAttempt((a) => a + 1);
  };

  if (!workspace) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        {error ? <EmptyState title="Could not load KeyGo" message={error} action={<Button label="Try again" onPress={load} />} /> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }
  return (
    <AppProvider seed={workspace}>
      <ThemedStack />
    </AppProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Workspace_ />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
