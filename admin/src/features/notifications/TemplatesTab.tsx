import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FileText, Pencil, Plus, Send, Trash2 } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, FormSheet, Grid, SegmentedControl, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { formatDate } from '../../lib/format';
import { fillSample, TEMPLATE_VARIABLES, templatesStore, type MessageTemplate } from '../../services/notifications';
import { ListToolbar, Pager, useListControls, WithStore } from './listControls';
import { CHANNEL_LABELS, CHANNEL_TYPES, makeStyles, TYPE_META, useSendTest, type Channel, type ChannelType } from './shared';

const TYPE_FILTERS = ['all', ...CHANNEL_TYPES] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

export default function TemplatesTab() {
  return <WithStore store={templatesStore}>{(rows, setRows) => <Templates rows={rows} setRows={setRows} />}</WithStore>;
}

function Templates({ rows, setRows }: { rows: MessageTemplate[]; setRows: (rows: MessageTemplate[]) => void }) {
  const { showToast, today } = useApp();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const sendTest = useSendTest();
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);
  const [removing, setRemoving] = useState<MessageTemplate | null>(null);
  const [statusChange, setStatusChange] = useState<MessageTemplate | null>(null);

  const filtered = useMemo(() => (filter === 'all' ? rows : rows.filter((t) => t.type === filter)), [rows, filter]);
  const list = useListControls(filtered, {
    search: (t) => `${t.name} ${t.body}`,
    sorts: {
      Name: (a, b) => a.name.localeCompare(b.name),
      'Recently updated': (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      Channel: (a, b) => a.channel.localeCompare(b.channel),
    },
    pageSize: 6,
  });

  const save = (t: MessageTemplate) => {
    const updated = { ...t, updatedAt: today };
    setRows(rows.some((r) => r.id === t.id) ? rows.map((r) => (r.id === t.id ? updated : r)) : [updated, ...rows]);
    showToast(`Template "${t.name}" saved`);
    setEditing(null);
  };

  return (
    <View>
      <View style={styles.toolbarSecondary}>
        <Text style={styles.meta}>
          {rows.filter((t) => t.active).length} of {rows.length} templates active
        </Text>
        <Button label="New template" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setEditing('new')} />
      </View>
      <ListToolbar
        controls={list}
        placeholder="Search templates"
        filters={<ChipGroup options={TYPE_FILTERS} value={filter} onChange={setFilter} labels={{ all: 'All', ...CHANNEL_LABELS }} scroll />}
      />
      {list.total === 0 ? (
        <Card>
          <EmptyState
            title="No templates"
            message="Nothing matches this search or type."
            icon={(c) => <FileText size={22} color={c} />}
            action={<Button label="New template" size="sm" onPress={() => setEditing('new')} />}
          />
        </Card>
      ) : (
        <Grid cols={cols(1, 2, 2)} gap={16}>
          {list.pageRows.map((t) => (
            <Card key={t.id} style={!t.active && { opacity: 0.8 }}>
              <View style={styles.logHead}>
                <Badge label={TYPE_META[t.type].label} tone={TYPE_META[t.type].tone} />
                <Badge label={t.channel} tone={t.channel === 'WhatsApp' ? 'success' : 'info'} />
                <View style={{ flex: 1 }} />
                <Badge label={t.active ? 'Active' : 'Inactive'} tone={t.active ? 'success' : 'neutral'} />
              </View>
              <Text style={styles.cardTitle}>{t.name}</Text>
              <Text style={styles.notifMsg}>{t.body}</Text>
              <Text style={[styles.meta, { marginTop: 6 }]}>Updated {formatDate(t.updatedAt)}</Text>
              <View style={[styles.providerFoot, { justifyContent: 'flex-start' }]}>
                <Button label="Edit" size="sm" variant="outline" icon={(c) => <Pencil size={12} color={c} />} onPress={() => setEditing(t)} />
                <Button
                  label="Send test"
                  size="sm"
                  variant="ghost"
                  icon={(c) => <Send size={12} color={c} />}
                  onPress={() => sendTest.open({ type: t.type, channel: t.channel, message: fillSample(t.body) })}
                />
                <Button label={t.active ? 'Deactivate' : 'Activate'} size="sm" variant="ghost" onPress={() => setStatusChange(t)} />
                <Button label="Delete" size="sm" variant="danger" icon={(c) => <Trash2 size={12} color={c} />} onPress={() => setRemoving(t)} />
              </View>
            </Card>
          ))}
        </Grid>
      )}
      <Pager controls={list} />

      {editing ? <TemplateSheet template={editing === 'new' ? null : editing} existing={rows} onClose={() => setEditing(null)} onSave={save} /> : null}
      {sendTest.sheet}
      <ConfirmDialog
        visible={!!removing}
        title={`Delete "${removing?.name}"?`}
        message="Reminders using this template would need another template. This cannot be undone."
        confirmLabel="Delete template"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            setRows(rows.filter((r) => r.id !== removing.id));
            showToast(`Template "${removing.name}" deleted`);
          }
          setRemoving(null);
        }}
      />
      <ConfirmDialog
        visible={!!statusChange}
        title={statusChange?.active ? `Deactivate "${statusChange.name}"?` : `Activate "${statusChange?.name}"?`}
        message={statusChange?.active ? 'This template stops being used for reminders.' : 'This template becomes available for reminders.'}
        confirmLabel={statusChange?.active ? 'Deactivate' : 'Activate'}
        danger={statusChange?.active}
        onCancel={() => setStatusChange(null)}
        onConfirm={() => {
          if (statusChange) setRows(rows.map((r) => (r.id === statusChange.id ? { ...r, active: !r.active } : r)));
          setStatusChange(null);
        }}
      />
    </View>
  );
}

function TemplateSheet({
  template,
  existing,
  onClose,
  onSave,
}: {
  template: MessageTemplate | null;
  existing: MessageTemplate[];
  onClose: () => void;
  onSave: (t: MessageTemplate) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState<ChannelType>(template?.type ?? 'booking');
  const [channel, setChannel] = useState<Channel>(template?.channel ?? 'WhatsApp');
  const [body, setBody] = useState(template?.body ?? '');
  const [active, setActive] = useState(template?.active ?? true);
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim()
    ? 'Template name is required'
    : existing.some((t) => t.id !== template?.id && t.name.toLowerCase() === name.trim().toLowerCase())
      ? 'A template with this name already exists'
      : undefined;
  const unknown = (body.match(/\{[^}]*\}/g) ?? []).filter((v) => !(v in TEMPLATE_VARIABLES));
  const bodyError = !body.trim()
    ? 'Message is required'
    : unknown.length > 0
      ? `Unknown variable: ${unknown.join(', ')}`
      : body.length > 1000
        ? 'Keep the message under 1000 characters'
        : undefined;
  const preview = fillSample(body);
  const segments = Math.max(1, Math.ceil(preview.length / 160));

  const submit = () => {
    setTouched(true);
    if (nameError || bodyError) return;
    onSave({ id: template?.id ?? `TPL-${Date.now()}`, name: name.trim(), type, channel, body: body.trim(), active, updatedAt: template?.updatedAt ?? '' });
  };

  return (
    <FormSheet
      visible
      title={template ? 'Edit template' : 'New template'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save template" onPress={submit} />
        </>
      }>
      <Field label="Template name" required value={name} onChangeText={setName} placeholder="e.g. Pickup reminder" error={touched ? nameError : undefined} />
      <Text style={styles.sheetLabel}>Reminder type</Text>
      <ChipGroup options={CHANNEL_TYPES} value={type} labels={CHANNEL_LABELS} onChange={setType} />
      <Text style={[styles.sheetLabel, { marginTop: 14 }]}>Channel</Text>
      <SegmentedControl options={['WhatsApp', 'SMS'] as const} value={channel} onChange={setChannel} />
      <View style={{ height: 14 }} />
      <Field
        label="Message"
        required
        multiline
        value={body}
        onChangeText={setBody}
        placeholder="Hi {customer}, your {vehicle} pickup is on {date}…"
        error={touched ? bodyError : undefined}
        hint={`Variables: ${Object.keys(TEMPLATE_VARIABLES).join(' ')}`}
      />
      <Text style={styles.previewLabel}>Preview with sample data</Text>
      <View style={channel === 'WhatsApp' ? styles.waBubble : styles.smsBubble}>
        <Text style={styles.previewText}>{preview || 'Your message appears here.'}</Text>
        <Text style={styles.previewMeta}>
          {preview.length} chars
          {channel === 'SMS' ? ` · ${segments} SMS segment${segments > 1 ? 's' : ''}` : ''}
        </Text>
      </View>
      <ToggleRow label="Active" description="Inactive templates are kept but not used" value={active} onValueChange={setActive} />
    </FormSheet>
  );
}
