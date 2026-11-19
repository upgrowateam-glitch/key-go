import React, { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useThemeColors, useThemedStyles, withAlpha, type ThemeColors } from '../../theme';

export type ActiveFilter = { key: string; label: string; onClear: () => void };

/** Compact list toolbar: search, a Filters button that opens a panel, a Sort menu and removable filter pills. */
export function FilterBar<S extends string>({
  query,
  onQuery,
  placeholder,
  active,
  onClearAll,
  sortOptions,
  sort,
  onSort,
  panel,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  active: ActiveFilter[];
  onClearAll: () => void;
  sortOptions: readonly S[];
  sort: S;
  onSort: (s: S) => void;
  /** Filter controls shown when the Filters button is pressed. */
  panel: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.search}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={onQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            accessibilityLabel="Search vehicles"
          />
          {query ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onQuery('')}>
              <X size={16} color={colors.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Filters, ${active.length} active`}
          style={styles.filterBtn}
          onPress={() => {
            setSortOpen(false);
            setPanelOpen((o) => !o);
          }}>
          <SlidersHorizontal size={17} color="#FFFFFF" />
          <Text style={styles.filterText}>Filters</Text>
          {active.length ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{active.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={{ zIndex: 30 }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${sort}`}
            style={styles.sortBtn}
            onPress={() => {
              setPanelOpen(false);
              setSortOpen((o) => !o);
            }}>
            <ArrowUpDown size={16} color={colors.txt} />
            <Text style={styles.sortText} numberOfLines={1}>
              Sort: {sort}
            </Text>
            <ChevronDown size={16} color={colors.txt} />
          </TouchableOpacity>
          {sortOpen ? (
            <View style={styles.sortMenu}>
              {sortOptions.map((o) => (
                <Pressable
                  key={o}
                  accessibilityRole="button"
                  style={(state) => [styles.sortItem, ((state as { hovered?: boolean }).hovered || o === sort) && { backgroundColor: colors.primarySoft }]}
                  onPress={() => {
                    onSort(o);
                    setSortOpen(false);
                  }}>
                  <Text style={[styles.sortItemText, o === sort && { color: colors.primaryText, fontWeight: '700' }]}>{o}</Text>
                  {o === sort ? <Check size={15} color={colors.primaryText} /> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {panelOpen ? (
        <View style={styles.panel}>
          {panel}
          <View style={styles.panelFoot}>
            <TouchableOpacity accessibilityRole="button" onPress={onClearAll}>
              <Text style={styles.clearAll}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.doneBtn} onPress={() => setPanelOpen(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {active.length ? (
        <View style={styles.pills}>
          {active.map((f) => (
            <TouchableOpacity key={f.key} accessibilityRole="button" accessibilityLabel={`Remove ${f.label}`} style={styles.pill} onPress={f.onClear}>
              <Text style={styles.pillText}>{f.label}</Text>
              <X size={13} color={colors.primaryText} strokeWidth={2.6} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity accessibilityRole="button" onPress={onClearAll} style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
            <Text style={styles.clearAll}>Clear all</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/** One labelled group of single-choice options inside the filter panel. */
export function FilterOptions<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.optRow}>
        {options.map((o) => {
          const on = o === value;
          return (
            <TouchableOpacity key={o} accessibilityRole="button" style={[styles.opt, on && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => onChange(o)}>
              <Text style={[styles.optText, on && { color: '#FFFFFF' }]}>{o}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { zIndex: 20 },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    search: {
      flexGrow: 1,
      flexBasis: 260,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: withAlpha(colors.muted, 0.08),
      borderWidth: 1,
      borderColor: colors.line,
    },
    searchInput: { flex: 1, minWidth: 0, height: '100%', color: colors.txt, fontSize: 15 },
    filterBtn: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, borderRadius: 12, backgroundColor: colors.primary },
    filterText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    countBadge: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    countText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    sortBtn: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
    sortText: { color: colors.txt, fontSize: 15, fontWeight: '600' },
    sortMenu: {
      position: 'absolute',
      top: 54,
      right: 0,
      minWidth: 210,
      padding: 6,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      boxShadow: `0px 14px 30px ${withAlpha(colors.shadow, 0.16)}`,
    } as never,
    sortItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8 },
    sortItemText: { color: colors.txt, fontSize: 14 },
    panel: { marginTop: 10, padding: 16, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
    panelFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
    doneBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primary },
    doneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    groupLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
    optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    opt: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
    optText: { color: colors.txt, fontSize: 13, fontWeight: '600' },
    pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22, backgroundColor: colors.primarySoft },
    pillText: { color: colors.primaryText, fontSize: 14, fontWeight: '700' },
    clearAll: { color: colors.muted, fontSize: 14, fontWeight: '500' },
  });
