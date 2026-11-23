import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Moon, Sparkles, Sun, SunMedium } from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { callName, greetingAt } from '../../lib/names';
import { KeyGoHeader } from '../ui/KeyGoHeader';
import { useThemedStyles, useThemeColors, withAlpha, type ThemeColors } from '../../theme';

/** Home header bar, a greeting for the signed-in customer ("Good morning, Arjun"), and the headline below it. */
export function HomeHero({ width, gutter }: { width: number; gutter: number }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const titleSize = Math.round(Math.min(width * 0.085, 40));
  const { customers, currentCustomerId } = useApp();
  const name = callName(customers.find((c) => c.id === currentCustomerId));
  // the greeting follows the phone's clock (checked every minute, so it changes at noon and 5 pm)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const greeting = greetingAt(now);
  const GreetIcon = greeting.part === 'morning' ? SunMedium : greeting.part === 'afternoon' ? Sun : Moon;

  return (
    <View style={styles.wrap}>
      <KeyGoHeader />
      <View style={[styles.copy, { paddingHorizontal: gutter }]}>
        <View style={styles.greetRow} accessible accessibilityRole="header" accessibilityLabel={name ? `${greeting.text}, ${name}` : greeting.text}>
          <View style={styles.greetIcon}>
            <GreetIcon size={18} color={colors.highlight} />
          </View>
          <Text style={styles.greet} numberOfLines={1}>
            {greeting.text}
            {name ? <Text style={styles.greetName}>, {name}</Text> : null}
          </Text>
        </View>
        <View style={styles.badge}>
          <Sparkles size={14} color={colors.primary} />
          <Text style={styles.badgeText}>Premium rentals, delivered</Text>
        </View>
        <Text style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.18) }]} accessibilityRole="header">
          Drive the car{'\n'}you <Text style={styles.accent}>actually</Text> want.
        </Text>
        <Text style={styles.lead}>Premium rentals delivered to your door in under 60 minutes. No paperwork, no hidden fees.</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { backgroundColor: colors.bg },
    copy: { paddingTop: 20, paddingBottom: 4 },
    greetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    greetIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.highlight, 0.16) },
    greet: { flex: 1, color: colors.muted, fontSize: 18, fontWeight: '600' },
    greetName: { color: colors.txt, fontWeight: '800' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 7,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.secondary, 0.35),
      backgroundColor: withAlpha(colors.secondary, 0.22),
    },
    badgeText: { color: colors.primary, fontSize: 12.5, fontWeight: '700' },
    title: { color: colors.txt, fontWeight: '800', letterSpacing: -0.8, marginTop: 18 },
    accent: { color: colors.primary },
    lead: { color: colors.muted, fontSize: 14.5, lineHeight: 21, marginTop: 14 },
  });
