import React from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

export const KeyGoToast: React.FC = () => {
  const { toast } = useApp();
  return <KeyGoToastView message={toast.visible ? toast.message : ''} />;
};

/** The toast itself, for pages without the main data store (the driver page). */
export function KeyGoToastView({ message }: { message: string; onHide?: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  if (!message) return null;
  return (
    <Animated.View style={styles.toastContainer}>
      <View style={styles.iconWrap}>
        <CheckCircle2 size={16} color={colors.accentText} />
      </View>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 88,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 999,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    flex: 1,
    color: colors.txt,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
