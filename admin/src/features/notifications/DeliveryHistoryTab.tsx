import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarClock, CheckCheck, MessageCircle, MessageSquare, Send, TriangleAlert } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, DataTable, EmptyState, Grid, StatTile, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { MessageLogEntry } from '../../types';
import { ListToolbar, Pager, useListControls } from './listControls';
import { makeStyles, MESSAGE_STATUS_TONE, TYPE_META } from './shared';

const CHANNEL_FILTERS = ['All', 'WhatsApp', 'SMS'] as const;
type ChannelFilter = (typeof CHANNEL_FILTERS)[number];

const STATUS_FILTERS = ['Any status', 'Queued', 'Sent', 'Delivered', 'Read', 'Failed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function DeliveryHistoryTab() {
  const { messageLog, sendTestMessage } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols, isPhone } = useResponsive();
  const [filter, setFilter] = useState<ChannelFilter>('All');
  const [status, setStatus] = useState<StatusFilter>('Any status');

  const filtered = useMemo(
    () => messageLog.filter((m) => (filter === 'All' || m.channel === filter) && (status === 'Any status' || m.status === status)),
    [messageLog, filter, status]
  );
  // The log is stored newest first, so its position stands in for the time
  const position = (m: MessageLogEntry) => messageLog.indexOf(m);
  const list = useListControls(filtered, {
    search: (m) => `${m.recipient} ${m.preview} ${m.id}`,
    sorts: {
      Newest: (a, b) => position(a) - position(b),
      Oldest: (a, b) => position(b) - position(a),
      Recipient: (a, b) => a.recipient.localeCompare(b.recipient),
      Status: (a, b) => a.status.localeCompare(b.status),
    },
  });
  const rows = list.pageRows;
  const delivered = messageLog.filter((m) => m.status === 'Delivered' || m.status === 'Read').length;
  const failed = messageLog.filter((m) => m.status === 'Failed').length;
  const pending = messageLog.filter((m) => m.status === 'Queued' || m.status === 'Sent').length;
  const filtersActive = filter !== 'All' || status !== 'Any status';

  const retry = (m: MessageLogEntry) => sendTestMessage(m.type, m.channel, m.recipient, m.preview);

  const channelBadge = (m: MessageLogEntry) => (
    <Badge
      label={m.channel}
      tone={m.channel === 'WhatsApp' ? 'success' : 'info'}
      icon={(c) => (m.channel === 'WhatsApp' ? <MessageCircle size={11} color={c} /> : <MessageSquare size={11} color={c} />)}
    />
  );

  const columns: Column<MessageLogEntry>[] = [
    { key: 'time', label: 'Time', minWidth: 130, flex: 1 },
    { key: 'channel', label: 'Channel', minWidth: 110, flex: 0.9, render: channelBadge },
    { key: 'type', label: 'Type', minWidth: 100, flex: 0.8, render: (m) => <Badge label={TYPE_META[m.type].label} tone={TYPE_META[m.type].tone} /> },
    { key: 'recipient', label: 'Recipient', minWidth: 190, flex: 1.6 },
    { key: 'preview', label: 'Preview', minWidth: 240, flex: 2.4 },
    {
      key: 'status',
      label: 'Status',
      minWidth: 130,
      flex: 1,
      render: (m) => (
        <View style={{ gap: 6 }}>
          <Badge label={m.status} tone={MESSAGE_STATUS_TONE[m.status]} />
          {m.status === 'Failed' ? <Button label="Retry" size="sm" variant="ghost" onPress={() => retry(m)} /> : null}
        </View>
      ),
    },
  ];

  const empty = <EmptyState title="No messages" message="Nothing logged for this search or filter." compact />;

  return (
    <View>
      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Messages" value={messageLog.length} hint="In this log" tone="primary" icon={(c) => <Send size={16} color={c} />} />
        <StatTile label="Delivered / read" value={delivered} tone="success" icon={(c) => <CheckCheck size={16} color={c} />} />
        <StatTile label="In progress" value={pending} hint="Queued or sent" tone="info" icon={(c) => <CalendarClock size={16} color={c} />} />
        <StatTile label="Failed" value={failed} tone="danger" icon={(c) => <TriangleAlert size={16} color={c} />} />
      </Grid>
      <ListToolbar
        controls={list}
        placeholder="Search recipient or message"
        filters={
          <View style={{ gap: 8 }}>
            <ChipGroup options={CHANNEL_FILTERS} value={filter} onChange={setFilter} />
            <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll />
            {filtersActive ? (
              <Button
                label="Reset"
                size="sm"
                variant="ghost"
                onPress={() => {
                  setFilter('All');
                  setStatus('Any status');
                }}
              />
            ) : null}
          </View>
        }
      />
      {isPhone ? (
        <Card padded={false}>
          {rows.length === 0
            ? empty
            : rows.map((m, i) => (
                <View key={m.id} style={[styles.logCard, i < rows.length - 1 && styles.notifDivider]}>
                  <View style={styles.logHead}>
                    {channelBadge(m)}
                    <Badge label={TYPE_META[m.type].label} tone={TYPE_META[m.type].tone} />
                    <View style={{ flex: 1 }} />
                    <Badge label={m.status} tone={MESSAGE_STATUS_TONE[m.status]} />
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {m.recipient}
                  </Text>
                  <Text style={styles.notifMsg} numberOfLines={2}>
                    {m.preview}
                  </Text>
                  <View style={[styles.logHead, { marginTop: 4, marginBottom: 0 }]}>
                    <Text style={[styles.meta, { flex: 1 }]}>{m.time}</Text>
                    {m.status === 'Failed' ? <Button label="Retry" size="sm" variant="ghost" onPress={() => retry(m)} /> : null}
                  </View>
                </View>
              ))}
        </Card>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(m) => m.id} empty={empty} />
      )}
      <Pager controls={list} />
      <Text style={[styles.meta, { marginTop: 10, color: colors.muted }]}>
        Statuses are simulated: new test messages move from Queued to Sent to Delivered automatically.
      </Text>
    </View>
  );
}
