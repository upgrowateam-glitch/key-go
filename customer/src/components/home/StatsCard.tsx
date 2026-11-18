import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Route, Star, Users } from 'lucide-react-native';
import { boxShadow, useThemedStyles, useThemeColors, type ThemeColors } from '../../theme';

const STATS = [
  { value: '50K+', label: 'Happy drivers', Icon: Users, gold: false },
  { value: '4.9 / 5', label: 'Avg rating', Icon: Star, gold: true },
  { value: '24/7', label: 'Road support', Icon: Route, gold: false },
];

export function StatsCard() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      {STATS.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.item}>
            <s.Icon size={18} color={s.gold ? colors.highlight : colors.primaryText} fill={s.gold ? colors.highlight : 'none'} />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {s.value}
              </Text>
              <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
                {s.label}
              </Text>
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 14,
      paddingHorizontal: 8,
      ...boxShadow(colors.shadow, { y: 6, blur: 14, opacity: 0.1 }),
      elevation: 3,
    },
    item: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 0 },
    divider: { width: 1, height: 32, backgroundColor: colors.line },
    value: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    label: { color: colors.muted, fontSize: 10.5, marginTop: 1 },
  });
