import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { ArrowDown, ArrowUp, FileText, Pencil, Plus, Trash2, Upload } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, FormSheet, IconButton } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemedStyles } from '../../theme';
import { formatDate } from '../../lib/format';
import { termsStore, type TermsClause, type TermsDocument } from '../../services/settings';
import { ListToolbar, useListControls, WithStore } from '../notifications/listControls';
import { makeSettingsStyles } from './formParts';

export default function TermsTab() {
  return <WithStore store={termsStore}>{(doc, save) => <Terms doc={doc} save={save} />}</WithStore>;
}

function Terms({ doc, save }: { doc: TermsDocument; save: (d: TermsDocument) => void }) {
  const { today, showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const [editing, setEditing] = useState<TermsClause | 'new' | null>(null);
  const [removing, setRemoving] = useState<TermsClause | null>(null);
  const [publishing, setPublishing] = useState(false);
  const list = useListControls(doc.clauses, { search: (c) => `${c.title} ${c.body}`, pageSize: 100 });
  const searching = list.query.trim().length > 0;

  const setClauses = (clauses: TermsClause[]) => save({ ...doc, clauses, dirty: true });
  const move = (index: number, by: number) => {
    const next = [...doc.clauses];
    const [clause] = next.splice(index, 1);
    next.splice(index + by, 0, clause);
    setClauses(next);
  };

  return (
    <View>
      <View style={styles.toolbar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={`Version ${doc.version}`} tone="primary" />
          <Text style={styles.meta}>Published {formatDate(doc.publishedOn)}</Text>
          {doc.dirty ? <Badge label="Unpublished changes" tone="warning" /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button label="Add clause" size="sm" variant="outline" icon={(c) => <Plus size={14} color={c} />} onPress={() => setEditing('new')} />
          <Button label="Publish" size="sm" disabled={!doc.dirty || doc.clauses.length === 0} icon={(c) => <Upload size={14} color={c} />} onPress={() => setPublishing(true)} />
        </View>
      </View>
      <ListToolbar controls={list} placeholder="Search clauses" />
      {list.total === 0 ? (
        <Card>
          <EmptyState title="No clauses" message="Nothing matches, or no clauses have been written yet." icon={(c) => <FileText size={22} color={c} />} action={<Button label="Add clause" size="sm" onPress={() => setEditing('new')} />} />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {list.pageRows.map((clause) => {
            const index = doc.clauses.indexOf(clause);
            return (
              <Card key={clause.id}>
                <View style={styles.rowHead}>
                  <Text style={[styles.title, { flex: 1 }]}>
                    {index + 1}. {clause.title}
                  </Text>
                  {!searching && index > 0 ? <IconButton label={`Move ${clause.title} up`} icon={(c) => <ArrowUp size={14} color={c} />} onPress={() => move(index, -1)} /> : null}
                  {!searching && index < doc.clauses.length - 1 ? <IconButton label={`Move ${clause.title} down`} icon={(c) => <ArrowDown size={14} color={c} />} onPress={() => move(index, 1)} /> : null}
                </View>
                <Text style={styles.body}>{clause.body}</Text>
                <View style={styles.actions}>
                  <Button label="Edit" size="sm" variant="outline" icon={(c) => <Pencil size={12} color={c} />} onPress={() => setEditing(clause)} />
                  <Button label="Delete" size="sm" variant="danger" icon={(c) => <Trash2 size={12} color={c} />} onPress={() => setRemoving(clause)} />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      {editing ? (
        <ClauseSheet
          clause={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(clause) => {
            setClauses(doc.clauses.some((c) => c.id === clause.id) ? doc.clauses.map((c) => (c.id === clause.id ? clause : c)) : [...doc.clauses, clause]);
            setEditing(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!removing}
        title={`Delete "${removing?.title}"?`}
        message="The clause leaves the draft. The published version stays in force until you publish."
        confirmLabel="Delete clause"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) setClauses(doc.clauses.filter((c) => c.id !== removing.id));
          setRemoving(null);
        }}
      />
      <ConfirmDialog
        visible={publishing}
        title={`Publish version ${doc.version + 1}?`}
        message="New rental agreements would use these terms. Signed agreements keep the version they were signed on."
        confirmLabel="Publish"
        onCancel={() => setPublishing(false)}
        onConfirm={() => {
          save({ ...doc, version: doc.version + 1, publishedOn: today, dirty: false });
          showToast(`Terms version ${doc.version + 1} published`);
          setPublishing(false);
        }}
      />
    </View>
  );
}

function ClauseSheet({ clause, onClose, onSave }: { clause: TermsClause | null; onClose: () => void; onSave: (c: TermsClause) => void }) {
  const [title, setTitle] = useState(clause?.title ?? '');
  const [body, setBody] = useState(clause?.body ?? '');
  const [touched, setTouched] = useState(false);
  const titleError = !title.trim() ? 'Title is required' : undefined;
  const bodyError = !body.trim() ? 'Clause text is required' : undefined;
  return (
    <FormSheet
      visible
      title={clause ? 'Edit clause' : 'Add clause'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button
            label="Save clause"
            onPress={() => {
              setTouched(true);
              if (titleError || bodyError) return;
              onSave({ id: clause?.id ?? `TC-${Date.now()}`, title: title.trim(), body: body.trim() });
            }}
          />
        </>
      }>
      <Field label="Title" required value={title} onChangeText={setTitle} error={touched ? titleError : undefined} />
      <Field label="Clause text" required multiline value={body} onChangeText={setBody} error={touched ? bodyError : undefined} />
    </FormSheet>
  );
}
