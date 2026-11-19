import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Car, Crown, KeyRound, Link2, ShieldCheck, Trash2, UserCog, UserPlus, Users } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, StatTile, ToggleRow, type Column, type Tone } from '../../components/kit';
import { fetchWhatsApp } from '../../services/whatsapp';
import { FilterBar, FilterOptions, type ActiveFilter } from '../fleet/FilterBar';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles } from '../../theme';
import { branchesStore, createUser, deleteUser, fetchUsers, inviteLink, sendInvite, updateUser, type PortalUser } from '../../services/settings';
import { InviteLinkSheet } from './InviteLinkSheet';
import { readSession, type StaffRole } from '../../services/auth';
import { useResource } from '../../services/mockClient';
import { Pager, useListControls, WithStore } from '../notifications/listControls';
import { isEmail, makeSettingsStyles } from './formParts';

export const ROLES: StaffRole[] = ['Owner', 'Admin', 'Manager', 'Staff', 'Driver'];
export const ROLE_TONE: Record<StaffRole, Tone> = { Owner: 'highlight', Admin: 'primary', Manager: 'info', Staff: 'neutral', Driver: 'violet' };
/** Owner is the Super Admin. */
const roleLabel = (r: StaffRole) => (r === 'Owner' ? 'Owner (Super Admin)' : r);
const roleLabels = (roles: StaffRole[]) => Object.fromEntries(roles.map((r) => [r, roleLabel(r)])) as Record<StaffRole, string>;
const ROLE_FILTERS = ['All roles', ...ROLES] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];
const STATUS_FILTERS = ['Any status', 'Active', 'Disabled'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const SORTS = ['Role', 'Name', 'Branch'] as const;
type SortName = (typeof SORTS)[number];
const NO_BRANCH = 'No branch';
const ACCESS_METHODS = ['Send an invite link', 'Set a password now'] as const;
type AccessMethod = (typeof ACCESS_METHODS)[number];

/** "Invite expires 25 Nov" or "Invite expired" for people who have not joined yet. */
function inviteHint(u: PortalUser) {
  if (!u.inviteExpiresAt) return 'Invite pending';
  const at = new Date(u.inviteExpiresAt);
  return at < new Date() ? 'Invite expired, send a new link' : `Invite expires ${at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

/** Staff accounts that can sign in to this portal. Only Owners and Admins can open this tab. */
export default function UsersRolesTab() {
  const users = useResource(fetchUsers);
  if (!users.data) return <ResourceState loading={users.loading} error={users.error} onRetry={users.reload} />;
  return <WithStore store={branchesStore}>{(branches) => <UsersList rows={users.data!} setRows={users.setData} branchNames={branches.filter((b) => b.active).map((b) => b.name)} />}</WithStore>;
}

function UsersList({ rows, setRows, branchNames }: { rows: PortalUser[]; setRows: (rows: PortalUser[]) => void; branchNames: string[] }) {
  const { showToast, drivers } = useApp();
  const driverName = (id?: string | null) => drivers.find((d) => d.id === id)?.name;
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols, isDesktop } = useResponsive();
  const [filter, setFilter] = useState<RoleFilter>('All roles');
  const [status, setStatus] = useState<StatusFilter>('Any status');
  const [inviting, setInviting] = useState(false);
  /** The invitation link to show after creating a user or making a new link. */
  const [shareInvite, setShareInvite] = useState<{ user: PortalUser; link: string; note?: string } | null>(null);
  // Whether KeyGo's WhatsApp number is linked, so invitations can be sent automatically
  const [waReady, setWaReady] = useState(false);
  useEffect(() => {
    fetchWhatsApp().then((w) => setWaReady(w.status === 'connected'), () => setWaReady(false));
  }, []);
  const [editingRole, setEditingRole] = useState<PortalUser | null>(null);
  const [resetting, setResetting] = useState<PortalUser | null>(null);
  const [toggling, setToggling] = useState<PortalUser | null>(null);
  const [deleting, setDeleting] = useState<PortalUser | null>(null);
  const me = useMemo(() => readSession(), []);

  const filtered = useMemo(
    () => rows.filter((u) => (filter === 'All roles' || u.role === filter) && (status === 'Any status' || (status === 'Active') === u.active)),
    [rows, filter, status]
  );
  const list = useListControls(filtered, {
    search: (u) => `${u.name} ${u.email} ${u.phone} ${u.branch}`,
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
  const newLink = async (u: PortalUser) => {
    const viaWhatsApp = waReady && !!u.phone;
    const saved = await run(
      () => sendInvite(u.id, viaWhatsApp),
      (x) => (x.whatsappSent ? `New invitation sent on WhatsApp to ${x.whatsappTo}. Any earlier link no longer works.` : 'New invitation link ready. Any earlier link no longer works.')
    );
    if (saved?.inviteToken) {
      replace(saved);
      if (!saved.whatsappSent) setShareInvite({ user: saved, link: inviteLink(saved.inviteToken), note: saved.whatsappError });
    }
  };

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

  const actions = (u: PortalUser) => (
    <View style={{ flexDirection: 'row', flexWrap: isDesktop ? 'nowrap' : 'wrap', gap: 6, justifyContent: isDesktop ? 'flex-end' : 'flex-start' }}>
      <Button label="Change role" size="sm" variant="outline" disabled={isLastOwner(u) || ownerOnly(u)} onPress={() => setEditingRole(u)} />
      {u.invitePending ? (
        <Button label="Invite link" size="sm" variant="outline" disabled={ownerOnly(u) || !u.active} icon={(c) => <Link2 size={13} color={c} />} onPress={() => newLink(u)} />
      ) : (
        <Button label="Reset password" size="sm" variant="outline" disabled={ownerOnly(u)} icon={(c) => <KeyRound size={13} color={c} />} onPress={() => setResetting(u)} />
      )}
      <Button label={u.active ? 'Disable' : 'Enable'} size="sm" variant={u.active ? 'danger' : 'secondary'} disabled={isLastOwner(u) || isSelf(u) || ownerOnly(u)} onPress={() => setToggling(u)} />
      <Button label="Delete" size="sm" variant="danger" disabled={isLastOwner(u) || isSelf(u) || ownerOnly(u)} icon={(c) => <Trash2 size={13} color={c} />} onPress={() => setDeleting(u)} />
    </View>
  );
  const roleCell = (u: PortalUser) => (
    <View style={{ gap: 2, alignItems: 'flex-start' }}>
      <Badge label={u.role} tone={ROLE_TONE[u.role]} />
      {u.role === 'Driver' ? <Text style={styles.meta}>{driverName(u.driverId) ?? 'Driver record missing'}</Text> : null}
    </View>
  );

  // Desktop: one compact row per user; branch and last sign-in sit under the name and status
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
              {[u.email, u.phone, u.branch].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      minWidth: 110,
      render: roleCell,
    },
    {
      key: 'status',
      label: 'Status',
      minWidth: 120,
      render: (u) => (
        <View style={{ gap: 2, alignItems: 'flex-start' }}>
          <Badge label={!u.active ? 'Disabled' : u.invitePending ? 'Invite pending' : 'Active'} tone={!u.active ? 'neutral' : u.invitePending ? 'warning' : 'success'} />
          <Text style={styles.meta}>{u.invitePending ? inviteHint(u) : `Signed in: ${u.lastActive}`}</Text>
        </View>
      ),
    },
    { key: 'actions', label: 'Actions', flex: 3, minWidth: 470, align: 'right', render: actions },
  ];

  const activeFilters: ActiveFilter[] = [
    ...(filter !== 'All roles' ? [{ key: 'role', label: `Role: ${filter}`, onClear: () => setFilter('All roles') }] : []),
    ...(status !== 'Any status' ? [{ key: 'status', label: `Status: ${status}`, onClear: () => setStatus('Any status') }] : []),
  ];
  const empty = <EmptyState title="No users" message="Nobody matches this search or filter." compact />;

  return (
    <View>
      <Text style={styles.meta}>Each person signs in with their own email and password. Roles decide which sections they can open, and the server enforces it.</Text>
      <Grid cols={cols(2, 3, 5)} style={{ marginTop: 12 }}>
        <StatTile label="Owners" value={rows.filter((u) => u.role === 'Owner').length} tone="highlight" icon={(c) => <Crown size={16} color={c} />} />
        <StatTile label="Admins" value={rows.filter((u) => u.role === 'Admin').length} tone="primary" icon={(c) => <ShieldCheck size={16} color={c} />} />
        <StatTile label="Managers" value={rows.filter((u) => u.role === 'Manager').length} tone="info" icon={(c) => <UserCog size={16} color={c} />} />
        <StatTile label="Staff" value={rows.filter((u) => u.role === 'Staff').length} tone="neutral" icon={(c) => <Users size={16} color={c} />} />
        <StatTile label="Drivers" value={rows.filter((u) => u.role === 'Driver').length} tone="violet" icon={(c) => <Car size={16} color={c} />} />
      </Grid>
      <View style={[styles.toolbar, { marginTop: 20, marginBottom: 12 }]}>
        <Text style={styles.meta}>
          {list.total} of {rows.length} users shown
        </Text>
        <Button label="Add user" size="sm" icon={(c) => <UserPlus size={14} color={c} />} onPress={() => setInviting(true)} />
      </View>
      <View style={{ zIndex: 20, marginBottom: 14 }}>
        <FilterBar
          query={list.query}
          onQuery={list.setQuery}
          placeholder="Search name, email or branch"
          active={activeFilters}
          onClearAll={() => {
            setFilter('All roles');
            setStatus('Any status');
          }}
          sortOptions={SORTS}
          sort={list.sort as SortName}
          onSort={list.setSort}
          panel={
            <>
              <FilterOptions label="Role" options={ROLE_FILTERS} value={filter} onChange={setFilter} />
              <FilterOptions label="Status" options={STATUS_FILTERS} value={status} onChange={setStatus} />
            </>
          }
        />
      </View>
      {isDesktop ? (
        <Card padded={false}>
          <DataTable columns={columns} rows={list.pageRows} rowKey={(u) => u.id} empty={empty} />
        </Card>
      ) : list.pageRows.length === 0 ? (
        <Card>{empty}</Card>
      ) : (
        <View style={{ gap: 10 }}>
          {list.pageRows.map((u) => (
            <Card key={u.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={u.name} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {u.name}
                    {isSelf(u) ? ' (you)' : ''}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[u.email, u.phone].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {roleCell(u)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <Badge label={!u.active ? 'Disabled' : u.invitePending ? 'Invite pending' : 'Active'} tone={!u.active ? 'neutral' : u.invitePending ? 'warning' : 'success'} />
                <Text style={styles.meta}>
                  {u.branch || 'No branch'} · {u.invitePending ? inviteHint(u) : `signed in: ${u.lastActive}`}
                </Text>
              </View>
              <View style={{ marginTop: 12 }}>{actions(u)}</View>
            </Card>
          ))}
        </View>
      )}
      <Pager controls={list} />

      {inviting ? (
        <AddUserSheet
          rows={rows}
          branchNames={branchNames}
          canAddOwner={me?.role === 'Owner'}
          whatsappReady={waReady}
          onClose={() => setInviting(false)}
          onSave={async (input) => {
            const saved = await run(
              () => createUser(input),
              (u) =>
                u.whatsappSent
                  ? `${u.name} was added. Invitation sent on WhatsApp to ${u.whatsappTo}.`
                  : u.inviteToken
                    ? `${u.name} was added. Send them the invitation link.`
                    : `${u.name} can now sign in as ${u.role}. Share the starting password with them privately.`
            );
            if (saved) {
              setRows([...rows, saved]);
              setInviting(false);
              // Sent on WhatsApp: nothing more to do. Otherwise show the link to send by hand (with the reason, if WhatsApp failed)
              if (saved.inviteToken && !saved.whatsappSent) setShareInvite({ user: saved, link: inviteLink(saved.inviteToken), note: saved.whatsappError });
            }
          }}
        />
      ) : null}
      {shareInvite ? (
        <InviteLinkSheet
          name={shareInvite.user.name}
          email={shareInvite.user.email}
          phone={shareInvite.user.phone}
          role={shareInvite.user.role}
          link={shareInvite.link}
          note={shareInvite.note}
          onClose={() => setShareInvite(null)}
        />
      ) : null}
      {editingRole ? (
        <RoleSheet
          user={editingRole}
          canMakeOwner={me?.role === 'Owner'}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          takenDriverIds={rows.filter((x) => x.id !== editingRole.id && x.driverId).map((x) => x.driverId!)}
          onClose={() => setEditingRole(null)}
          onSave={async (role, driverId) => {
            const saved = await run(() => updateUser(editingRole.id, { role, driverId }), (u) => `${u.name} is now ${u.role}`);
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
      <ConfirmDialog
        visible={!!deleting}
        title={deleting?.invitePending ? `Cancel the invitation for ${deleting.name}?` : `Delete ${deleting?.name}?`}
        message={
          deleting?.invitePending
            ? 'Their invitation link stops working and they are removed from the list. You can invite them again later.'
            : 'Their account is removed and they are signed out at once. This cannot be undone. To stop someone for a while, use Disable instead.'
        }
        confirmLabel={deleting?.invitePending ? 'Cancel invitation' : 'Delete'}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          try {
            await deleteUser(target.id);
            setRows(rows.filter((u) => u.id !== target.id));
            showToast(target.invitePending ? `Invitation for ${target.name} cancelled` : `${target.name} was deleted`);
          } catch (e) {
            showToast((e as Error).message);
          }
        }}
      />
    </View>
  );
}

function RoleSheet({
  user,
  canMakeOwner,
  drivers,
  takenDriverIds,
  onClose,
  onSave,
}: {
  user: PortalUser;
  canMakeOwner: boolean;
  drivers: { id: string; name: string }[];
  takenDriverIds: string[];
  onClose: () => void;
  onSave: (role: StaffRole, driverId?: string) => void;
}) {
  const styles = useThemedStyles(makeSettingsStyles);
  const [role, setRole] = useState<StaffRole>(user.role);
  const [driverId, setDriverId] = useState<string | undefined>(user.driverId ?? undefined);
  const options = canMakeOwner ? ROLES : ROLES.filter((r) => r !== 'Owner');
  const needsDriver = role === 'Driver' && !driverId;
  const unchanged = role === user.role && (role !== 'Driver' || driverId === user.driverId);
  return (
    <FormSheet
      visible
      title={`Change role: ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Keep as is" variant="ghost" onPress={onClose} />
          <Button label={`Make ${role}`} disabled={unchanged || needsDriver} onPress={() => onSave(role, role === 'Driver' ? driverId : undefined)} />
        </>
      }>
      <Text style={styles.label}>New role</Text>
      <ChipGroup options={options} value={role} onChange={setRole} labels={roleLabels(options)} />
      {role === 'Driver' ? <DriverPicker drivers={drivers} taken={takenDriverIds} value={driverId} onChange={setDriverId} /> : null}
      <Text style={[styles.meta, { marginTop: 10 }]}>The Permissions tab shows what each role can view or change. Changing a role signs the person out on every device.</Text>
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
  whatsappReady,
  onClose,
  onSave,
}: {
  rows: PortalUser[];
  branchNames: string[];
  canAddOwner: boolean;
  whatsappReady: boolean;
  onClose: () => void;
  onSave: (input: { name: string; email?: string; phone?: string; role: StaffRole; branch: string; password?: string; driverId?: string; sendWhatsApp?: boolean }) => void;
}) {
  const { drivers } = useApp();
  const [driverId, setDriverId] = useState<string | undefined>();
  const styles = useThemedStyles(makeSettingsStyles);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sendOnWhatsApp, setSendOnWhatsApp] = useState(true);
  const [password, setPassword] = useState('');
  const [access, setAccess] = useState<AccessMethod>('Send an invite link');
  const byInvite = access === 'Send an invite link';
  const [role, setRole] = useState<StaffRole>('Staff');
  const branchOptions = [NO_BRANCH, ...branchNames];
  const [branch, setBranch] = useState(branchOptions[0]);
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? 'Name is required' : undefined;
  const digits = phone.replace(/\D/g, '');
  const phoneKey = digits.length === 10 ? `91${digits}` : digits;
  const phoneError = !phone.trim()
    ? undefined
    : digits.length < 10 || digits.length > 13
      ? 'Enter a valid WhatsApp number'
      : rows.some((u) => u.phone.replace(/\D/g, '') === phoneKey)
        ? 'This number already has a user'
        : undefined;
  const emailError = !email.trim()
    ? !phone.trim()
      ? 'Enter a WhatsApp number or an email'
      : undefined
    : !isEmail(email)
      ? 'Enter a valid email address'
      : rows.some((u) => u.email && u.email.toLowerCase() === email.trim().toLowerCase())
        ? 'This email already has a user'
        : undefined;
  const autoSend = byInvite && sendOnWhatsApp && !!phone.trim() && whatsappReady;
  const passwordError = !byInvite && password.length < 8 ? 'Use at least 8 characters' : undefined;
  const driverError = role === 'Driver' && !driverId ? 'Choose the driver this account is for' : undefined;

  const submit = () => {
    setTouched(true);
    if (nameError || emailError || phoneError || passwordError || driverError) return;
    onSave({
      name: name.trim(),
      email: email.trim().toLowerCase() || undefined,
      phone: phone.trim() || undefined,
      role,
      branch: branch === NO_BRANCH ? '' : branch,
      password: byInvite ? undefined : password,
      driverId: role === 'Driver' ? driverId : undefined,
      sendWhatsApp: autoSend,
    });
  };

  return (
    <FormSheet
      visible
      title="Add user"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={autoSend ? 'Add and send on WhatsApp' : byInvite ? 'Add and get link' : 'Add user'} onPress={submit} />
        </>
      }>
      <Field label="Full name" required value={name} onChangeText={setName} error={touched ? nameError : undefined} />
      <FormRow>
        <Field label="WhatsApp number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" error={touched ? phoneError : undefined} hint="They can sign in with this number." />
        <Field label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="name@example.com" error={touched ? emailError : undefined} />
      </FormRow>
      <Text style={styles.label}>How will they get in?</Text>
      <ChipGroup options={ACCESS_METHODS} value={access} onChange={setAccess} />
      {byInvite ? (
        <View style={{ marginTop: 8, marginBottom: 12 }}>
          <Text style={styles.meta}>They get a one-time link, open it and choose their own password. The link works for 7 days.</Text>
          {phone.trim() ? (
            whatsappReady ? (
              <ToggleRow label="Send the link on WhatsApp now" description="Sent automatically from KeyGo's WhatsApp number." value={sendOnWhatsApp} onValueChange={setSendOnWhatsApp} />
            ) : (
              <Text style={[styles.meta, { marginTop: 6 }]}>KeyGo's WhatsApp isn't connected, so you'll get the link to send yourself. Connect it in System → WhatsApp & SMS to send automatically.</Text>
            )
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Field label="Starting password" required secureTextEntry value={password} onChangeText={setPassword} error={touched ? passwordError : undefined} hint="Share it with them privately. They can change it later from their account menu." />
        </View>
      )}
      <Text style={styles.label}>Role</Text>
      <ChipGroup options={canAddOwner ? ROLES : ROLES.filter((r) => r !== 'Owner')} value={role} onChange={setRole} labels={roleLabels(ROLES)} />
      {role === 'Driver' ? (
        <DriverPicker
          drivers={drivers.map((d) => ({ id: d.id, name: d.name }))}
          taken={rows.filter((u) => u.driverId).map((u) => u.driverId!)}
          value={driverId}
          onChange={setDriverId}
          error={touched ? driverError : undefined}
        />
      ) : null}
      <Text style={[styles.label, { marginTop: 14 }]}>Branch</Text>
      <ChipGroup options={branchOptions} value={branch} onChange={setBranch} />
    </FormSheet>
  );
}

/** Chooses which driver record a Driver account belongs to; drivers who already have an account are left out. */
function DriverPicker({ drivers, taken, value, onChange, error }: { drivers: { id: string; name: string }[]; taken: string[]; value?: string; onChange: (id: string) => void; error?: string }) {
  const styles = useThemedStyles(makeSettingsStyles);
  const colors = useThemeColors();
  const free = drivers.filter((d) => !taken.includes(d.id) || d.id === value);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>Driver</Text>
      {free.length ? (
        <ChipGroup options={free.map((d) => d.id)} value={value ?? ''} onChange={onChange} labels={Object.fromEntries(free.map((d) => [d.id, d.name]))} />
      ) : (
        <Text style={styles.meta}>Every driver already has an account, or no drivers are added yet. Add the driver under Drivers & Staff → Drivers first.</Text>
      )}
      {error ? <Text style={[styles.meta, { color: colors.danger, marginTop: 6 }]}>{error}</Text> : null}
    </View>
  );
}
