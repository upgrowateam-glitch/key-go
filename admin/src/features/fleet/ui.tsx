import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { daysBetween, formatDate } from '../../lib/format';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

/** Look-only building blocks for the vehicle pages (no behaviour of their own). */

export type Tint = 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'violet' | 'highlight';

function tint(colors: ThemeColors, t: Tint) {
  switch (t) {
    case 'success':
      return { fg: colors.success, bg: colors.successGlow };
    case 'info':
      return { fg: colors.info, bg: colors.infoGlow };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningGlow };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerGlow };
    case 'violet':
      return { fg: colors.violet, bg: colors.violetGlow };
    case 'highlight':
      return { fg: colors.onHighlight, bg: colors.highlightSoft };
    default:
      return { fg: colors.primaryText, bg: colors.primarySoft };
  }
}

/** Pill tabs with icons; scrolls sideways on small screens. */
export function VehicleTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly { label: T; icon: LucideIcon }[];
  value: T;
  onChange: (t: T) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tabsBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, padding: 4 }}>
        {tabs.map(({ label, icon: Icon }) => {
          const active = label === value;
          return (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(label)}
              style={(state) => [
                styles.tab,
                active ? { backgroundColor: colors.primary } : (state as { hovered?: boolean }).hovered ? { backgroundColor: colors.bg2 } : null,
              ]}>
              <Icon size={15} color={active ? colors.onPrimary : colors.muted} />
              <Text style={[styles.tabText, { color: active ? colors.onPrimary : colors.txt }]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Small coloured stat card: icon, label, value. */
export function HeroStat({ icon: Icon, label, value, hint, tone = 'primary' }: { icon: LucideIcon; label: string; value: string; hint?: string; tone?: Tint }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const t = tint(colors, tone);
  return (
    <View style={styles.heroStat}>
      <View style={[styles.iconBubble, { backgroundColor: t.bg }]}>
        <Icon size={16} color={t.fg} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
        {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

/** A labelled value with an icon, for detail grids. */
export function InfoTile({ icon: Icon, label, value, tone = 'primary' }: { icon: LucideIcon; label: string; value: React.ReactNode; tone?: Tint }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const t = tint(colors, tone);
  return (
    <View style={styles.infoTile}>
      <View style={[styles.iconBubbleSm, { backgroundColor: t.bg }]}>
        <Icon size={14} color={t.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statLabel}>{label}</Text>
        {typeof value === 'string' ? (
          <Text style={styles.infoValue} numberOfLines={2}>
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

/** Card heading with an icon, an optional line under it and an optional action on the right. */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  tone = 'primary',
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  tone?: Tint;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const t = tint(colors, tone);
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.iconBubble, { backgroundColor: t.bg }]}>
        <Icon size={16} color={t.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 180 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.statHint}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/**
 * How long a paper is still valid: a bar that empties towards the expiry date (green, orange in the last 30 days,
 * red when expired). Counts against a one-year validity.
 */
export function ExpiryMeter({ expiry, today }: { expiry?: string; today: string }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return <Text style={styles.statHint}>No expiry date recorded</Text>;
  const left = daysBetween(today, expiry);
  const color = left < 0 ? colors.danger : left <= 30 ? colors.warning : colors.success;
  const share = Math.max(0, Math.min(1, left / 365));
  return (
    <View style={{ gap: 5 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 8,
        }}>
        <Text style={[styles.statHint, { color, fontWeight: '700' }]}>
          {left < 0 ? `Expired ${-left} day${left === -1 ? '' : 's'} ago` : left === 0 ? 'Expires today' : `${left} day${left === 1 ? '' : 's'} left`}
        </Text>
        <Text style={styles.statHint}>{formatDate(expiry)}</Text>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: colors.bg2 }]}>
        <View
          style={{
            width: `${Math.max(left < 0 ? 100 : 3, share * 100)}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabsBar: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      marginBottom: 14,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
    },
    tabText: { fontSize: 13, fontWeight: '700' },
    heroStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexGrow: 1,
      flexBasis: '40%',
    },
    iconBubble: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBubbleSm: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    statValue: { color: colors.txt, fontSize: 17, fontWeight: '800' },
    statHint: { color: colors.muted, fontSize: 11.5 },
    infoTile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.bg,
      flexGrow: 1,
      flexBasis: 200,
    },
    infoValue: { color: colors.txt, fontSize: 14, fontWeight: '700' },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      flexWrap: 'wrap',
    },
    sectionTitle: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    meterTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  });
