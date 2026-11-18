import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mail, MessageCircle, MessageSquare } from 'lucide-react-native';
import type { Tone } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { daysBetween } from '../../lib/format';
import type { Campaign, Customer } from '../../types';

/** 'Paused' is local UI state only — the Campaign type has no paused status yet. */
export type DisplayStatus = Campaign['status'] | 'Paused';
export const STATUS_FILTERS = ['All', 'Draft', 'Scheduled', 'Running', 'Paused', 'Completed'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_TONE: Record<DisplayStatus, Tone> = {
  Draft: 'neutral',
  Scheduled: 'info',
  Running: 'success',
  Paused: 'warning',
  Completed: 'primary',
};

export const CHANNELS = ['WhatsApp', 'SMS', 'Email'] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_TONE: Record<Channel, Tone> = { WhatsApp: 'success', SMS: 'info', Email: 'violet' };
export const channelIcon = (ch: Channel, c: string, s = 11) =>
  ch === 'WhatsApp' ? <MessageCircle size={s} color={c} /> : ch === 'SMS' ? <MessageSquare size={s} color={c} /> : <Mail size={s} color={c} />;

export const AUDIENCES = ['All customers', 'Repeat customers', 'Corporate', 'Inactive 90+ days'] as const;
export type Audience = (typeof AUDIENCES)[number];

export const TIER_ORDER: Customer['loyaltyTier'][] = ['Bronze', 'Silver', 'Gold', 'VIP'];

export const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');

export function Metric({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function useAudienceSizes(): Record<Audience, number> {
  const { customers, bookings, today } = useApp();
  return useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'Cancelled');
    const tripCount = (id: string) => active.filter((b) => b.customerId === id).length;
    const lastTrip = (id: string) =>
      active
        .filter((b) => b.customerId === id)
        .map((b) => b.pickupDate)
        .sort()
        .pop();
    return {
      'All customers': customers.length,
      'Repeat customers': customers.filter((c) => tripCount(c.id) >= 2 || c.loyaltyTier !== 'Bronze').length,
      Corporate: new Set(active.filter((b) => b.classification === 'Corporate' && b.customerId).map((b) => b.customerId)).size,
      'Inactive 90+ days': customers.filter((c) => {
        const last = lastTrip(c.id);
        return !last || daysBetween(last, today) > 90;
      }).length,
    };
  }, [customers, bookings, today]);
}

export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    selectedCard: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    meta: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    label: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    rowTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    metricLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
    },
    metricValue: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
      marginTop: 2,
    },
    ladder: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
    },
    rung: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
    },
    rungIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    rungTier: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
    },
    rungReward: {
      color: colors.txt,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 8,
    },
    rungArrow: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      padding: 2,
    },
    custHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progressHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
  });

export const tierTone = (t: Customer['loyaltyTier']): Tone => (t === 'VIP' ? 'highlight' : t === 'Gold' ? 'warm' : t === 'Silver' ? 'info' : 'neutral');
