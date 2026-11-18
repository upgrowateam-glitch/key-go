import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  accentColor?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  accentColor,
  icon,
}) => {
  const colors = useThemeColors();
  accentColor = accentColor ?? colors.accentText;
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {icon ? <View style={styles.iconBox}>{icon}</View> : null}
        {badge ? (
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      
      <Text style={[styles.valueText, { color: accentColor }]}>{value}</Text>
      <Text style={styles.titleText}>{title}</Text>
      {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.bg2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: colors.bg2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  valueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  titleText: {
    color: colors.txt,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  subtitleText: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
});
