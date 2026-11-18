import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { DownloadCloud } from 'lucide-react-native';
import { Button } from '../kit';
import { boxShadow, useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

/** Don't ask the update server more often than this when the app keeps coming back to the foreground. */
const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Over-the-air updates for the installed APK.
 *
 * When a new version of the app's screens and logic has been published (`eas update`), this shows a card
 * with an Update button. Tapping it downloads the new version and restarts the app into it, so people
 * don't have to install a new APK. Updates only reach APKs with the same runtime version (the app version
 * in app.json), so a published update never lands on an APK that cannot run it.
 *
 * Inactive in development and on the web, where expo-updates is disabled.
 */
export function AppUpdatePrompt() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (!Updates.isEnabled || Date.now() - lastCheck.current < MIN_CHECK_INTERVAL_MS) return;
    lastCheck.current = Date.now();
    try {
      await Updates.checkForUpdateAsync();
    } catch {
      // Offline or the update server is unreachable: try again on the next check
    }
  }, []);

  // Check on launch and whenever the app comes back to the foreground
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  // A newly found update brings the card back even if an earlier one was dismissed
  useEffect(() => {
    if (isUpdateAvailable) setDismissed(false);
  }, [isUpdateAvailable]);

  const update = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (!isUpdatePending) await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  if (!Updates.isEnabled || !(isUpdateAvailable || isUpdatePending) || dismissed) return null;

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <DownloadCloud size={18} color={colors.onPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>New version available</Text>
        <Text style={styles.message}>{failed ? 'The update could not be downloaded. Check your connection and try again.' : 'Update now to get the latest KeyGo improvements.'}</Text>
        <View style={styles.actions}>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.message}>Updating…</Text>
            </View>
          ) : (
            <>
              <Button label={failed ? 'Try again' : 'Update'} size="sm" onPress={update} />
              <Button label="Later" size="sm" variant="ghost" onPress={() => setDismissed(true)} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 96,
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.cardElevated,
      zIndex: 1000,
      elevation: 12,
      ...boxShadow(colors.shadow, { y: 8, blur: 20, opacity: 0.18 }),
    },
    iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    title: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    message: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    busyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
