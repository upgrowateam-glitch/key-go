import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Bell, CalendarCheck, RotateCcw, Settings2 } from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, PageHeader, Screen } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemeColors } from '../../theme';

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const { notifications, currentCustomerId, markNotificationRead, markAllNotificationsRead } = useApp();
  const mine = useMemo(() => notifications.filter((n) => n.customerId === currentCustomerId), [notifications, currentCustomerId]);
  const unread = mine.filter((n) => n.unread).length;

  return (
    <Screen bottomInset={64}>
      <PageHeader
        eyebrow="Updates"
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All caught up'}
        actions={unread ? <Button label="Mark all read" size="sm" variant="outline" onPress={markAllNotificationsRead} /> : undefined}
      />
      <Card padded={false} style={{ marginTop: 12 }}>
        {mine.length === 0 ? (
          <EmptyState title="No notifications yet" message="Booking, pickup and return updates will appear here." icon={(c) => <Bell size={22} color={c} />} />
        ) : (
          mine.map((n, i) => {
            const Icon = n.type === 'booking' ? CalendarCheck : n.type === 'return' ? RotateCcw : Settings2;
            return (
              <TouchableOpacity
                key={n.id}
                accessibilityRole="button"
                accessibilityHint={n.unread ? 'Marks this notification as read' : undefined}
                disabled={!n.unread}
                activeOpacity={0.8}
                onPress={() => markNotificationRead(n.id)}
                style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.line }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={colors.primaryText} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ flex: 1, color: colors.txt, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                      {n.title}
                    </Text>
                    {n.unread ? <Badge label="New" tone="highlight" /> : null}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{n.message}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{n.time}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </Card>
    </Screen>
  );
}
