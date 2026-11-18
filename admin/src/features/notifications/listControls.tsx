import React, { ReactNode, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import { Button, ChipGroup, Field } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { mockRequest, useResource } from '../../services/mockClient';
import { useThemeColors } from '../../theme';

// ---------------------------------------------------------------- stores

export interface Store<T> {
  load: () => Promise<T>;
  save: (value: T) => void;
}

/**
 * In-memory record set behind a mock service. It outlives tab switches and resets on page reload.
 * Swap `load` and `save` for NestJS calls when the backend exists.
 */
export function createStore<T>(seed: T): Store<T> {
  let current = seed;
  return {
    load: () => mockRequest(() => current),
    save: (value) => {
      current = value;
    },
  };
}

/** Loads a store with shared loading/error states, then hands its data and a setter to `children`. */
export function WithStore<T>({ store, children }: { store: Store<T>; children: (data: T, update: (value: T) => void) => ReactNode }) {
  const { data, loading, error, reload, setData } = useResource(store.load);
  if (data === undefined) return <ResourceState loading={loading} error={error} onRetry={reload} />;
  return (
    <>
      {children(data, (value) => {
        store.save(value);
        setData(value);
      })}
    </>
  );
}

// ---------------------------------------------------------------- list controls

interface ListOptions<T> {
  /** Text a row is searched by. */
  search: (row: T) => string;
  /** Sort label -> comparator; the first entry is the default. */
  sorts?: Record<string, (a: T, b: T) => number>;
  pageSize?: number;
}

export function useListControls<T>(rows: T[], { search, sorts, pageSize = 8 }: ListOptions<T>) {
  const sortKeys = sorts ? Object.keys(sorts) : [];
  const [query, setQueryState] = useState('');
  const [sort, setSortState] = useState(sortKeys[0] ?? '');
  const [requestedPage, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? rows.filter((r) => search(r).toLowerCase().includes(q)) : rows;
    const compare = sorts?.[sort];
    return compare ? [...matched].sort(compare) : matched;
    // `search` and `sorts` are declared inline and only depend on the rows themselves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, pageCount);

  return {
    query,
    setQuery: (q: string) => {
      setQueryState(q);
      setPage(1);
    },
    sort,
    setSort: (s: string) => {
      setSortState(s);
      setPage(1);
    },
    sortKeys,
    page,
    setPage,
    pageCount,
    pageSize,
    total: filtered.length,
    pageRows: filtered.slice((page - 1) * pageSize, page * pageSize),
  };
}

type ListControls = Pick<ReturnType<typeof useListControls<unknown>>, 'query' | 'setQuery' | 'sort' | 'setSort' | 'sortKeys'>;
type PagerControls = Pick<ReturnType<typeof useListControls<unknown>>, 'page' | 'setPage' | 'pageCount' | 'pageSize' | 'total'>;

/** Search box, optional filter chips and sort chips for a list. */
export function ListToolbar({ controls, placeholder, filters }: { controls: ListControls; placeholder: string; filters?: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Field label="Search" value={controls.query} onChangeText={controls.setQuery} placeholder={placeholder} left={<Search size={16} color={colors.muted} />} style={{ marginBottom: 10 }} />
      {filters ? <View style={{ marginBottom: 8 }}>{filters}</View> : null}
      {controls.sortKeys.length > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>Sort</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ChipGroup options={controls.sortKeys} value={controls.sort} onChange={controls.setSort} scroll />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Result count and previous/next buttons. */
export function Pager({ controls }: { controls: PagerControls }) {
  const colors = useThemeColors();
  const { page, pageCount, pageSize, total, setPage } = controls;
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Showing {from}–{to} of {total}
      </Text>
      {pageCount > 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button label="Previous" size="sm" variant="outline" disabled={page === 1} icon={(c) => <ChevronLeft size={12} color={c} />} onPress={() => setPage(page - 1)} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Page {page} of {pageCount}
          </Text>
          <Button label="Next" size="sm" variant="outline" disabled={page === pageCount} icon={(c) => <ChevronRight size={12} color={c} />} onPress={() => setPage(page + 1)} />
        </View>
      ) : null}
    </View>
  );
}

/** Copies text when the browser allows it and reports whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
