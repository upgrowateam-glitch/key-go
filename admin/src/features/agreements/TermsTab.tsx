import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FileText, Plus } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, Checkbox, ConfirmDialog, EmptyState, Field, FormSheet, Section } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate } from '../../lib/format';
import { useResource } from '../../services/mockClient';
import { loadTerms, removeTerm, saveTerm, setTermActive, TermCategory, TermClause } from '../../services/agreements';
import { FilterGroup, ListToolbar, useCommonStyles } from './listTools';

const CATEGORIES: TermCategory[] = ['Usage', 'Charges', 'Liability', 'Returns'];
const FILTERS = ['All', ...CATEGORIES] as const;
type Filter = (typeof FILTERS)[number];

interface Form {
  id?: string;
  title: string;
  body: string;
  category: TermCategory;
  required: boolean;
}
const BLANK: Form = { title: '', body: '', category: 'Usage', required: false };

export default function TermsTab() {
  const styles = useCommonStyles();
  const { isPhone } = useResponsive();
  const { showToast } = useApp();
  const res = useResource(loadTerms);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Filter>('All');
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const [confirmToggle, setConfirmToggle] = useState<TermClause | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TermClause | null>(null);

  const clauses = res.data?.clauses;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (clauses ?? []).filter((t) => (category === 'All' || t.category === category) && (!q || `${t.title} ${t.body}`.toLowerCase().includes(q)));
  }, [clauses, query, category]);

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;
  if (!res.data) return null;

  const fail = (e: Error) => showToast(e.message);
  const filtersActive = !!query || category !== 'All';
  const reset = () => {
    setQuery('');
    setCategory('All');
  };
  const open = (f: Form) => {
    setErrors({});
    setForm(f);
  };
  const submit = () => {
    if (!form) return;
    const e: typeof errors = {};
    if (form.title.trim().length < 3) e.title = 'Enter a clause title';
    if (form.body.trim().length < 10) e.body = 'Write the clause wording (at least 10 characters)';
    setErrors(e);
    if (Object.keys(e).length) return;
    saveTerm({ title: form.title.trim(), body: form.body.trim(), category: form.category, required: form.required }, form.id).then((d) => {
      res.setData(d);
      setForm(null);
      showToast(form.id ? 'Clause updated' : 'Clause added');
    }, fail);
  };
  const applyToggle = () => {
    if (!confirmToggle) return;
    setTermActive(confirmToggle.id, !confirmToggle.active).then(res.setData, fail);
    setConfirmToggle(null);
  };
  const applyDelete = () => {
    if (!confirmDelete) return;
    removeTerm(confirmDelete.id).then((d) => {
      res.setData(d);
      showToast('Clause deleted');
    }, fail);
    setConfirmDelete(null);
  };

  const activeCount = res.data.clauses.filter((t) => t.active).length;

  return (
    <View>
      <ListToolbar query={query} onQuery={setQuery} placeholder="Clause title or wording" onReset={filtersActive ? reset : undefined}>
        <FilterGroup label="Category">
          <ChipGroup options={FILTERS} value={category} onChange={setCategory} scroll={isPhone} />
        </FilterGroup>
      </ListToolbar>

      <Section
        title={`Standard terms · version ${res.data.version}`}
        subtitle={`${activeCount} of ${res.data.clauses.length} clauses active · active clauses appear on every new agreement`}
        style={{ marginTop: 8 }}
        action={<Button label="Add clause" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => open(BLANK)} />}>
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              title={res.data.clauses.length ? 'No clauses match' : 'No clauses yet'}
              message={res.data.clauses.length ? 'Try another search or category.' : 'Add the first clause for your rental agreements.'}
              icon={(c) => <FileText size={22} color={c} />}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {shown.map((t) => (
              <Card key={t.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={[styles.title, { flex: 1, minWidth: 160 }]}>{t.title}</Text>
                  <Badge label={t.category} tone="info" />
                  {t.required ? <Badge label="Required" tone="primary" /> : null}
                  <Badge label={t.active ? 'Active' : 'Inactive'} tone={t.active ? 'success' : 'neutral'} />
                </View>
                <Text style={styles.body}>{t.body}</Text>
                <Text style={styles.sub}>Updated {formatDate(t.updatedOn)}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button label="Edit" size="sm" variant="outline" onPress={() => open({ id: t.id, title: t.title, body: t.body, category: t.category, required: t.required })} />
                  {!t.required ? <Button label={t.active ? 'Deactivate' : 'Activate'} size="sm" variant="ghost" onPress={() => setConfirmToggle(t)} /> : null}
                  {!t.required ? <Button label="Delete" size="sm" variant="danger" onPress={() => setConfirmDelete(t)} /> : null}
                </View>
              </Card>
            ))}
          </View>
        )}
      </Section>

      <FormSheet
        visible={!!form}
        title={form?.id ? 'Edit clause' : 'Add clause'}
        onClose={() => setForm(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setForm(null)} />
            <Button label="Save clause" onPress={submit} />
          </>
        }>
        {form ? (
          <>
            <Field label="Title" required value={form.title} onChangeText={(title) => setForm({ ...form, title })} error={errors.title} />
            <Field label="Wording" required multiline value={form.body} onChangeText={(body) => setForm({ ...form, body })} error={errors.body} />
            <Text style={styles.label}>Category</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup options={CATEGORIES} value={form.category} onChange={(c) => setForm({ ...form, category: c })} />
            </View>
            <Checkbox label="Required clause (cannot be switched off or deleted)" checked={form.required} onChange={(required) => setForm({ ...form, required })} />
          </>
        ) : null}
      </FormSheet>

      <ConfirmDialog
        visible={!!confirmToggle}
        title={confirmToggle?.active ? 'Deactivate clause?' : 'Activate clause?'}
        message={confirmToggle?.active ? `"${confirmToggle.title}" will no longer appear on new agreements. Signed agreements are not affected.` : `"${confirmToggle?.title}" will appear on new agreements.`}
        confirmLabel={confirmToggle?.active ? 'Deactivate' : 'Activate'}
        onConfirm={applyToggle}
        onCancel={() => setConfirmToggle(null)}
      />
      <ConfirmDialog
        visible={!!confirmDelete}
        title="Delete clause?"
        message={`"${confirmDelete?.title}" will be removed from the standard terms. Signed agreements are not affected.`}
        confirmLabel="Delete"
        danger
        onConfirm={applyDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </View>
  );
}
