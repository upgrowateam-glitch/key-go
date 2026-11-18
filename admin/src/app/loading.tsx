'use client';

import { ActivityIndicator, View } from 'react-native';
import { useThemeColors } from '../theme';

/** Shown by the App Router while the next page's code and data are still on their way, so a navigation gives immediate feedback. */
export default function Loading() {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
