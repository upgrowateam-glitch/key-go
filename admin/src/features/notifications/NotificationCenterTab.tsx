import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Bell, Check, CheckCheck, Send } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, EmptyState, toneColors } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles } from '../../theme';
import { readNotificationsStore } from '../../services/notifications';
import type { NotificationItem, NotificationType } from '../../types';
import { ListToolbar, Pager, useListControls, WithStore } from './listControls';
import { makeStyles, TYPE_META, useSendTest } from './shared';

const INBOX_FILTERS = ['All', 'Unread', 'Booking', 'Return', 'Insurance', 'PUC', 'Service', 'EMI', 'Alerts'] as const;
type InboxFilter = (typeof INBOX_FILTERS)[number];

const FILTER_TYPES: Record<Exclude<InboxFilter, 'All' | 'Unread'>, NotificationType[]> = {
  Booking: ['booking'],
  Return: ['return'],
  Insurance: ['insurance'],
  PUC: ['emission'],
  Service: ['service'],
  EMI: ['emi'],
  Alerts: ['alert', 'system'],
};

export default function NotificationCenterTab() {
  return <WithStore store={readNotificationsStore}>{(readIds, setReadIds) => <Inbox readIds={readIds} setReadIds={setReadIds} />}</WithStore>;
}

function Inbox({ readIds, setReadIds }: { readIds: string[]; setReadIds: (ids: string[]) => void }) {
  const { notifications: allNotifications, markAllNotificationsRead, showToast } = useApp();
  const styles = useThemedStyles(makeStyles);
  const sendTest = useSendTest();
  const [filter, setFilter] = useState<InboxFilter>('All');

  // Customer-facing notifications live in the customer portal, not the admin inbox
  const notifications = useMemo(
    () => allNotifications.filter((n) => !n.customerId).map((n) => (readIds.includes(n.id) ? { ...n, unread: false } : n)),
    [allNotifications, readIds]
  );
  const rows = useMemo(() => {
    if (filter === 'All') return notifications;
    if (filter === 'Unread') return notifications.filter((n) => n.unread);
    return notifications.filter((n) => FILTER_TYPES[filter].includes(n.type));
  }, [notifications, filter]);
  const list = useListControls(rows, { search: (n) => `${n.title} ${n.message}` });
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <View>
      <ListToolbar controls={list} placeholder="Search notifications" filters={<ChipGroup options={INBOX_FILTERS} value={filter} onChange={setFilter} scroll />} />
      <View style={styles.toolbarSecondary}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={styles.meta}>
            {list.total} {list.total === 1 ? 'notification' : 'notifications'}
          </Text>
          {unread > 0 ? <Badge label={`${unread} unread`} tone="warning" /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {filter !== 'All' ? <Button label="Reset filter" size="sm" variant="ghost" onPress={() => setFilter('All')} /> : null}
          <Button label="Send test" size="sm" variant="outline" icon={(c) => <Send size={14} color={c} />} onPress={() => sendTest.open()} />
          <Button
            label="Mark all read"
            size="sm"
            variant="outline"
            disabled={unread === 0}
            icon={(c) => <CheckCheck size={14} color={c} />}
            onPress={() => {
              markAllNotificationsRead();
              showToast('All notifications marked as read');
            }}
          />
        </View>
      </View>
      <Card padded={false}>
        {list.total === 0 ? (
          <EmptyState
            title="No notifications"
            message="Nothing matches this search or category."
            icon={(c) => <Bell size={22} color={c} />}
            action={
              <Button
                label="Show all"
                size="sm"
                variant="outline"
                onPress={() => {
                  setFilter('All');
                  list.setQuery('');
                }}
              />
            }
          />
        ) : (
          list.pageRows.map((n, i) => <NotificationRow key={n.id} n={n} last={i === list.pageRows.length - 1} onRead={() => setReadIds([...readIds, n.id])} />)
        )}
      </Card>
      <Pager controls={list} />
      {sendTest.sheet}
    </View>
  );
}

function NotificationRow({ n, last, onRead }: { n: NotificationItem; last: boolean; onRead: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const meta = TYPE_META[n.type];
  const tc = toneColors(colors, meta.tone);
  return (
    <View
      style={[styles.notifRow, !last && styles.notifDivider, n.unread && { backgroundColor: colors.primarySoft }]}
      accessibilityLabel={`${n.unread ? 'Unread. ' : ''}${meta.label}: ${n.title}. ${n.message}`}>
      <View style={[styles.typeIcon, { backgroundColor: tc.bg, borderColor: tc.border }]}>{meta.icon(tc.text, 18)}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.notifHead}>
          {n.unread ? <View style={styles.unreadDot} accessibilityLabel="Unread" /> : null}
          <Text style={[styles.notifTitle, n.unread && { fontWeight: '800' }]} numberOfLines={2}>
            {n.title}
          </Text>
        </View>
        <Text style={styles.notifMsg}>{n.message}</Text>
        <View style={styles.notifFoot}>
          <Badge label={meta.label} tone={meta.tone} />
          {n.unread ? <Badge label="New" tone="highlight" /> : null}
          <Text style={styles.meta}>{n.time}</Text>
          {n.unread ? <Button label="Mark read" size="sm" variant="ghost" icon={(c) => <Check size={12} color={c} />} onPress={onRead} /> : null}
        </View>
      </View>
    </View>
  );
}
