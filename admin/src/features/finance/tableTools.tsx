import React, { ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Search } from 'lucide-react-native';
import { Button, Field, type Column } from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

/** Client-side paging for lists that can grow. Returns to page one whenever the row count changes. */
export function usePaged<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length]);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  return { pageRows: rows.slice(current * pageSize, (current + 1) * pageSize), page: current, pageCount, setPage, total: rows.length, pageSize };
}

export function Pager({ paged }: { paged: { page: number; pageCount: number; setPage: (p: number) => void; total: number; pageSize: number } }) {
  const styles = useThemedStyles(makeStyles);
  if (paged.total <= paged.pageSize) return null;
  const from = paged.page * paged.pageSize + 1;
  const to = Math.min(paged.total, (paged.page + 1) * paged.pageSize);
  return (
    <View style={styles.pager}>
      <Text style={styles.muted}>
        {from}–{to} of {paged.total}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Previous" size="sm" variant="outline" disabled={paged.page === 0} icon={(c) => <ChevronLeft size={14} color={c} />} onPress={() => paged.setPage(paged.page - 1)} />
        <Button label="Next" size="sm" variant="outline" disabled={paged.page >= paged.pageCount - 1} icon={(c) => <ChevronRight size={14} color={c} />} onPress={() => paged.setPage(paged.page + 1)} />
      </View>
    </View>
  );
}

export function SearchField({ value, onChange, placeholder, label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  const colors = useThemeColors();
  return <Field label={label} value={value} onChangeText={onChange} placeholder={placeholder} left={<Search size={15} color={colors.muted} />} style={{ marginBottom: 0 }} />;
}

/** Search box on the left, filter groups beside it. Stacks on phones. */
export function ListToolbar({ search, children }: { search?: ReactNode; children?: ReactNode }) {
  const { isPhone } = useResponsive();
  return (
    <View style={[{ gap: 12, marginBottom: 12 }, !isPhone && { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }]}>
      {search ? <View style={isPhone ? undefined : { flexGrow: 1, flexBasis: 240, maxWidth: 360 }}>{search}</View> : null}
      {children}
    </View>
  );
}

export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ gap: 6, flexShrink: 1 }}>
      <Text style={styles.filterLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Totals row aligned with DataTable column widths. */
export function TotalRow<T>({ columns, cells }: { columns: Column<T>[]; cells: Record<string, string> }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.totalRow}>
      {columns.map((c) => (
        <View
          key={c.key}
          style={{
            flex: c.flex ?? 1,
            minWidth: c.minWidth ?? 110,
            paddingHorizontal: 12,
            paddingVertical: 12,
            alignItems: c.align === 'right' ? 'flex-end' : c.align === 'center' ? 'center' : 'flex-start',
          }}>
          <Text style={styles.total}>{cells[c.key] ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

export interface CsvData {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

const csvCell = (v: string | number) => {
  const s = String(v);
  // Leading =, +, - or @ would run as a formula when the file is opened in a spreadsheet.
  const safe = typeof v === 'string' && /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Downloads a real CSV file in the browser. Returns false where there is no browser to download into. */
export function downloadCsv({ filename, headers, rows }: CsvData) {
  if (typeof document === 'undefined') return false;
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function CsvButton({ data, label = 'Export CSV' }: { data: () => CsvData; label?: string }) {
  return <Button label={label} variant="outline" size="sm" icon={(c) => <FileSpreadsheet size={16} color={c} />} onPress={() => downloadCsv(data())} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 10,
    },
    muted: {
      color: colors.muted,
      fontSize: 12,
    },
    filterLabel: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
    },
    totalRow: {
      flexDirection: 'row',
      backgroundColor: colors.bg2,
    },
    total: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
    },
  });
