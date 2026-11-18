import React, { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RotateCcw, Search } from 'lucide-react-native';
import { Button, Card, Field } from '../../components/kit';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a typed rupee or km amount; NaN when the field is empty or has no digits. */
export const parseAmount = (s: string) => (/\d/.test(s) ? parseFloat(s.replace(/[^\d.]/g, '')) : NaN);

/** Text styles shared by the operations tabs. */
export const makeCommonStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strong: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    title: { color: colors.txt, fontSize: 14, fontWeight: '700' },
    sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    cardTitle: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    chartTitle: { color: colors.txt, fontSize: 15, fontWeight: '800', marginBottom: 14 },
    kvLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 2 },
    label: { color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    link: { color: colors.primaryText, fontSize: 12, fontWeight: '700', marginTop: 2 },
    error: { color: colors.danger, fontSize: 11, fontWeight: '600', marginTop: 4 },
    body: { color: colors.txt, fontSize: 13, lineHeight: 19 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  });

export const useCommonStyles = () => useThemedStyles(makeCommonStyles);

/** Client-side pagination. The page returns to 1 whenever `resetKey` changes (search, filter or sort). */
export function usePaged<T>(rows: T[], resetKey: string, pageSize = 10) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  return { pageRows: rows.slice(start, start + pageSize), page: current, pages, setPage, start, total: rows.length, pageSize };
}

export function Pager({ paged }: { paged: Pick<ReturnType<typeof usePaged>, 'page' | 'pages' | 'setPage' | 'start' | 'total' | 'pageSize'> }) {
  const styles = useCommonStyles();
  const { page, pages, setPage, start, total, pageSize } = paged;
  if (total === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <Text style={styles.sub}>
        Showing {start + 1}–{Math.min(start + pageSize, total)} of {total}
      </Text>
      {pages > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button label="Previous" size="sm" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} />
          <Text style={styles.sub}>
            Page {page} of {pages}
          </Text>
          <Button label="Next" size="sm" variant="outline" disabled={page >= pages} onPress={() => setPage(page + 1)} />
        </View>
      ) : null}
    </View>
  );
}

/** Search box plus any filter and sort controls, with a reset link when something is active. */
export function ListToolbar({
  query,
  onQuery,
  placeholder,
  onReset,
  children,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  onReset?: () => void;
  children?: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <Card style={{ gap: 12, marginBottom: 12 }}>
      <Field label="Search" value={query} onChangeText={onQuery} placeholder={placeholder} left={<Search size={16} color={colors.muted} />} style={{ marginBottom: 0 }} />
      {children}
      {onReset ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={onReset} /> : null}
    </Card>
  );
}

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  const styles = useCommonStyles();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

/** Saves text as a real file in the browser. */
export function downloadFile(filename: string, content: string, mime = 'text/plain') {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  downloadFile(filename, rows.map((r) => r.map(cell).join(',')).join('\n'), 'text/csv');
}
