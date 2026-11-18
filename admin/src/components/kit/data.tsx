import React, { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Check, ChevronRight, Inbox } from 'lucide-react-native';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { initials } from '../../lib/format';
import { Tone, toneColors } from './controls';

// ---------------------------------------------------------------- KPI tile

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: (color: string) => ReactNode;
  /** Emphasised tile (primary background) — use for one key figure per row at most. */
  emphasis?: boolean;
  onPress?: () => void;
}

export function StatTile({ label, value, hint, tone = 'primary', icon, emphasis, onPress }: StatTileProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const c = toneColors(colors, tone);
  const bg = emphasis ? colors.primary : colors.card;
  const fg = emphasis ? colors.onPrimary : colors.txt;
  const sub = emphasis ? colors.navInactive : colors.muted;
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[styles.statLabel, { color: sub }]} numberOfLines={1}>
          {label}
        </Text>
        {icon ? (
          <View style={[styles.statIcon, { backgroundColor: emphasis ? colors.navLine : c.bg }]}>
            {icon(emphasis ? colors.navActive : c.text)}
          </View>
        ) : null}
      </View>
      <Text style={[styles.statValue, { color: fg }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={[styles.statHint, { color: sub }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </>
  );
  const style = [styles.stat, { backgroundColor: bg, borderColor: emphasis ? bg : colors.line }];
  return onPress ? (
    <TouchableOpacity accessibilityRole="button" style={style} onPress={onPress} activeOpacity={0.85}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={style}>{body}</View>
  );
}

// ---------------------------------------------------------------- Table

export interface Column<T> {
  key: string;
  label: string;
  /** Relative width (flex). */
  flex?: number;
  /** Minimum pixel width, used to size the horizontal scroll on phones. */
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  empty?: ReactNode;
  footer?: ReactNode;
}

/** Table on wide screens; scrolls horizontally on phones so columns stay readable. */
export function DataTable<T>({ columns, rows, rowKey, onRowPress, empty, footer }: DataTableProps<T>) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isPhone } = useResponsive();
  const minTableWidth = columns.reduce((s, c) => s + (c.minWidth ?? 110), 0);
  const cellStyle = (c: Column<T>) => ({
    flex: c.flex ?? 1,
    minWidth: c.minWidth ?? 110,
    alignItems: (c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start') as ViewStyle['alignItems'],
  });

  const table = (
    <View style={{ minWidth: isPhone ? minTableWidth : undefined, flex: 1 }}>
      <View style={styles.thead}>
        {columns.map((c) => (
          <View key={c.key} style={[styles.cell, cellStyle(c)]}>
            <Text style={styles.th}>{c.label}</Text>
          </View>
        ))}
      </View>
      {rows.length === 0 ? (
        <View style={{ padding: 16 }}>{empty ?? <EmptyState title="No records" message="Nothing matches the current filters." compact />}</View>
      ) : (
        rows.map((r, i) => {
          const content = columns.map((c) => (
            <View key={c.key} style={[styles.cell, cellStyle(c)]}>
              {c.render ? (
                c.render(r)
              ) : (
                <Text style={[styles.td, c.align === 'right' && { textAlign: 'right' }]} numberOfLines={2}>
                  {c.value ? c.value(r) : String((r as any)[c.key] ?? '')}
                </Text>
              )}
            </View>
          ));
          const rowStyle = [styles.tr, i % 2 === 1 && { backgroundColor: colors.bg }];
          return onRowPress ? (
            <TouchableOpacity key={rowKey(r)} accessibilityRole="button" style={rowStyle} onPress={() => onRowPress(r)}>
              {content}
            </TouchableOpacity>
          ) : (
            <View key={rowKey(r)} style={rowStyle}>
              {content}
            </View>
          );
        })
      )}
      {footer}
    </View>
  );

  return (
    <View style={styles.tableWrap}>
      {isPhone ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          {table}
        </ScrollView>
      ) : (
        table
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Rows & key/value

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const body = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <ChevronRight size={16} color={colors.muted} /> : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity accessibilityRole="button" style={[styles.row, style]} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={[styles.row, style]}>{body}</View>
  );
}

export function KeyValueGrid({ items, cols }: { items: { label: string; value: ReactNode }[]; cols?: number }) {
  const styles = useThemedStyles(makeStyles);
  const r = useResponsive();
  const n = cols ?? r.cols(2, 3, 4);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
      {items.map((it) => (
        <View key={it.label} style={{ width: `${100 / n}%`, paddingHorizontal: 6, marginBottom: 14 }}>
          <Text style={styles.kvLabel}>{it.label}</Text>
          {typeof it.value === 'string' || typeof it.value === 'number' ? (
            <Text style={styles.kvValue}>{it.value}</Text>
          ) : (
            it.value
          )}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Empty state

export function EmptyState({
  title,
  message,
  icon,
  action,
  compact,
}: {
  title: string;
  message?: string;
  icon?: (color: string) => ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.empty, compact && { paddingVertical: 20 }]}>
      <View style={styles.emptyIcon}>{icon ? icon(colors.secondaryText) : <Inbox size={22} color={colors.secondaryText} />}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Progress, avatar, tabs

export function ProgressBar({ value, tone = 'primary', height = 8 }: { value: number; tone?: Tone; height?: number }) {
  const colors = useThemeColors();
  const fill = tone === 'primary' ? colors.primary : toneColors(colors, tone).text;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height, borderRadius: height, backgroundColor: colors.bg2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: fill, borderRadius: height }} />
    </View>
  );
}

export function Avatar({ name, bg, size = 40 }: { name: string; bg?: string; size?: number }) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? colors.secondarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.onLight, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

/** Horizontally scrolling in-page tabs. */
export function PageTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (t: T) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tabsWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
        {tabs.map((t) => {
          const active = t === value;
          return (
            <TouchableOpacity
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(t)}
              style={[styles.tab, active && { borderBottomColor: colors.primary }]}>
              <Text style={[styles.tabText, active && { color: colors.primaryText, fontWeight: '800' }]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Horizontal (wide) / vertical (phone) progress stepper for the rental workflow. */
export function Stepper({ steps, current }: { steps: readonly { key: string; label: string }[]; current: number }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isPhone } = useResponsive();
  return (
    <View style={[styles.stepper, isPhone && { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const dotBg = done ? colors.primary : active ? colors.highlight : colors.bg2;
        const dotFg = done ? colors.onPrimary : active ? colors.onHighlight : colors.muted;
        return (
          <View key={s.key} style={isPhone ? styles.stepRow : styles.step}>
            <View style={[styles.stepDot, { backgroundColor: dotBg, borderColor: done ? colors.primary : active ? colors.warm : colors.lineStrong }]}>
              {done ? <Check size={13} color={dotFg} /> : <Text style={{ color: dotFg, fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>}
            </View>
            <Text
              style={[
                styles.stepLabel,
                isPhone ? { marginTop: 0, marginLeft: 10, textAlign: 'left' } : null,
                (done || active) && { color: colors.txt, fontWeight: '700' },
              ]}>
              {s.label}
              {active ? ' · current' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stat: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      minHeight: 104,
      justifyContent: 'space-between',
    },
    statLabel: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    statIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.6,
      marginTop: 8,
    },
    statHint: {
      fontSize: 11,
      marginTop: 2,
    },
    tableWrap: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
    },
    thead: {
      flexDirection: 'row',
      backgroundColor: colors.secondarySoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    th: {
      color: colors.txt,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    tr: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      alignItems: 'center',
    },
    cell: {
      paddingHorizontal: 12,
      paddingVertical: 11,
      justifyContent: 'center',
    },
    td: {
      color: colors.txt,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    rowTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    rowSub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    kvLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 3,
    },
    kvValue: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 36,
      paddingHorizontal: 16,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.secondarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    emptyTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyMsg: {
      color: colors.muted,
      fontSize: 13,
      textAlign: 'center',
      marginTop: 4,
      maxWidth: 360,
      lineHeight: 18,
    },
    tabsWrap: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      marginBottom: 16,
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 16,
    },
    step: {
      flex: 1,
      alignItems: 'center',
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLabel: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 6,
      textAlign: 'center',
    },
  });
