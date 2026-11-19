import React, { useCallback, useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Link2, MessageCircle, RefreshCw, Send, Unlink } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, Field, Section } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles } from '../../theme';
import { connectWhatsApp, disconnectWhatsApp, fetchWhatsApp, sendWhatsAppTest, type WhatsAppState } from '../../services/whatsapp';
import { makeStyles } from './shared';

const LABEL: Record<WhatsAppState['status'], { text: string; tone: 'success' | 'warning' | 'neutral' | 'info' }> = {
  connected: { text: 'Connected', tone: 'success' },
  'waiting-for-scan': { text: 'Waiting for scan', tone: 'info' },
  connecting: { text: 'Connecting…', tone: 'warning' },
  disconnected: { text: 'Not connected', tone: 'neutral' },
};

/**
 * Links KeyGo's own WhatsApp number (WhatsApp Web, via Baileys) so the server can send messages such as
 * staff invitations. Only Owners and Admins see this card.
 */
export function WhatsAppLinkCard() {
  const { showToast } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [state, setState] = useState<WhatsAppState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const load = useCallback(() => fetchWhatsApp().then(setState, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    void load();
  }, [load]);
  // While linking, check every few seconds for the scan
  useEffect(() => {
    if (state?.status !== 'waiting-for-scan' && state?.status !== 'connecting') return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [state?.status, load]);

  const act = async (task: () => Promise<WhatsAppState>) => {
    setBusy(true);
    try {
      setState(await task());
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const status = state?.status ?? 'disconnected';
  return (
    <Section title="KeyGo WhatsApp number" subtitle="Sends staff invitations and messages from your own WhatsApp number" style={{ marginTop: 0 }}>
      <Card>
        <View style={styles.cardHead}>
          <View style={[styles.typeIcon, { backgroundColor: colors.secondarySoft, borderColor: colors.secondaryBorder }]}>
            <MessageCircle size={18} color={colors.secondaryText} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle}>{status === 'connected' && state?.phone ? `+${state.phone}` : 'WhatsApp (linked device)'}</Text>
            <Text style={styles.meta}>Works like WhatsApp Web: the company phone stays the main device.</Text>
          </View>
          <Badge label={LABEL[status].text} tone={LABEL[status].tone} />
        </View>

        {error ? <Text style={[styles.meta, { color: colors.danger, marginTop: 10 }]}>{error}</Text> : null}
        {state?.error && status !== 'connected' ? <Text style={[styles.meta, { color: colors.warning, marginTop: 10 }]}>{state.error}</Text> : null}

        {status === 'waiting-for-scan' && state?.qr ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 14, alignItems: 'center' }}>
            <Image source={{ uri: state.qr }} style={{ width: 220, height: 220, borderRadius: 12, backgroundColor: '#FFFFFF' }} accessibilityLabel="WhatsApp QR code" />
            <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
              <Text style={styles.cardTitle}>Scan with the company phone</Text>
              {['Open WhatsApp on the phone with KeyGo’s number.', 'Tap ⋮ or Settings → Linked devices → Link a device.', 'Point the phone at this QR code.'].map((t, i) => (
                <Text key={t} style={styles.meta}>
                  {i + 1}. {t}
                </Text>
              ))}
              <Text style={[styles.meta, { marginTop: 4 }]}>The code refreshes by itself. This page updates when the phone is linked.</Text>
            </View>
          </View>
        ) : null}

        {status === 'connected' ? (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1, minWidth: 220 }}>
                <Field label="Send a test message to" value={testTo} onChangeText={setTestTo} keyboardType="phone-pad" placeholder="+91 98765 43210" />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Button
                  label="Send test"
                  variant="outline"
                  disabled={busy || testTo.replace(/\D/g, '').length < 10}
                  icon={(c) => <Send size={14} color={c} />}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      const r = await sendWhatsAppTest(testTo);
                      showToast(`Test message sent to ${r.to}`);
                    } catch (e) {
                      showToast((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.providerFoot, { marginTop: 14 }]}>
          <Text style={[styles.meta, { flex: 1, minWidth: 200 }]}>
            Uses WhatsApp Web through Baileys, not the official Business API. Send only to people who expect your messages; WhatsApp can restrict numbers that send spam.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {status === 'disconnected' ? (
              <Button label={busy ? 'Starting…' : 'Connect WhatsApp'} disabled={busy} icon={(c) => <Link2 size={14} color={c} />} onPress={() => act(connectWhatsApp)} />
            ) : null}
            {status === 'waiting-for-scan' || status === 'connecting' ? <Button label="Refresh" variant="ghost" icon={(c) => <RefreshCw size={14} color={c} />} onPress={() => void load()} /> : null}
            {status !== 'disconnected' ? <Button label="Disconnect" variant="ghost" icon={(c) => <Unlink size={14} color={c} />} onPress={() => setConfirmUnlink(true)} /> : null}
          </View>
        </View>
      </Card>
      <ConfirmDialog
        visible={confirmUnlink}
        title="Disconnect KeyGo’s WhatsApp?"
        message="KeyGo stops sending WhatsApp messages until you connect again with a new QR code. The phone itself keeps working normally."
        confirmLabel="Disconnect"
        danger
        onCancel={() => setConfirmUnlink(false)}
        onConfirm={() => {
          setConfirmUnlink(false);
          void act(disconnectWhatsApp);
        }}
      />
    </Section>
  );
}
