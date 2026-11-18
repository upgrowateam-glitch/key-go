import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Code, Copy, Eye, EyeOff, Globe, Key, Megaphone, RefreshCw, Save, Webhook, Zap } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, Divider, EmptyState, Field, Grid, Section, StatTile, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { integrationStore, retentionRulesStore, type RetentionRule, type WebsiteIntegration } from '../../services/marketing';
import { copyText, ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function randomKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `kg_live_${s}`;
}

const maskKey = (k: string) => `${k.slice(0, 8)}${'•'.repeat(20)}${k.slice(-4)}`;
const isUrl = (u: string) => /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(u.trim());

export default function AutomationTab() {
  return (
    <View>
      <WithStore store={retentionRulesStore}>{(rules, setRules) => <RetentionSection rules={rules} setRules={setRules} />}</WithStore>
      <WithStore store={integrationStore}>{(data, save) => <IntegrationSection data={data} persist={save} />}</WithStore>
    </View>
  );
}

// ---------------------------------------------------------------- retention

function RetentionSection({ rules, setRules }: { rules: RetentionRule[]; setRules: (rules: RetentionRule[]) => void }) {
  const { showToast } = useApp();
  const { cols } = useResponsive();
  const [pending, setPending] = useState<RetentionRule | null>(null);
  const list = useListControls(rules, { search: (r) => `${r.name} ${r.description} ${r.channel}` });
  const enabled = rules.filter((r) => r.enabled).length;

  return (
    <View>
      <Grid cols={cols(2, 3, 3)}>
        <StatTile label="Retention rules on" value={`${enabled}/${rules.length}`} tone="primary" icon={(c) => <Zap size={16} color={c} />} />
        <StatTile label="Website widget" value="Not live" hint="Simulated" tone="warning" icon={(c) => <Globe size={16} color={c} />} />
        <StatTile label="Webhooks" value="0 sent" hint="Simulated" tone="info" icon={(c) => <Webhook size={16} color={c} />} />
      </Grid>
      <Section title="Retention automation" subtitle="Campaign rules that bring customers back. Reminder rules are under Notifications." style={{ marginTop: 16 }}>
        <ListToolbar controls={list} placeholder="Search retention rules" />
        <Card>
          {list.total === 0 ? (
            <EmptyState title="No retention rules" message="Nothing matches this search." icon={(c) => <Megaphone size={22} color={c} />} compact />
          ) : (
            list.pageRows.map((r) => (
              <ToggleRow key={r.id} label={r.name} description={r.description} value={r.enabled} onValueChange={() => setPending(r)} right={<Badge label={r.channel} tone="neutral" />} />
            ))
          )}
        </Card>
        <Pager controls={list} />
      </Section>
      <ConfirmDialog
        visible={!!pending}
        title={pending?.enabled ? `Turn off "${pending.name}"?` : `Turn on "${pending?.name}"?`}
        message="This only changes the setting here. Nothing is sent until real messaging integration is connected."
        confirmLabel={pending?.enabled ? 'Turn off' : 'Turn on'}
        danger={pending?.enabled}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            setRules(rules.map((r) => (r.id === pending.id ? { ...r, enabled: !r.enabled } : r)));
            showToast(`${pending.name} ${pending.enabled ? 'off' : 'on'}`);
          }
          setPending(null);
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------- website integration

function IntegrationSection({ data, persist }: { data: WebsiteIntegration; persist: (d: WebsiteIntegration) => void }) {
  const { showToast } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const [website, setWebsite] = useState(data.website);
  const [webhook, setWebhook] = useState(data.webhook);
  const [leadToQuote, setLeadToQuote] = useState(data.leadToQuote);
  const [apiKey, setApiKey] = useState(data.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [touched, setTouched] = useState(false);

  const websiteError = !isUrl(website) ? 'Enter a full https:// URL' : undefined;
  const webhookError = webhook.trim() && !isUrl(webhook) ? 'Enter a full https:// URL or leave blank' : undefined;

  const origin = isUrl(website) ? website.trim().replace(/\/$/, '') : 'https://your-website.example';
  const embed = `<div id="keygo-booking"></div>\n<script src="https://widget.keygo.in/v1/embed.js"\n  data-site="${origin}"\n  data-key="${apiKey.slice(0, 12)}…"\n  data-theme="light" async></script>`;

  const save = () => {
    setTouched(true);
    if (websiteError || webhookError) return;
    persist({ website: website.trim(), webhook: webhook.trim(), leadToQuote, apiKey });
    showToast('Integration settings saved (simulated)');
  };

  return (
    <Section title="Website integration" subtitle="Booking widget, lead capture, webhooks and API access">
      <Grid cols={cols(1, 1, 2)} gap={16}>
        <Card>
          <View style={styles.cardHead}>
            <Code size={18} color={colors.primaryText} />
            <Text style={styles.cardTitle}>Booking widget embed code</Text>
            <View style={{ flex: 1 }} />
            <Button
              label="Copy"
              size="sm"
              variant="outline"
              icon={(c) => <Copy size={12} color={c} />}
              onPress={() => copyText(embed).then((ok) => showToast(ok ? 'Embed code copied' : 'Copy is blocked by this browser: select the code instead'))}
            />
          </View>
          <View style={styles.codeBox} accessibilityLabel="Embed code preview">
            <Text style={styles.codeText} selectable>
              {embed}
            </Text>
          </View>
          <Text style={[styles.meta, { marginTop: 8 }]}>Paste before the closing body tag of your website. The widget is not live in the UI phase.</Text>
        </Card>

        <Card>
          <Field
            label="Website URL"
            required
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            error={touched ? websiteError : undefined}
            left={<Globe size={16} color={colors.muted} />}
          />
          <ToggleRow
            label="Lead form → quote"
            description="Create a quote automatically from website enquiry submissions"
            value={leadToQuote}
            onValueChange={setLeadToQuote}
          />
          <View style={{ height: 14 }} />
          <Field
            label="Webhook URL"
            value={webhook}
            onChangeText={setWebhook}
            keyboardType="url"
            placeholder="https://"
            hint="Booking events are POSTed here (simulated)"
            error={touched ? webhookError : undefined}
            left={<Webhook size={16} color={colors.muted} />}
          />
          <Field
            label="API key"
            value={showKey ? apiKey : maskKey(apiKey)}
            editable={false}
            left={<Key size={16} color={colors.muted} />}
            right={
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}
                onPress={() => setShowKey((s) => !s)}
                style={{ padding: 4 }}>
                {showKey ? <EyeOff size={16} color={colors.muted} /> : <Eye size={16} color={colors.muted} />}
              </TouchableOpacity>
            }
            hint="Sample key — not valid for any real service"
          />
          <Divider />
          <View style={styles.actions}>
            <Button label="Regenerate key" size="sm" variant="danger" icon={(c) => <RefreshCw size={12} color={c} />} onPress={() => setConfirmRegen(true)} />
            <Button label="Save settings" size="sm" icon={(c) => <Save size={12} color={c} />} onPress={save} />
          </View>
        </Card>
      </Grid>

      <ConfirmDialog
        visible={confirmRegen}
        title="Regenerate API key?"
        message="The current key would stop working immediately and the website widget would need the new key. In the UI phase this only changes the sample key shown here."
        confirmLabel="Regenerate"
        danger
        onCancel={() => setConfirmRegen(false)}
        onConfirm={() => {
          const next = randomKey();
          setApiKey(next);
          persist({ ...data, apiKey: next });
          setShowKey(false);
          setConfirmRegen(false);
          showToast('New API key generated (simulated)');
        }}
      />
    </Section>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    meta: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap',
    },
    cardTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
    },
    codeBox: {
      backgroundColor: colors.bg2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 12,
    },
    codeText: {
      color: colors.txt,
      fontFamily: MONO,
      fontSize: 12,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    },
  });
