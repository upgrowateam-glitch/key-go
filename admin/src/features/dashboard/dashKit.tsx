import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { BarChart3 } from 'lucide-react-native';
import { toneColors, type Tone } from '../../components/kit';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';

/** Soft wave along the bottom of a card, tinted with the card's colour. */
function Wave({ color, opacity = 0.35, height = 46 }: { color: string; opacity?: number; height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 300 46" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, pointerEvents: 'none' } as never}>
      <Path d="M0 30 C 60 6, 120 46, 190 24 C 240 8, 275 18, 300 12 L 300 46 L 0 46 Z" fill={color} fillOpacity={opacity * 0.6} />
      <Path d="M0 40 C 70 22, 150 50, 220 34 C 260 26, 285 30, 300 26 L 300 46 L 0 46 Z" fill={color} fillOpacity={opacity} />
    </Svg>
  );
}

/** Dashboard figure: label, big value, hint, a round tinted icon and a soft wave in the tile's colour. */
export function DashTile({
  label,
  value,
  hint,
  tone = 'primary',
  icon,
  accentLabel,
  onPress,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon: (color: string) => ReactNode;
  /** Shows the label in the tile's colour (used for the first, headline tile). */
  accentLabel?: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const c = toneColors(colors, tone);
  const Body = (onPress ? TouchableOpacity : View) as React.ComponentType<React.ComponentProps<typeof TouchableOpacity>>;
  return (
    <Body accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={styles.tile}>
      <Wave color={c.text} opacity={0.12} />
      <View style={styles.tileTop}>
        <Text style={[styles.tileLabel, accentLabel && { color: c.text }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.tileIcon, { backgroundColor: c.bg }]}>{icon(c.text)}</View>
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.tileHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Body>
  );
}

/** Dark green tile with a progress ring, for the fleet utilization percentage. */
export function RingTile({ label, percent, hint }: { label: string; percent: number; hint: string }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.tile, styles.ringTile]}>
      <Wave color="#FFFFFF" opacity={0.08} height={56} />
      <View style={styles.tileTop}>
        <Text style={[styles.tileLabel, { color: colors.onPrimary }]}>{label}</Text>
        <View style={[styles.tileIconSmall, { backgroundColor: withAlpha('#FFFFFF', 0.12) }]}>
          <BarChart3 size={14} color={colors.highlight} />
        </View>
      </View>
      <View style={styles.ringWrap}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="kgRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#7BE0B0" />
              <Stop offset="1" stopColor={colors.secondary} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={withAlpha('#FFFFFF', 0.14)} strokeWidth={stroke} fill="none" />
          {p > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="url(#kgRing)"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(circ * p) / 100} ${circ}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <Text style={styles.ringValue}>{p}%</Text>
      </View>
      <Text style={[styles.tileHint, { color: withAlpha('#FFFFFF', 0.78), textAlign: 'center' }]}>{hint}</Text>
    </View>
  );
}

/** Section heading with a round white icon badge, as on the dashboard. */
export function DashSection({
  title,
  subtitle,
  icon,
  action,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  icon: (color: string) => ReactNode;
  action?: ReactNode;
  children: ReactNode;
  style?: object;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[{ marginTop: 22 }, style]}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>{icon(colors.primaryText)}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

/** White rounded panel with a faint wave, for lists on the dashboard. */
export function DashPanel({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.panel, padded && { padding: 16 }]}>
      <Wave color={colors.secondary} opacity={0.08} height={60} />
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tile: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 18,
      minHeight: 146,
      flexGrow: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.6),
      boxShadow: `0px 8px 22px ${withAlpha(colors.shadow, 0.07)}`,
    } as never,
    ringTile: { backgroundColor: colors.primary, borderColor: colors.primary, minHeight: 156 },
    tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    tileLabel: { color: colors.txt, fontSize: 14, fontWeight: '600', flexShrink: 1, marginTop: 4 },
    tileIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    tileIconSmall: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    tileValue: { color: colors.txt, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
    tileHint: { color: colors.muted, fontSize: 12, marginTop: 4 },
    ringWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 2 },
    ringValue: { position: 'absolute', color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    sectionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0px 4px 12px ${withAlpha(colors.shadow, 0.08)}`,
    } as never,
    sectionTitle: { color: colors.txt, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
    sectionSub: { color: colors.muted, fontSize: 12.5, marginTop: 1 },
    panel: {
      backgroundColor: colors.card,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.6),
      boxShadow: `0px 8px 22px ${withAlpha(colors.shadow, 0.06)}`,
    } as never,
  });
