import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/kit';
import { useThemedStyles, type ThemeColors } from '../../theme';

/** Client-side paging for a filtered list. Goes back to page 1 when the number of matches changes. */
export function usePaged<T>(all: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const total = all.length;
  useEffect(() => setPage(1), [total]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const first = (current - 1) * pageSize;
  return { rows: all.slice(first, first + pageSize), page: current, pages, total, first, setPage };
}

export function ListPager({ paged }: { paged: { rows: unknown[]; page: number; pages: number; total: number; first: number; setPage: (p: number) => void } }) {
  const styles = useThemedStyles(makeStyles);
  if (paged.pages <= 1) return null;
  return (
    <View style={styles.pager}>
      <Text style={styles.text}>
        {paged.first + 1}–{paged.first + paged.rows.length} of {paged.total}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Previous" variant="outline" size="sm" disabled={paged.page === 1} onPress={() => paged.setPage(paged.page - 1)} />
        <Button label="Next" variant="outline" size="sm" disabled={paged.page === paged.pages} onPress={() => paged.setPage(paged.page + 1)} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12 },
    text: { color: colors.muted, fontSize: 12 },
  });
