import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { History, Search } from 'lucide-react-native';
import { Card, Column, DataTable, EmptyState, Field, SimulatedNote } from '../../../components/kit';
import type { CustomerActivity } from '../../../services/customers';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { ListPager, usePaged } from '../../fleet/ListPager';
import { makeStyles } from '../shared';

export function ActivityTab({ entries }: { entries: CustomerActivity[] }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => !q || [e.who, e.action, e.field ?? '', e.previous ?? '', e.next ?? ''].some((s) => s.toLowerCase().includes(q)));
  }, [entries, query]);
  const paged = usePaged(filtered, 15);

  const columns: Column<CustomerActivity>[] = [
    { key: 'at', label: 'When', flex: 0.9, minWidth: 130, value: (e) => e.at },
    { key: 'who', label: 'Who', flex: 0.8, minWidth: 110, value: (e) => e.who },
    {
      key: 'what',
      label: 'What changed',
      flex: 1.3,
      minWidth: 170,
      render: (e) => (
        <View>
          <Text style={styles.strong}>{e.action}</Text>
          {e.field ? <Text style={styles.sub}>{e.field}</Text> : null}
        </View>
      ),
    },
    { key: 'previous', label: 'Previous', flex: 1, minWidth: 120, value: (e) => e.previous ?? '—' },
    { key: 'next', label: 'New', flex: 1, minWidth: 120, value: (e) => e.next ?? '—' },
  ];

  return (
    <View>
      <Card style={{ marginBottom: 12 }}>
        <Field label="Search" value={query} onChangeText={setQuery} placeholder="Staff member, action, field or value" left={<Search size={16} color={colors.muted} />} style={{ marginBottom: 0 }} />
      </Card>
      <DataTable
        columns={columns}
        rows={paged.rows}
        rowKey={(e) => e.id}
        empty={<EmptyState compact title={entries.length ? 'No activity matches' : 'No activity yet'} message="Profile edits and KYC reviews are recorded here." icon={(c) => <History size={22} color={c} />} />}
      />
      <ListPager paged={paged} />
      <SimulatedNote>Every profile change made in the portal is recorded here with who made it and when. Sensitive values stay masked.</SimulatedNote>
    </View>
  );
}
