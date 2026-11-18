import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Button, EmptyState } from '../kit';
import { useThemeColors } from '../../theme';

/** Shared loading and error states for anything loaded through a mock service. */
export function ResourceState({ loading, error, onRetry }: { loading?: boolean; error?: string; onRetry?: () => void }) {
  const colors = useThemeColors();
  if (error) {
    return (
      <EmptyState
        title="Could not load this page"
        message={error}
        icon={(c) => <AlertTriangle size={22} color={c} />}
        action={onRetry ? <Button label="Try again" onPress={onRetry} /> : undefined}
      />
    );
  }
  if (loading) {
    return (
      <View accessibilityLabel="Loading" style={{ padding: 48, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return null;
}
