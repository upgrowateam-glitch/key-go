import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles, type ThemeColors } from '../../theme';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  rightElement,
}) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBar} />
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  eyebrowBar: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  eyebrow: {
    color: colors.accentText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.txt,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 26,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  right: {
    justifyContent: 'center',
  },
});
