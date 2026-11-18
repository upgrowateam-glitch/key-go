import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

export interface ChartSeries {
  name: string;
  color?: string;
  values: number[];
}

interface BarChartProps {
  labels: string[];
  series: ChartSeries[];
  height?: number;
  formatValue?: (v: number) => string;
  /** Show the value above each bar (single series only). */
  showValues?: boolean;
}

/** Vertical (optionally grouped) bar chart built from Views — no chart library needed. */
export function BarChart({ labels, series, height = 180, formatValue = (v) => String(v), showValues }: BarChartProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const max = Math.max(1, ...series.flatMap((s) => s.values.map((v) => Math.abs(v))));
  const seriesColor = (i: number) => series[i].color ?? colors.chart[i % colors.chart.length];

  return (
    <View accessibilityRole="image" accessibilityLabel={`Bar chart: ${series.map((s) => s.name).join(', ')}`}>
      {series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.name, color: seriesColor(i) }))} /> : null}
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.lineStrong }}>
        {labels.map((label, li) => (
          <View key={label} style={{ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
            {series.map((s, si) => {
              const v = s.values[li] ?? 0;
              return (
                <View key={s.name} style={{ flex: 1, maxWidth: 34, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  {showValues && series.length === 1 ? (
                    <Text style={styles.valueLabel} numberOfLines={1}>
                      {formatValue(v)}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      width: '100%',
                      height: `${(Math.abs(v) / max) * (showValues ? 82 : 100)}%`,
                      minHeight: v ? 3 : 0,
                      backgroundColor: seriesColor(si),
                      borderTopLeftRadius: 5,
                      borderTopRightRadius: 5,
                    }}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {labels.map((l) => (
          <Text key={l} style={styles.axisLabel} numberOfLines={1}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

interface HBarItem {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

/** Horizontal bars — good for ranked lists (vehicle-wise, customer-wise). */
export function HBarChart({ items, formatValue = (v) => String(v) }: { items: HBarItem[]; formatValue?: (v: number) => string }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <View style={{ gap: 12 }} accessibilityRole="image">
      {items.map((it, i) => (
        <View key={it.label}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, gap: 8 }}>
            <Text style={styles.hLabel} numberOfLines={1}>
              {it.label}
              {it.sublabel ? <Text style={styles.hSub}>  {it.sublabel}</Text> : null}
            </Text>
            <Text style={styles.hValue}>{formatValue(it.value)}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.bg2, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(Math.abs(it.value) / max) * 100}%`,
                height: '100%',
                borderRadius: 5,
                backgroundColor: it.color ?? (it.value < 0 ? colors.danger : colors.chart[i % 2]),
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Donut chart with a legend. */
export function DonutChart({
  items,
  size = 150,
  centerLabel,
  centerValue,
  formatValue = (v) => String(v),
}: {
  items: { label: string; value: number; color?: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  formatValue?: (v: number) => string;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const lengths = items.map((it) => (it.value / total) * circ);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((s, l) => s + l, 0));
  const colorOf = (i: number) => items[i].color ?? colors.chart[i % colors.chart.length];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.bg2} strokeWidth={stroke} fill="none" />
            {items.map((it, i) => (
                <Circle
                  key={it.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={colorOf(i)}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${Math.max(0, lengths[i] - 2)} ${circ}`}
                  strokeDashoffset={-offsets[i]}
                />
            ))}
          </G>
        </Svg>
        {centerValue ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={styles.donutValue}>{centerValue}</Text>
            {centerLabel ? <Text style={styles.axisLabel}>{centerLabel}</Text> : null}
          </View>
        ) : null}
      </View>
      <View style={{ gap: 8, flex: 1, minWidth: 140 }}>
        {items.map((it, i) => (
          <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colorOf(i) }} />
            <Text style={[styles.hLabel, { flex: 1 }]} numberOfLines={1}>
              {it.label}
            </Text>
            <Text style={styles.hValue}>{formatValue(it.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: it.color }} />
          <Text style={styles.axisLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    axisLabel: {
      flex: 1,
      color: colors.muted,
      fontSize: 11,
      textAlign: 'center',
    },
    valueLabel: {
      color: colors.txt,
      fontSize: 10,
      fontWeight: '700',
      marginBottom: 3,
    },
    hLabel: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '600',
      flexShrink: 1,
    },
    hSub: {
      color: colors.muted,
      fontWeight: '400',
      fontSize: 12,
    },
    hValue: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
    },
    donutValue: {
      color: colors.txt,
      fontSize: 18,
      fontWeight: '800',
    },
  });
