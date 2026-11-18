import { useRouter } from '@/shims/expo-router';
import { CalendarClock, Info, Landmark, Leaf, RotateCcw, Send, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button, ChipGroup, Field, FormSheet, SegmentedControl, SimulatedNote, type Tone } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { daysBetween } from '../../lib/format';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { MessageLogEntry, NotificationChannelSetting, NotificationType } from '../../types';

export type ChannelType = NotificationChannelSetting['type'];
export type Channel = MessageLogEntry['channel'];

export const TYPE_META: Record<NotificationType, { label: string; tone: Tone; icon: (color: string, size?: number) => ReactNode }> = {
  booking: { label: 'Booking', tone: 'primary', icon: (c, s = 16) => <CalendarClock size={s} color={c} /> },
  return: { label: 'Return', tone: 'violet', icon: (c, s = 16) => <RotateCcw size={s} color={c} /> },
  insurance: { label: 'Insurance', tone: 'info', icon: (c, s = 16) => <ShieldCheck size={s} color={c} /> },
  emission: { label: 'PUC', tone: 'success', icon: (c, s = 16) => <Leaf size={s} color={c} /> },
  service: { label: 'Service', tone: 'warning', icon: (c, s = 16) => <Wrench size={s} color={c} /> },
  emi: { label: 'EMI', tone: 'warm', icon: (c, s = 16) => <Landmark size={s} color={c} /> },
  alert: { label: 'Alert', tone: 'danger', icon: (c, s = 16) => <TriangleAlert size={s} color={c} /> },
  system: { label: 'System', tone: 'neutral', icon: (c, s = 16) => <Info size={s} color={c} /> },
};

export const CHANNEL_TYPES: ChannelType[] = ['booking', 'return', 'insurance', 'emission', 'service', 'emi'];
export const CHANNEL_LABELS: Record<ChannelType, string> = {
  booking: 'Booking',
  return: 'Return',
  insurance: 'Insurance',
  emission: 'PUC',
  service: 'Service',
  emi: 'EMI',
};

/** Sample message templates (placeholders already filled with sample data). */
export const TEMPLATES: Record<ChannelType, string> = {
  booking: 'Hi Suresh, your KeyGo booking KG-6299 (Urban SUV) is confirmed. Pickup on 28 Sep at 08:00 AM. Please carry your driving licence. Reply HELP for support.',
  return: 'Hi Rahul, a reminder that your Sport Coupé (KG-7104) is due back today at 09:00 PM. Late returns may attract a fine as per your agreement.',
  insurance: 'Fleet alert: insurance policy INS-ROYAL-9910 for KA 04 LX 1007 expires on 08 Oct. Please renew to keep the vehicle rentable.',
  emission: 'Fleet alert: PUC certificate for KA 04 LX 1007 expired on 20 Sep. Vehicle should not be dispatched until renewed.',
  service: 'Fleet alert: Executive Sedan (KA 03 MS 2210) periodic service due at 45,000 km or by 12 Oct.',
  emi: 'Accounts: 4 loan EMIs totalling Rs 1,54,600 are due on 01 Oct. Please ensure sufficient balance.',
};

export const MESSAGE_STATUS_TONE: Record<MessageLogEntry['status'], Tone> = {
  Queued: 'neutral',
  Sent: 'info',
  Delivered: 'success',
  Read: 'primary',
  Failed: 'danger',
};

export function dueBadge(today: string, due: string): { label: string; tone: Tone } {
  const d = daysBetween(today, due);
  if (d < 0) return { label: `Overdue ${Math.abs(d)}d`, tone: 'danger' };
  if (d === 0) return { label: 'Due today', tone: 'warning' };
  if (d <= 15) return { label: `Due in ${d}d`, tone: 'warning' };
  return { label: `Due in ${d}d`, tone: 'info' };
}

export function ChannelSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.switchBox}>
      <View>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={[styles.meta, { color: value ? colors.success : colors.muted }]}>{value ? 'On' : 'Off'}</Text>
      </View>
      <Switch
        accessibilityLabel={`${label} ${value ? 'on' : 'off'}`}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.lineStrong, true: colors.secondary }}
        thumbColor={value ? colors.primary : colors.card}
        {...({ activeThumbColor: colors.primary } as object)}
      />
    </View>
  );
}

export function SendTestSheet({
  visible,
  onClose,
  onSend,
  initial,
}: {
  initial?: SendTestInitial;
  visible: boolean;
  onClose: () => void;
  onSend: (type: ChannelType, channel: Channel, recipient: string, message: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [type, setType] = useState<ChannelType>(initial?.type ?? 'booking');
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? 'WhatsApp');
  const [recipient, setRecipient] = useState('Fleet admin · +91 80 4000 1234');
  const [message, setMessage] = useState(initial?.message ?? TEMPLATES[initial?.type ?? 'booking']);
  const [touched, setTouched] = useState(false);

  const recipientError = !recipient.trim()
    ? 'Recipient is required'
    : !/\d{6,}/.test(recipient.replace(/[\s-]/g, ''))
      ? 'Include a phone number (e.g. +91 98765 43210)'
      : undefined;
  const messageError = !message.trim() ? 'Message is required' : message.length > 1000 ? 'Keep the message under 1000 characters' : undefined;
  const segments = Math.max(1, Math.ceil(message.length / 160));

  const submit = () => {
    setTouched(true);
    if (recipientError || messageError) return;
    onSend(type, channel, recipient.trim(), message.trim());
    setTouched(false);
  };

  return (
    <FormSheet
      visible={visible}
      title="Send test message"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Queue test (simulated)" icon={(c) => <Send size={14} color={c} />} onPress={submit} />
        </>
      }>
      <SimulatedNote>Nothing is actually sent. The message is added to the delivery log with a simulated status.</SimulatedNote>
      <Text style={styles.sheetLabel}>Reminder type</Text>
      <ChipGroup
        options={CHANNEL_TYPES}
        value={type}
        labels={CHANNEL_LABELS}
        onChange={(t) => {
          setType(t);
          setMessage(TEMPLATES[t]);
        }}
      />
      <Text style={[styles.sheetLabel, { marginTop: 14 }]}>Channel</Text>
      <SegmentedControl options={['WhatsApp', 'SMS'] as const} value={channel} onChange={setChannel} />
      <View style={{ height: 14 }} />
      <Field
        label="Recipient"
        required
        value={recipient}
        onChangeText={setRecipient}
        placeholder="Name · +91 98765 43210"
        error={touched ? recipientError : undefined}
      />
      <Field
        label="Message"
        required
        multiline
        value={message}
        onChangeText={setMessage}
        error={touched ? messageError : undefined}
        hint={channel === 'SMS' ? `${message.length} characters · ${segments} SMS segment${segments > 1 ? 's' : ''}` : `${message.length} characters`}
      />
    </FormSheet>
  );
}

export interface SendTestInitial {
  type?: ChannelType;
  channel?: Channel;
  message?: string;
}

/** The send-test sheet: after queueing a message it opens Delivery History, where the simulated status plays out. */
export function useSendTest() {
  const { sendTestMessage } = useApp();
  const router = useRouter();
  const [initial, setInitial] = useState<SendTestInitial | null>(null);
  return {
    open: (values: SendTestInitial = {}) => setInitial(values),
    sheet: initial ? (
      <SendTestSheet
        visible
        initial={initial}
        onClose={() => setInitial(null)}
        onSend={(type, channel, recipient, message) => {
          sendTestMessage(type, channel, recipient, message);
          setInitial(null);
          router.replace('/notifications?tab=delivery-history');
        }}
      />
    ) : null,
  };
}

export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    toolbarSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    meta: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    notifRow: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
    },
    notifDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    typeIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.warm,
    },
    notifTitle: {
      flex: 1,
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    notifMsg: {
      color: colors.txt,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 3,
      opacity: 0.85,
    },
    notifFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 6,
    },
    cardTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
    },
    providerFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12,
    },
    channelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    toggles: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
    },
    switchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 140,
      justifyContent: 'space-between',
    },
    switchLabel: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    previewLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    waBubble: {
      backgroundColor: colors.secondarySoft,
      borderColor: colors.secondaryBorder,
      borderWidth: 1,
      borderRadius: 14,
      borderTopLeftRadius: 4,
      padding: 12,
    },
    smsBubble: {
      backgroundColor: colors.bg2,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 14,
      borderTopLeftRadius: 4,
      padding: 12,
    },
    previewText: {
      color: colors.txt,
      fontSize: 13,
      lineHeight: 19,
    },
    previewMeta: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 8,
      textAlign: 'right',
    },
    logCard: {
      padding: 14,
    },
    sheetLabel: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    logHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 8,
    },
  });
