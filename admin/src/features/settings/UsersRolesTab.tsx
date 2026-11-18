import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Crown, KeyRound, ShieldCheck, UserCog, UserPlus, Users } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, StatTile, type Column, type Tone } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../theme';
import { branchesStore, createUser, fetchUsers, updateUser, type PortalUser } from '../../services/settings';
import { readSession, type StaffRole } from '../../services/auth';
import { useResource } from '../../services/mockClient';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import { isEmail, makeSettingsStyles } from './formParts';

export const ROLES: StaffRole[] = ['Owner', 'Admin', 'Manager', 'Staff'];
export const ROLE_TONE: Record<StaffRole, Tone> = { Owner: 'highlight', Admin: 'primary', Manager: 'info', Staff: 'neutral' };
const ROLE_FILTERS = ['All', ...ROLES] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];
const NO_BRANCH = 'No branch';

/** Staff accounts that can sign in to this portal. Only Owners and Admins can open this tab. */
export default function UsersRolesTab() {
  const users = useResource(fetchUsers);
  if (!users.data) return <ResourceState loading={users.loading} error={users.error} onRetry={users.reload} />;
  return <WithStore store={branchesStore}>{(branches) => <UsersList rows={users.data!} setRows={users.setData} branchNames={branches.filter((b) => b.active).map((b) => b.name)} />}</WithStore>;
}

function UsersList({ rows, setRows, branchNames }: { rows: PortalUser[]; setRows: (rows: PortalUser[]) => void; branchNames: string[] }) {
  const { showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols } = useResponsive();
  const [filter, setFilter] = useState<RoleFilter>('All');
  const [inviting, setInviting] = useState(false);
  const [editingRole, setEditingRole] = useState<PortalUser | null>(null);
  const [resetting, setResetting] = useState<PortalUser | null>(null);
  const [toggling, setToggling] = useState<PortalUser | null>(null);
  const me = useMemo(() => readSession(), []);

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
  const isSelf = (u: PortalUser) => u.id === me?.id;
  const ownerOnly = (u: PortalUser) => u.role === 'Owner' && me?.role !== 'Owner';
  const replace = (saved: PortalUser) => setRows(rows.map((u) => (u.id === saved.id ? saved : u)));

  const run = async (task: () => Promise<PortalUser>, done: (saved: PortalUser) => string) => {
    try {
      const saved = await task();
      showToast(done(saved));
      return saved;
    } catch (e) {
      showToast((e as Error).message);
      return null;
    }
  };

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
    { key: 'branch', label: 'Branch', flex: 1.2, minWidth: 150, render: (u) => <Text style={styles.meta}>{u.branch || '—'}</Text> },
    { key: 'status', label: 'Status', minWidth: 90, render: (u) => <Badge label={u.active ? 'Active' : 'Disabled'} tone={u.active ? 'success' : 'neutral'} /> },
    { key: 'lastActive', label: 'Last sign-in', minWidth: 100 },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 300,
      align: 'right',
      render: (u) => (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button label="Change role" size="sm" variant="outline" disabled={isLastOwner(u) || ownerOnly(u)} onPress={() => setEditingRole(u)} />
          <Button label="Reset password" size="sm" variant="outline" disabled={ownerOnly(u)} icon={(c) => <KeyRound size={13} color={c} />} onPress={() => setResetting(u)} />
          <Button label={u.active ? 'Disable' : 'Enable'} size="sm" variant={u.active ? 'danger' : 'secondary'} disabled={isLastOwner(u) || isSelf(u) || ownerOnly(u)} onPress={() => setToggling(u)} />
        </View>
      ),
    },
  ];

  return (
    <View>
      <Text style={styles.meta}>Each person signs in with their own email and password. Roles decide which sections they can open, and the server enforces it.</Text>
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
        <Button label="Add user" size="sm" icon={(c) => <UserPlus size={14} color={c} />} onPress={() => setInviting(true)} />
      </View>
      <ListToolbar controls={list} placeholder="Search name, email or branch" filters={<ChipGroup options={ROLE_FILTERS} value={filter} onChange={setFilter} />} />
      <Card padded={false}>
        <DataTable columns={columns} rows={list.pageRows} rowKey={(u) => u.id} empty={<EmptyState title="No users" message="Nobody matches this search or role." compact />} />
      </Card>
      <Pager controls={list} />

      {inviting ? (
        <AddUserSheet
          rows={rows}
          branchNames={branchNames}
          canAddOwner={me?.role === 'Owner'}
          onClose={() => setInviting(false)}
          onSave={async (input) => {
            const saved = await run(() => createUser(input), (u) => `${u.name} can now sign in as ${u.role}. Share the starting password with them privately.`);
            if (saved) {
              setRows([...rows, saved]);
              setInviting(false);
            }
          }}
        />
      ) : null}
      {editingRole ? (
        <RoleSheet
          user={editingRole}
          canMakeOwner={me?.role === 'Owner'}
          onClose={() => setEditingRole(null)}
          onSave={async (role) => {
            const saved = await run(() => updateUser(editingRole.id, { role }), (u) => `${u.name} is now ${u.role}`);
            if (saved) replace(saved);
            setEditingRole(null);
          }}
        />
      ) : null}
      {resetting ? (
        <PasswordSheet
          user={resetting}
          onClose={() => setResetting(null)}
          onSave={async (password) => {
            const saved = await run(() => updateUser(resetting.id, { password }), (u) => `New password set for ${u.name}. Share it with them privately.`);
            if (saved) setResetting(null);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={!!toggling}
        title={toggling?.active ? `Disable ${toggling.name}?` : `Enable ${toggling?.name}?`}
        message={toggling?.active ? 'They are signed out and can no longer sign in until enabled again.' : 'They can sign in again with their password.'}
        confirmLabel={toggling?.active ? 'Disable' : 'Enable'}
        danger={toggling?.active}
        onCancel={() => setToggling(null)}
        onConfirm={async () => {
          const target = toggling;
          setToggling(null);
          if (!target) return;
          const saved = await run(() => updateUser(target.id, { active: !target.active }), (u) => `${u.name} ${u.active ? 'enabled' : 'disabled'}`);
          if (saved) replace(saved);
        }}
      />
    </View>
  );
}

function RoleSheet({ user, canMakeOwner, onClose, onSave }: { user: PortalUser; canMakeOwner: boolean; onClose: () => void; onSave: (role: StaffRole) => void }) {
  const styles = useThemedStyles(makeSettingsStyles);
  const [role, setRole] = useState<StaffRole>(user.role);
  const options = canMakeOwner ? ROLES : ROLES.filter((r) => r !== 'Owner');
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
      <ChipGroup options={options} value={role} onChange={setRole} />
      <Text style={[styles.meta, { marginTop: 10 }]}>The Permissions tab shows which sections each role can open.</Text>
    </FormSheet>
  );
}

function PasswordSheet({ user, onClose, onSave }: { user: PortalUser; onClose: () => void; onSave: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const error = password.length < 8 ? 'Use at least 8 characters' : undefined;
  return (
    <FormSheet
      visible
      title={`Reset password: ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button
            label="Set password"
            onPress={() => {
              setTouched(true);
              if (!error) onSave(password);
            }}
          />
        </>
      }>
      <Field label="New password" required secureTextEntry value={password} onChangeText={setPassword} error={touched ? error : undefined} hint="Share it with them privately. They keep using it until it is reset again." />
    </FormSheet>
  );
}

function AddUserSheet({
  rows,
  branchNames,
  canAddOwner,
  onClose,
  onSave,
}: {
  rows: PortalUser[];
  branchNames: string[];
  canAddOwner: boolean;
  onClose: () => void;
  onSave: (input: { name: string; email: string; role: StaffRole; branch: string; password: string }) => void;
}) {
  const styles = useThemedStyles(makeSettingsStyles);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('Staff');
  const branchOptions = [NO_BRANCH, ...branchNames];
  const [branch, setBranch] = useState(branchOptions[0]);
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? 'Name is required' : undefined;
  const emailError = !isEmail(email) ? 'Enter a valid email address' : rows.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()) ? 'This email already has a user' : undefined;
  const passwordError = password.length < 8 ? 'Use at least 8 characters' : undefined;

  const submit = () => {
    setTouched(true);
    if (nameError || emailError || passwordError) return;
    onSave({ name: name.trim(), email: email.trim().toLowerCase(), role, branch: branch === NO_BRANCH ? '' : branch, password });
  };

  return (
    <FormSheet
      visible
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Add user" onPress={submit} />
        </>
      }>
      <FormRow>
        <Field label="Full name" required value={name} onChangeText={setName} error={touched ? nameError : undefined} />
        <Field label="Email" required value={email} onChangeText={setEmail} keyboardType="email-address" error={touched ? emailError : undefined} />
      </FormRow>
      <Field label="Starting password" required secureTextEntry value={password} onChangeText={setPassword} error={touched ? passwordError : undefined} hint="Share it with them privately. You can reset it later." />
      <Text style={styles.label}>Role</Text>
      <ChipGroup options={canAddOwner ? ROLES : ROLES.filter((r) => r !== 'Owner')} value={role} onChange={setRole} />
      <Text style={[styles.label, { marginTop: 14 }]}>Branch</Text>
      <ChipGroup options={branchOptions} value={branch} onChange={setBranch} />
    </FormSheet>
  );
}
