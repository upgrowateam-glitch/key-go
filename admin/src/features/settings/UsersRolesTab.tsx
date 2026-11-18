import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Crown, ShieldCheck, UserCog, UserPlus, Users } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, SimulatedNote, StatTile, type Column, type Tone } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { branchesStore, usersStore, type PortalUser } from '../../services/settings';
import { readSession, type StaffRole } from '../../services/auth';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import { isEmail, makeSettingsStyles } from './formParts';

export const ROLES: StaffRole[] = ['Owner', 'Admin', 'Manager', 'Staff'];
export const ROLE_TONE: Record<StaffRole, Tone> = { Owner: 'highlight', Admin: 'primary', Manager: 'info', Staff: 'neutral' };
const ROLE_FILTERS = ['All', ...ROLES] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

export default function UsersRolesTab() {
  return (
    <WithStore store={branchesStore}>
      {(branches) => <WithStore store={usersStore}>{(rows, setRows) => <UsersList rows={rows} setRows={setRows} branchNames={branches.map((b) => b.name)} />}</WithStore>}
    </WithStore>
  );
}

function UsersList({ rows, setRows, branchNames }: { rows: PortalUser[]; setRows: (rows: PortalUser[]) => void; branchNames: string[] }) {
  const { showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols } = useResponsive();
  const [filter, setFilter] = useState<RoleFilter>('All');
  const [inviting, setInviting] = useState(false);
  const [editingRole, setEditingRole] = useState<PortalUser | null>(null);
  const [toggling, setToggling] = useState<PortalUser | null>(null);
  const currentEmail = useMemo(() => readSession()?.email, []);

  const filtered = useMemo(() => rows.filter((u) => filter === 'All' || u.role === filter), [rows, filter]);
  const list = useListControls(filtered, {
    search: (u) => `${u.name} ${u.email} ${u.branch}`,
    sorts: {
      Role: (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role),
      Name: (a, b) => a.name.localeCompare(b.name),
      Branch: (a, b) => a.branch.localeCompare(b.branch),
    },
  });

  const activeOwners = rows.filter((u) => u.role === 'Owner' && u.active).length;
  const isLastOwner = (u: PortalUser) => u.role === 'Owner' && u.active && activeOwners <= 1;
  const isSelf = (u: PortalUser) => u.email === currentEmail;

  const columns: Column<PortalUser>[] = [
    {
      key: 'name',
      label: 'User',
      flex: 2,
      minWidth: 220,
      render: (u) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <Avatar name={u.name} size={30} />
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {u.name}
              {isSelf(u) ? ' (you)' : ''}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {u.email}
            </Text>
          </View>
        </View>
      ),
    },
    { key: 'role', label: 'Role', minWidth: 90, render: (u) => <Badge label={u.role} tone={ROLE_TONE[u.role]} /> },
    { key: 'branch', label: 'Branch', flex: 1.2, minWidth: 150 },
    { key: 'status', label: 'Status', minWidth: 90, render: (u) => <Badge label={u.active ? 'Active' : 'Disabled'} tone={u.active ? 'success' : 'neutral'} /> },
    { key: 'lastActive', label: 'Last active', minWidth: 100 },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 200,
      align: 'right',
      render: (u) => (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button label="Change role" size="sm" variant="outline" disabled={isLastOwner(u)} accessibilityHint={isLastOwner(u) ? 'The only active Owner cannot be changed' : undefined} onPress={() => setEditingRole(u)} />
          <Button label={u.active ? 'Disable' : 'Enable'} size="sm" variant={u.active ? 'danger' : 'secondary'} disabled={isLastOwner(u) || isSelf(u)} accessibilityHint={isSelf(u) ? 'You cannot disable your own account' : undefined} onPress={() => setToggling(u)} />
        </View>
      ),
    },
  ];

  return (
    <View>
      <SimulatedNote>Roles decide which sections appear in this portal. Enforcement moves to the backend later: invites are not emailed and role changes here do not change what a demo login can open.</SimulatedNote>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 8 }}>
        <StatTile label="Owners" value={rows.filter((u) => u.role === 'Owner').length} tone="highlight" icon={(c) => <Crown size={16} color={c} />} />
        <StatTile label="Admins" value={rows.filter((u) => u.role === 'Admin').length} tone="primary" icon={(c) => <ShieldCheck size={16} color={c} />} />
        <StatTile label="Managers" value={rows.filter((u) => u.role === 'Manager').length} tone="info" icon={(c) => <UserCog size={16} color={c} />} />
        <StatTile label="Staff" value={rows.filter((u) => u.role === 'Staff').length} tone="neutral" icon={(c) => <Users size={16} color={c} />} />
      </Grid>
      <View style={[styles.toolbar, { marginTop: 16 }]}>
        <Text style={styles.meta}>
          {list.total} of {rows.length} users shown
        </Text>
        <Button label="Invite user" size="sm" icon={(c) => <UserPlus size={14} color={c} />} onPress={() => setInviting(true)} />
      </View>
      <ListToolbar controls={list} placeholder="Search name, email or branch" filters={<ChipGroup options={ROLE_FILTERS} value={filter} onChange={setFilter} />} />
      <Card padded={false}>
        <DataTable columns={columns} rows={list.pageRows} rowKey={(u) => u.id} empty={<EmptyState title="No users" message="Nobody matches this search or role." compact />} />
      </Card>
      <Pager controls={list} />

      {inviting ? (
        <InviteSheet
          rows={rows}
          branchNames={branchNames}
          onClose={() => setInviting(false)}
          onSave={(u) => {
            setRows([u, ...rows]);
            setInviting(false);
            showToast(`${u.name} added as ${u.role} (simulated: no invite email is sent)`);
          }}
        />
      ) : null}
      {editingRole ? (
        <RoleSheet
          user={editingRole}
          onClose={() => setEditingRole(null)}
          onSave={(role) => {
            setRows(rows.map((u) => (u.id === editingRole.id ? { ...u, role } : u)));
            showToast(`${editingRole.name} is now ${role}`);
            setEditingRole(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!toggling}
        title={toggling?.active ? `Disable ${toggling.name}?` : `Enable ${toggling?.name}?`}
        message={toggling?.active ? 'They are marked as disabled in this list. Access is enforced by the backend later.' : 'They are marked as active again.'}
        confirmLabel={toggling?.active ? 'Disable' : 'Enable'}
        danger={toggling?.active}
        onCancel={() => setToggling(null)}
        onConfirm={() => {
          if (toggling) setRows(rows.map((u) => (u.id === toggling.id ? { ...u, active: !u.active } : u)));
          setToggling(null);
        }}
      />
    </View>
  );
}

function RoleSheet({ user, onClose, onSave }: { user: PortalUser; onClose: () => void; onSave: (role: StaffRole) => void }) {
  const styles = useThemedStyles(makeSettingsStyles);
  const [role, setRole] = useState<StaffRole>(user.role);
  return (
    <FormSheet
      visible
      title={`Change role: ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Keep as is" variant="ghost" onPress={onClose} />
          <Button label={`Make ${role}`} disabled={role === user.role} onPress={() => onSave(role)} />
        </>
      }>
      <Text style={styles.label}>New role</Text>
      <ChipGroup options={ROLES} value={role} onChange={setRole} />
      <Text style={[styles.meta, { marginTop: 10 }]}>The Permissions tab shows which sections each role can open.</Text>
    </FormSheet>
  );
}

function InviteSheet({ rows, branchNames, onClose, onSave }: { rows: PortalUser[]; branchNames: string[]; onClose: () => void; onSave: (u: PortalUser) => void }) {
  const styles = useThemedStyles(makeSettingsStyles);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('Staff');
  const [branch, setBranch] = useState(branchNames[0] ?? '');
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? 'Name is required' : undefined;
  const emailError = !isEmail(email) ? 'Enter a valid email address' : rows.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ? 'This email already has a user' : undefined;
  const branchError = !branch ? 'Add a branch first' : undefined;

  const submit = () => {
    setTouched(true);
    if (nameError || emailError || branchError) return;
    onSave({ id: `USR-${Date.now()}`, name: name.trim(), email: email.trim().toLowerCase(), role, branch, active: true, lastActive: 'Invited' });
  };

  return (
    <FormSheet
      visible
      title="Invite user"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Add user (simulated)" onPress={submit} />
        </>
      }>
      <SimulatedNote>Real email integration is pending. The user is added to this list and no invite is sent.</SimulatedNote>
      <View style={{ height: 12 }} />
      <FormRow>
        <Field label="Full name" required value={name} onChangeText={setName} error={touched ? nameError : undefined} />
        <Field label="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" error={touched ? emailError : undefined} />
      </FormRow>
      <Text style={styles.label}>Role</Text>
      <ChipGroup options={ROLES} value={role} onChange={setRole} />
      <Text style={[styles.label, { marginTop: 14 }]}>Branch</Text>
      <ChipGroup options={branchNames} value={branch} onChange={setBranch} />
      {touched && branchError ? <Text style={styles.error}>{branchError}</Text> : null}
    </FormSheet>
  );
}
