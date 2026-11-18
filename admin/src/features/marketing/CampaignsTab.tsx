import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Eye, Megaphone, Pause, Play, Plus, Rocket, Send, Target } from 'lucide-react-native';
import {
  Badge,
  Button,
  Card,
  ChipGroup,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FormRow,
  FormSheet,
  Grid,
  Section,
  SegmentedControl,
  SimulatedNote,
  StatTile,
  type Column,
} from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { daysBetween, formatDate } from '../../lib/format';
import { pausedCampaignsStore } from '../../services/marketing';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import type { Campaign } from '../../types';
import {
  AUDIENCES,
  CHANNEL_TONE,
  CHANNELS,
  channelIcon,
  makeStyles,
  Metric,
  pct,
  STATUS_FILTERS,
  STATUS_TONE,
  useAudienceSizes,
  type Audience,
  type Channel,
  type DisplayStatus,
  type StatusFilter,
} from './shared';

type PendingAction = { campaign: Campaign; kind: 'launch' | 'pause' | 'resume' };

export default function CampaignsTab() {
  return <WithStore store={pausedCampaignsStore}>{(paused, setPaused) => <Campaigns paused={paused} setPaused={setPaused} />}</WithStore>;
}

function Campaigns({ paused, setPaused }: { paused: string[]; setPaused: (ids: string[]) => void }) {
  const { campaigns, updateCampaign, showToast } = useApp();
  const styles = useThemedStyles(makeStyles);
  const { cols, isPhone } = useResponsive();
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const onCreate = () => setCreateOpen(true);

  const statusOf = (c: Campaign): DisplayStatus => (c.status === 'Running' && paused.includes(c.id) ? 'Paused' : c.status);
  const filtered = useMemo(() => campaigns.filter((c) => filter === 'All' || statusOf(c) === filter), [campaigns, filter, paused]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useListControls(filtered, {
    search: (c) => `${c.name} ${c.audience} ${c.channel}`,
    sorts: {
      'Schedule (latest)': (a, b) => b.scheduledFor.localeCompare(a.scheduledFor),
      Name: (a, b) => a.name.localeCompare(b.name),
      'Most sent': (a, b) => b.sent - a.sent,
      'Most conversions': (a, b) => b.conversions - a.conversions,
    },
  });
  const rows = list.pageRows;

  const sent = campaigns.reduce((s, c) => s + c.sent, 0);
  const trackable = campaigns.filter((c) => c.channel !== 'SMS');
  const trackSent = trackable.reduce((s, c) => s + c.sent, 0);
  const opened = trackable.reduce((s, c) => s + c.opened, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  const launch = (c: Campaign) => {
    updateCampaign(c.id, { status: 'Running' });
    showToast(`"${c.name}" launched (simulated — nothing is sent)`);
  };
  const pause = (c: Campaign) => {
    setPaused([...paused, c.id]);
    showToast(`"${c.name}" paused`);
  };
  const resume = (c: Campaign) => {
    setPaused(paused.filter((x) => x !== c.id));
    showToast(`"${c.name}" resumed`);
  };

  const actions = (c: Campaign) => {
    const st = statusOf(c);
    if (st === 'Draft' || st === 'Scheduled')
      return <Button label="Launch" size="sm" icon={(col) => <Rocket size={12} color={col} />} onPress={() => setPending({ campaign: c, kind: 'launch' })} />;
    if (st === 'Running')
      return <Button label="Pause" size="sm" variant="outline" icon={(col) => <Pause size={12} color={col} />} onPress={() => setPending({ campaign: c, kind: 'pause' })} />;
    if (st === 'Paused')
      return <Button label="Resume" size="sm" variant="secondary" icon={(col) => <Play size={12} color={col} />} onPress={() => setPending({ campaign: c, kind: 'resume' })} />;
    return <Text style={styles.meta}>Finished</Text>;
  };

  const channelBadge = (c: Campaign) => <Badge label={c.channel} tone={CHANNEL_TONE[c.channel]} icon={(col) => channelIcon(c.channel, col)} />;
  const openedLabel = (c: Campaign) => (c.channel === 'SMS' ? 'n/a' : c.opened.toLocaleString('en-IN'));

  const columns: Column<Campaign>[] = [
    {
      key: 'name',
      label: 'Campaign',
      flex: 2,
      minWidth: 200,
      render: (c) => (
        <View>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {c.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {c.audience}
          </Text>
        </View>
      ),
    },
    { key: 'channel', label: 'Channel', minWidth: 110, render: channelBadge },
    { key: 'status', label: 'Status', minWidth: 100, render: (c) => <Badge label={statusOf(c)} tone={STATUS_TONE[statusOf(c)]} /> },
    { key: 'scheduled', label: 'Scheduled', minWidth: 110, value: (c) => formatDate(c.scheduledFor) },
    { key: 'sent', label: 'Sent', minWidth: 70, align: 'right', value: (c) => c.sent.toLocaleString('en-IN') },
    { key: 'opened', label: 'Opened', minWidth: 80, align: 'right', value: openedLabel },
    { key: 'conv', label: 'Conv.', minWidth: 70, align: 'right', value: (c) => c.conversions.toLocaleString('en-IN') },
    { key: 'rate', label: 'Conv. rate', minWidth: 90, align: 'right', value: (c) => pct(c.conversions, c.sent) },
    { key: 'actions', label: 'Action', minWidth: 120, align: 'right', render: actions },
  ];

  return (
    <View>
      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Messages sent" value={sent.toLocaleString('en-IN')} hint={`${campaigns.length} campaigns`} tone="primary" icon={(c) => <Send size={16} color={c} />} />
        <StatTile label="Opened" value={opened.toLocaleString('en-IN')} hint="WhatsApp & email only" tone="info" icon={(c) => <Eye size={16} color={c} />} />
        <StatTile label="Open rate" value={pct(opened, trackSent)} hint="SMS opens are not tracked" tone="violet" icon={(c) => <Megaphone size={16} color={c} />} />
        <StatTile label="Conversions" value={conversions.toLocaleString('en-IN')} hint={`${pct(conversions, sent)} of sent`} emphasis icon={(c) => <Target size={16} color={c} />} />
      </Grid>

      <Section
        title="Campaigns"
        subtitle={`${list.total} of ${campaigns.length} shown`}
        action={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {filter !== 'All' ? <Button label="Reset" size="sm" variant="ghost" onPress={() => setFilter('All')} /> : null}
            <Button label="New campaign" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={onCreate} />
          </View>
        }>
        <ListToolbar controls={list} placeholder="Search campaigns" filters={<ChipGroup options={STATUS_FILTERS} value={filter} onChange={setFilter} scroll />} />
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              title="No campaigns"
              message={filter === 'All' ? 'Create your first campaign to reach customers.' : `No ${filter.toLowerCase()} campaigns.`}
              icon={(c) => <Megaphone size={22} color={c} />}
              action={
                filter === 'All' ? (
                  <Button label="New campaign" size="sm" onPress={onCreate} />
                ) : (
                  <Button label="Show all" size="sm" variant="outline" onPress={() => setFilter('All')} />
                )
              }
            />
          </Card>
        ) : isPhone ? (
          <View style={{ gap: 12 }}>
            {rows.map((c) => (
              <Card key={c.id}>
                <View style={styles.cardTop}>
                  {channelBadge(c)}
                  <Badge label={statusOf(c)} tone={STATUS_TONE[statusOf(c)]} />
                  <View style={{ flex: 1 }} />
                  <Text style={styles.meta}>{formatDate(c.scheduledFor)}</Text>
                </View>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.meta}>{c.audience}</Text>
                <View style={styles.metricsRow}>
                  <Metric label="Sent" value={c.sent.toLocaleString('en-IN')} />
                  <Metric label="Opened" value={openedLabel(c)} />
                  <Metric label="Conv." value={c.conversions.toLocaleString('en-IN')} />
                  <Metric label="Rate" value={pct(c.conversions, c.sent)} />
                </View>
                <View style={{ alignItems: 'flex-end', marginTop: 10 }}>{actions(c)}</View>
              </Card>
            ))}
          </View>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} />
        )}
        <Pager controls={list} />
      </Section>
      <CreateCampaignSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
      <ConfirmDialog
        visible={!!pending}
        title={pending ? `${pending.kind === 'launch' ? 'Launch' : pending.kind === 'pause' ? 'Pause' : 'Resume'} "${pending.campaign.name}"?` : ''}
        message={pending?.kind === 'pause' ? 'No further messages are queued until it is resumed.' : 'The campaign is marked as running. This is simulated: nothing is sent.'}
        confirmLabel={pending?.kind === 'launch' ? 'Launch' : pending?.kind === 'pause' ? 'Pause' : 'Resume'}
        danger={pending?.kind === 'pause'}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending?.kind === 'launch') launch(pending.campaign);
          if (pending?.kind === 'pause') pause(pending.campaign);
          if (pending?.kind === 'resume') resume(pending.campaign);
          setPending(null);
        }}
      />
    </View>
  );
}

export function CreateCampaignSheet({ visible, onClose, audienceLabel }: { visible: boolean; onClose: () => void; /** Pre-selected custom segment, shown instead of the audience chips. */ audienceLabel?: string }) {
  const { addCampaign, today } = useApp();
  const styles = useThemedStyles(makeStyles);
  const sizes = useAudienceSizes();
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [audience, setAudience] = useState<Audience>('Repeat customers');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(today);
  const [touched, setTouched] = useState(false);

  const limit = channel === 'SMS' ? 160 : channel === 'WhatsApp' ? 1024 : 5000;
  const segments = Math.max(1, Math.ceil(message.length / 160));
  const nameError = !name.trim() ? 'Campaign name is required' : undefined;
  const messageError = !message.trim()
    ? 'Message is required'
    : channel === 'WhatsApp' && message.length > limit
      ? `WhatsApp templates are limited to ${limit} characters`
      : undefined;
  const dateError = !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())
    ? 'Use YYYY-MM-DD'
    : daysBetween(today, date.trim()) < 0
      ? 'Schedule date cannot be in the past'
      : undefined;

  const reset = () => {
    setName('');
    setChannel('WhatsApp');
    setAudience('Repeat customers');
    setMessage('');
    setDate(today);
    setTouched(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const save = (status: Campaign['status']) => {
    setTouched(true);
    if (nameError || messageError || dateError) return;
    addCampaign({
      id: `CMP-${Date.now()}`,
      name: name.trim(),
      channel,
      audience: audienceLabel ?? `${audience} (${sizes[audience]})`,
      status,
      scheduledFor: date.trim(),
      sent: 0,
      opened: 0,
      conversions: 0,
    });
    close();
  };

  const labels = Object.fromEntries(AUDIENCES.map((a) => [a, `${a} · ${sizes[a]}`])) as Record<Audience, string>;

  return (
    <FormSheet
      visible={visible}
      title="New campaign"
      onClose={close}
      footer={
        <>
          <Button label="Save draft" variant="ghost" onPress={() => save('Draft')} />
          <Button label="Schedule" onPress={() => save('Scheduled')} />
        </>
      }>
      <Field label="Campaign name" required value={name} onChangeText={setName} placeholder="e.g. Weekend getaway offer" error={touched ? nameError : undefined} />
      <Text style={styles.label}>Channel</Text>
      <SegmentedControl options={CHANNELS} value={channel} onChange={setChannel} />
      <Text style={[styles.label, { marginTop: 14 }]}>Audience</Text>
      {audienceLabel ? <Text style={styles.rowTitle}>{audienceLabel}</Text> : <ChipGroup options={AUDIENCES} value={audience} onChange={setAudience} labels={labels} />}
      <Text style={[styles.meta, { marginTop: 6, marginBottom: 14 }]}>Counts are worked out from your customers.</Text>
      <Field
        label="Message"
        required
        multiline
        value={message}
        onChangeText={setMessage}
        placeholder="Hi {first_name}, enjoy 10% off your next KeyGo rental…"
        error={touched ? messageError : undefined}
        hint={
          channel === 'SMS'
            ? `${message.length} characters · ${segments} SMS segment${segments > 1 ? 's' : ''} (160 per segment)`
            : `${message.length} / ${limit} characters`
        }
      />
      <FormRow>
        <Field label="Schedule date" required value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={touched ? dateError : undefined} hint={formatDate(date)} />
        <View />
      </FormRow>
      <SimulatedNote>Saving does not send anything. Message content is kept only for this preview.</SimulatedNote>
    </FormSheet>
  );
}
