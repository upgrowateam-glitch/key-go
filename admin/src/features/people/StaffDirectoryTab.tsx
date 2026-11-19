import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyRound, Pencil, Plus, RotateCcw, Trash2, UserCheck, Users } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, ConfirmDialog, DataTable, Divider, DocumentSlot, EmptyState, FormSheet, Grid, KeyValueGrid, Section, SegmentedControl, StatTile, StatusBadge, type Column } from '../../components/kit';
import { StaffForm } from './StaffForm';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR } from '../../lib/format';
import { useResource } from '../../services/mockClient';
import { fetchStaffProfiles, removeStaffProfile, uploadStaffDocument, type StaffProfile } from '../../services/people';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { StaffPunch } from '../../types';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, usePaged } from '../finance/tableTools';

const STATUS = ['All', 'On duty', 'Off duty'] as const;
const SORTS = ['Name', 'Role', 'Joined'] as const;

interface Row {
  staff: StaffPunch;
  profile?: StaffProfile;
}

export default function StaffDirectoryTab() {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const { cols, isPhone } = useResponsive();
  const { staffPunches, today, showToast, removeStaff } = useApp();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const res = useResource(fetchStaffProfiles);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState<(typeof STATUS)[number]>('All');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Name');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docError, setDocError] = useState<string>();

  const all = useMemo<Row[]>(() => staffPunches.map((staff) => ({ staff, profile: res.data?.find((p) => p.staffId === staff.id) })), [staffPunches, res.data]);
  const roles = useMemo(() => ['All', ...Array.from(new Set(staffPunches.map((s) => s.role)))], [staffPunches]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => role === 'All' || r.staff.role === role)
      .filter((r) => status === 'All' || (status === 'On duty') === (r.staff.status === 'Punched In'))
      .filter((r) => !q || `${r.staff.staffName} ${r.staff.role} ${r.staff.phone} ${r.profile?.employeeCode ?? ''} ${r.profile?.branch ?? ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) =>
        sort === 'Role' ? a.staff.role.localeCompare(b.staff.role) : sort === 'Joined' ? (a.profile?.joinedOn ?? '').localeCompare(b.profile?.joinedOn ?? '') : a.staff.staffName.localeCompare(b.staff.staffName)
      );
  }, [all, role, status, query, sort]);
  const paged = usePaged(rows);

  const selected = all.find((r) => r.staff.id === selectedId);
  const filtered = !!query.trim() || role !== 'All' || status !== 'All';
  const reset = () => {
    setQuery('');
    setRole('All');
    setStatus('All');
  };

  const columns: Column<Row>[] = [
    {
      key: 'name',
      label: 'Staff',
      flex: 1.8,
      minWidth: 210,
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={r.staff.staffName} size={34} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name} numberOfLines={1}>
                {r.staff.staffName}
              </Text>
              {r.staff.userId ? <KeyRound size={12} color={colors.muted} accessibilityLabel="Has a sign-in account" /> : null}
            </View>
            <Text style={styles.sub}>{r.profile?.employeeCode ?? r.staff.id}</Text>
          </View>
        </View>
      ),
    },
    { key: 'role', label: 'Role', minWidth: 150, flex: 1.2, value: (r) => r.staff.role },
    { key: 'branch', label: 'Branch', minWidth: 140, flex: 1.1, value: (r) => r.profile?.branch ?? '—' },
    { key: 'phone', label: 'Phone', minWidth: 140, flex: 1, value: (r) => r.staff.phone },
    { key: 'shift', label: 'Shift', minWidth: 110, flex: 0.8, value: (r) => r.staff.shift },
    { key: 'status', label: 'Duty', minWidth: 110, flex: 0.8, render: (r) => <StatusBadge status={r.staff.status} /> },
  ];

  const uploadDoc = async (staffId: string, docId: string, name: string) => {
    setDocError(undefined);
    try {
      await uploadStaffDocument(staffId, docId);
      showToast(`${name} uploaded (simulated) · pending verification`);
      res.reload();
    } catch (e) {
      setDocError((e as Error).message);
    }
  };

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;

  const pendingDocs = (res.data ?? []).reduce((s, p) => s + p.documents.filter((d) => d.status !== 'Verified').length, 0);

  return (
    <View>
      <Grid cols={cols(2, 3, 3)} style={{ marginTop: 8 }}>
        <StatTile emphasis label="Staff" value={staffPunches.length} hint="Active employees" icon={(c) => <Users size={16} color={c} />} />
        <StatTile label="On duty now" value={staffPunches.filter((s) => s.status === 'Punched In').length} hint="Punched in" tone="success" icon={(c) => <UserCheck size={16} color={c} />} />
        <StatTile label="Documents to review" value={pendingDocs} hint="Pending or missing" tone={pendingDocs ? 'warning' : 'success'} />
      </Grid>

      <Section
        title="Directory"
        subtitle={`${rows.length} people · people with a sign-in (🔑) come from Settings → Users & Roles`}
        action={<Button label="Add staff" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setAdding(true)} />}>
        <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Name, code, phone or branch" />}>
          <FilterGroup label="Duty">
            <SegmentedControl options={STATUS} value={status} onChange={setStatus} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
          </FilterGroup>
          <CsvButton
            data={() => ({
              filename: 'keygo-staff.csv',
              headers: ['Code', 'Name', 'Role', 'Branch', 'Phone', 'Email', 'Shift', 'Joined'],
              rows: rows.map((r) => [r.profile?.employeeCode ?? r.staff.id, r.staff.staffName, r.staff.role, r.profile?.branch ?? '', r.staff.phone, r.profile?.email ?? '', r.staff.shift, r.profile?.joinedOn ?? '']),
            })}
          />
          {filtered ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
        </ListToolbar>
        <View style={{ marginBottom: 12 }}>
          <ChipGroup options={roles} value={role} onChange={setRole} scroll={isPhone} />
        </View>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(r) => r.staff.id}
          onRowPress={(r) => setSelectedId(r.staff.id)}
          empty={
            <EmptyState
              compact
              title={staffPunches.length ? 'No matching staff' : 'No staff yet'}
              message={staffPunches.length ? 'Nothing matches these filters.' : 'Add staff here, or add people in Settings → Users & Roles.'}
              action={filtered ? <Button label="Clear filters" variant="outline" size="sm" onPress={reset} /> : <Button label="Add staff" size="sm" onPress={() => setAdding(true)} />}
            />
          }
        />
        <Pager paged={paged} />
      </Section>

      <FormSheet visible={!!selected} title={selected ? selected.staff.staffName : 'Staff'} onClose={() => setSelectedId(null)}>
        {selected ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Avatar name={selected.staff.staffName} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{selected.staff.role}</Text>
                <Text style={styles.sub}>{selected.profile?.employeeCode ?? selected.staff.id}</Text>
              </View>
              <StatusBadge status={selected.staff.status} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              {selected.staff.userId ? <Badge label="Signs in to KeyGo" tone="info" icon={(c) => <KeyRound size={11} color={c} />} /> : null}
              <Button label="Edit details" size="sm" variant="outline" icon={(c) => <Pencil size={13} color={c} />} onPress={() => setEditing(true)} />
              {selected.staff.userId ? null : (
                <Button label="Delete" size="sm" variant="danger" icon={(c) => <Trash2 size={13} color={c} />} onPress={() => setConfirmDelete(true)} />
              )}
            </View>
            {selected.staff.userId ? <Text style={[styles.sub, { marginBottom: 10 }]}>To remove this person, delete their account in Settings → Users & Roles.</Text> : null}
            <KeyValueGrid
              cols={2}
              items={[
                { label: 'Phone', value: selected.staff.phone },
                { label: 'Email', value: selected.profile?.email ?? 'Not recorded' },
                { label: 'Branch', value: selected.profile?.branch ?? 'Not recorded' },
                { label: 'Employment', value: selected.profile?.employment ?? 'Not recorded' },
                { label: 'Joined', value: selected.profile ? formatDate(selected.profile.joinedOn) : 'Not recorded' },
                { label: 'Shift', value: selected.staff.shift },
                { label: 'Emergency contact', value: selected.profile?.emergencyContact ?? 'Not recorded' },
                { label: 'Hours (Sep)', value: `${selected.staff.hoursThisMonth} h · ${selected.staff.overtimeHours} h overtime` },
              ]}
            />
            <Divider />
            <Text style={styles.cardTitle}>Salary</Text>
            <View style={{ marginTop: 10 }}>
              <KeyValueGrid
                cols={2}
                items={[
                  { label: 'Base salary', value: formatINR(selected.staff.baseSalary) },
                  { label: 'Trip allowance', value: formatINR(selected.staff.tripAllowance) },
                ]}
              />
            </View>
            <Divider />
            <Text style={styles.cardTitle}>Documents</Text>
            <Text style={styles.sub}>Uploads are simulated and nothing leaves the device.</Text>
            {docError ? <Text style={styles.error}>{docError}</Text> : null}
            <View style={{ marginTop: 8, gap: 8 }}>
              {selected.profile?.documents.length ? (
                selected.profile.documents.map((doc) => (
                  <DocumentSlot
                    key={doc.id}
                    title={doc.name}
                    subtitle={doc.uploadedAt ? `Uploaded ${formatDate(doc.uploadedAt)}` : doc.kind}
                    status={doc.status}
                    onUpload={() => uploadDoc(selected.staff.id, doc.id, doc.name)}
                  />
                ))
              ) : (
                <EmptyState compact title="No documents" message={`No documents on file as of ${formatDate(today)}.`} />
              )}
            </View>
          </View>
        ) : null}
      </FormSheet>
      {adding ? <StaffForm onClose={() => setAdding(false)} onSaved={res.reload} /> : null}
      {editing && selected ? <StaffForm staff={selected.staff} profile={selected.profile} onClose={() => setEditing(false)} onSaved={res.reload} /> : null}
      <ConfirmDialog
        visible={confirmDelete && !!selected}
        title={`Delete ${selected?.staff.staffName}?`}
        message="Their staff record, attendance and HR details are removed. Salary already paid stays in Finance."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const target = selected;
          setConfirmDelete(false);
          if (!target) return;
          removeStaff(target.staff.id);
          await removeStaffProfile(target.staff.id).catch(() => undefined);
          setSelectedId(null);
          res.reload();
          showToast(`${target.staff.staffName} deleted`);
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    name: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    sub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 1,
    },
    cardTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 6,
    },
  });
