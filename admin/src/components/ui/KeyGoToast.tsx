import React from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';

export const KeyGoToast: React.FC = () => {
  const { toast } = useApp();
  return <KeyGoToastView message={toast.visible ? toast.message : ''} />;
};

/** The toast itself, for pages without the main data store (the driver page). */
export function KeyGoToastView({ message }: { message: string; onHide?: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isPhone } = useResponsive();
  if (!message) return null;
  return (
    // A small card in the bottom-right corner; across the bottom on phones
    <Animated.View accessibilityRole="alert" style={[styles.toastContainer, isPhone ? styles.phone : styles.corner]}>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    boxShadow: `0px 12px 28px ${withAlpha(colors.shadow, 0.18)}`,
    zIndex: 999,
  } as never,
  corner: { right: 24, bottom: 24, maxWidth: 380 },
  phone: { left: 16, right: 16, bottom: 24 },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    flexShrink: 1,
    color: colors.txt,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
