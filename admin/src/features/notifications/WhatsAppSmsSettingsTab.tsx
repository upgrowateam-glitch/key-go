import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarClock, MessageCircle, MessageSquare, Plug, Send, Unplug } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, Field, FormSheet, Grid, Section, SimulatedNote, toneColors } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles } from '../../theme';
import { providersStore, type ProviderConfig } from '../../services/notifications';
import { WithStore } from './listControls';
import { WhatsAppLinkCard } from './WhatsAppLinkCard';
import { useStaffSession } from '../../components/portal/PortalShell';
import { CHANNEL_LABELS, CHANNEL_TYPES, ChannelSwitch, makeStyles, TEMPLATES, TYPE_META, useSendTest, type ChannelType } from './shared';

export default function WhatsAppSmsSettingsTab() {
  return <WithStore store={providersStore}>{(configs, setConfigs) => <ChannelsTab configs={configs} setConfigs={setConfigs} />}</WithStore>;
}

function ChannelsTab({ configs, setConfigs }: { configs: ProviderConfig[]; setConfigs: (c: ProviderConfig[]) => void }) {
  const { notificationSettings, toggleNotificationChannel, showToast } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols, isPhone } = useResponsive();
  const [previewType, setPreviewType] = useState<ChannelType>('booking');
  const sendTest = useSendTest();
  const { session } = useStaffSession();
  const canLinkWhatsApp = session?.role === 'Owner' || session?.role === 'Admin';
  const [editing, setEditing] = useState<ProviderKey | null>(null);
  const [clearing, setClearing] = useState<ProviderKey | null>(null);
  const configOf = (key: ProviderKey) => configs.find((c) => c.key === key)!;

  const providers = [
    {
      key: 'wa' as ProviderKey,
      name: 'WhatsApp Business API',
      desc: 'Template messages to customers and staff via an approved WhatsApp Business number.',
      icon: (c: string) => <MessageCircle size={18} color={c} />,
    },
    {
      key: 'sms' as ProviderKey,
      name: 'SMS gateway',
      desc: 'DLT-registered transactional SMS through an Indian SMS provider.',
      icon: (c: string) => <MessageSquare size={18} color={c} />,
    },
  ];

  const template = TEMPLATES[previewType];
  const smsSegments = Math.max(1, Math.ceil(template.length / 160));

  return (
    <View>
      {canLinkWhatsApp ? <WhatsAppLinkCard /> : null}
      <Section title="Providers" subtitle="Connect messaging providers once the backend is available" style={canLinkWhatsApp ? undefined : { marginTop: 0 }}>
        <Grid cols={cols(1, 2, 2)} gap={16}>
          {providers.map((p) => (
            <Card key={p.key}>
              <View style={styles.cardHead}>
                <View style={[styles.typeIcon, { backgroundColor: colors.secondarySoft, borderColor: colors.secondaryBorder }]}>{p.icon(colors.secondaryText)}</View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle}>{p.name}</Text>
                  <Text style={styles.meta}>{p.desc}</Text>
                </View>
              </View>
              <View style={styles.providerFoot}>
                <Badge label={configOf(p.key).configured ? 'Details saved — not connected' : 'Not connected — simulated'} tone="warning" />
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {configOf(p.key).configured ? (
                    <Button label="Clear" size="sm" variant="ghost" icon={(c) => <Unplug size={14} color={c} />} onPress={() => setClearing(p.key)} />
                  ) : null}
                  <Button
                    label={configOf(p.key).configured ? 'Edit details' : 'Add details'}
                    size="sm"
                    icon={(c) => <Plug size={14} color={c} />}
                    onPress={() => setEditing(p.key)}
                  />
                </View>
              </View>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section title="Channel settings" subtitle="Choose which reminders go out on WhatsApp and SMS">
        <Card padded={false}>
          {notificationSettings.map((s, i) => {
            const meta = TYPE_META[s.type];
            const tc = toneColors(colors, meta.tone);
            return (
              <View
                key={s.type}
                style={[styles.channelRow, isPhone && { flexDirection: 'column', alignItems: 'stretch' }, i < notificationSettings.length - 1 && styles.notifDivider]}>
                <View style={{ flexDirection: 'row', gap: 12, flex: 1, minWidth: 0 }}>
                  <View style={[styles.typeIcon, { backgroundColor: tc.bg, borderColor: tc.border }]}>{meta.icon(tc.text, 18)}</View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle}>{s.label}</Text>
                    <Text style={styles.meta}>{s.description}</Text>
                    <View style={{ marginTop: 6 }}>
                      <Badge label={`Lead time: ${s.leadTime}`} tone="neutral" icon={(c) => <CalendarClock size={11} color={c} />} />
                    </View>
                  </View>
                </View>
                <View style={[styles.toggles, isPhone && { marginTop: 12, justifyContent: 'flex-start' }]}>
                  <ChannelSwitch
                    label="WhatsApp"
                    value={s.whatsapp}
                    onChange={() => {
                      toggleNotificationChannel(s.type, 'whatsapp');
                      showToast(`${s.label}: WhatsApp ${s.whatsapp ? 'off' : 'on'}`);
                    }}
                  />
                  <ChannelSwitch
                    label="SMS"
                    value={s.sms}
                    onChange={() => {
                      toggleNotificationChannel(s.type, 'sms');
                      showToast(`${s.label}: SMS ${s.sms ? 'off' : 'on'}`);
                    }}
                  />
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section
        title="Template preview"
        subtitle="Sample content with placeholders filled from demo data"
        action={<Button label="Send test" size="sm" icon={(c) => <Send size={14} color={c} />} onPress={() => sendTest.open({ type: previewType, message: template })} />}>
        <Card>
          <ChipGroup options={CHANNEL_TYPES} value={previewType} onChange={setPreviewType} labels={CHANNEL_LABELS} scroll />
          <Grid cols={cols(1, 2, 2)} gap={16} style={{ marginTop: 16 }}>
            <View>
              <Text style={styles.previewLabel}>WhatsApp</Text>
              <View style={styles.waBubble}>
                <Text style={styles.previewText}>{template}</Text>
                <Text style={styles.previewMeta}>09:10 AM · template</Text>
              </View>
            </View>
            <View>
              <Text style={styles.previewLabel}>SMS</Text>
              <View style={styles.smsBubble}>
                <Text style={styles.previewText}>KeyGo: {template}</Text>
                <Text style={styles.previewMeta}>
                  {template.length + 7} chars · {smsSegments} SMS segment{smsSegments > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </Grid>
        </Card>
      </Section>
      {sendTest.sheet}
      {editing ? (
        <ProviderSheet
          config={configOf(editing)}
          name={providers.find((p) => p.key === editing)!.name}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setConfigs(configs.map((c) => (c.key === next.key ? next : c)));
            setEditing(null);
            showToast('Provider details saved (simulated — nothing is connected)');
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!clearing}
        title="Clear provider details?"
        message="The saved sender and account details are removed from this page."
        confirmLabel="Clear details"
        danger
        onCancel={() => setClearing(null)}
        onConfirm={() => {
          setConfigs(configs.map((c) => (c.key === clearing ? { ...c, senderId: '', accountId: '', configured: false } : c)));
          setClearing(null);
        }}
      />
    </View>
  );
}

type ProviderKey = ProviderConfig['key'];

function ProviderSheet({ config, name, onClose, onSave }: { config: ProviderConfig; name: string; onClose: () => void; onSave: (c: ProviderConfig) => void }) {
  const isWhatsApp = config.key === 'wa';
  const [senderId, setSenderId] = useState(config.senderId);
  const [accountId, setAccountId] = useState(config.accountId);
  const [touched, setTouched] = useState(false);

  const senderError = isWhatsApp
    ? /^\+?\d[\d\s-]{8,}$/.test(senderId.trim())
      ? undefined
      : 'Enter the business phone number, e.g. +91 80 4000 1234'
    : /^[A-Z]{6}$/.test(senderId.trim())
      ? undefined
      : 'DLT sender IDs are 6 capital letters, e.g. KEYGOR';
  const accountError = !accountId.trim() ? (isWhatsApp ? 'Business account ID is required' : 'DLT entity ID is required') : undefined;

  const submit = () => {
    setTouched(true);
    if (senderError || accountError) return;
    onSave({ ...config, senderId: senderId.trim(), accountId: accountId.trim(), configured: true });
  };

  return (
    <FormSheet
      visible
      title={name}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save details" onPress={submit} />
        </>
      }>
      <SimulatedNote>Real provider integration is pending. These details are only kept on this page and no connection is made.</SimulatedNote>
      <View style={{ height: 12 }} />
      <Field label={isWhatsApp ? 'Business phone number' : 'DLT sender ID'} required value={senderId} onChangeText={setSenderId} error={touched ? senderError : undefined} />
      <Field label={isWhatsApp ? 'Business account ID' : 'DLT entity ID'} required value={accountId} onChangeText={setAccountId} error={touched ? accountError : undefined} />
    </FormSheet>
  );
}
