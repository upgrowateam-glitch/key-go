import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Eye, Lock, Minus, Pencil, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react-native';
import { Button, Card, ConfirmDialog, DataTable, Grid, StatTile, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../lib/api';
import type { Access, Area, StaffRole } from '../../services/auth';
import { useResource } from '../../services/mockClient';
import { useThemeColors, useThemedStyles, withAlpha } from '../../theme';
import { makeSettingsStyles } from './formParts';

type Table = Record<StaffRole, Record<Area, Access>>;
interface PermissionData {
  areas: { id: Area; label: string }[];
  roles: Table;
  defaults: Table;
  editableRoles: StaffRole[];
  canEdit: boolean;
}

const ROLES: StaffRole[] = ['Owner', 'Admin', 'Manager', 'Staff', 'Driver'];
const ACCESS: Access[] = ['none', 'view', 'edit'];
const ACCESS_LABEL: Record<Access, string> = { none: 'None', view: 'View', edit: 'Edit' };
const loadTable = () => api<PermissionData>('/auth/permissions');

/** What every role can view or change. The server enforces this table on every request; the Owner can change it. */
export default function PermissionsTab() {
  const data = useResource(loadTable);
  if (!data.data) return <ResourceState loading={data.loading} error={data.error} onRetry={data.reload} />;
  return <PermissionTable data={data.data} onSaved={(roles) => data.setData({ ...data.data!, roles })} />;
}

function PermissionTable({ data, onSaved }: { data: PermissionData; onSaved: (roles: Table) => void }) {
  const { showToast } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols, isPhone } = useResponsive();
  const { areas, defaults, editableRoles, canEdit } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Table>(data.roles);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const table = editing ? draft : data.roles;

  const changes = useMemo(
    () => editableRoles.reduce((n, r) => n + areas.filter((a) => draft[r][a.id] !== data.roles[r][a.id]).length, 0),
    [draft, data.roles, editableRoles, areas]
  );
  const custom = (role: StaffRole, area: Area) => editableRoles.includes(role) && data.roles[role][area] !== defaults[role][area];

  const set = (role: StaffRole, area: Area, access: Access) => setDraft((d) => ({ ...d, [role]: { ...d[role], [area]: access } }));

  const save = async (task: () => Promise<{ roles: Table }>, message: string) => {
    setSaving(true);
    try {
      const { roles } = await task();
      onSaved(roles);
      setDraft(roles);
      setEditing(false);
      showToast(message);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const show = (access: Access, role: StaffRole, label: string) =>
    access === 'edit' ? (
      <View accessibilityLabel={`${role} can change ${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pencil size={14} color={colors.success} />
        <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700' }}>Edit</Text>
      </View>
    ) : access === 'view' ? (
      <View accessibilityLabel={`${role} can view ${label}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Eye size={14} color={colors.info} />
        <Text style={{ color: colors.info, fontSize: 12, fontWeight: '700' }}>View</Text>
      </View>
    ) : (
      <View accessibilityLabel={`${role} has no access to ${label}`}>
        <Minus size={16} color={colors.muted} />
      </View>
    );

  /** None / View / Edit, side by side, for one role and area. */
  const picker = (role: StaffRole, area: { id: Area; label: string }) => (
    <View style={{ flexDirection: 'row', borderRadius: 9, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
      {ACCESS.map((a, i) => {
        const on = draft[role][area.id] === a;
        const tint = a === 'edit' ? colors.success : a === 'view' ? colors.info : colors.muted;
        return (
          <Pressable
            key={a}
            accessibilityRole="button"
            accessibilityLabel={`${role}: ${ACCESS_LABEL[a]} for ${area.label}`}
            accessibilityState={{ selected: on }}
            onPress={() => set(role, area.id, a)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 5,
              backgroundColor: on ? withAlpha(tint, 0.14) : colors.card,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: colors.line,
            }}>
            <Text style={{ fontSize: 11.5, fontWeight: on ? '800' : '600', color: on ? tint : colors.muted }}>{ACCESS_LABEL[a]}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const columns: Column<{ id: Area; label: string }>[] = [
    { key: 'area', label: 'Area', flex: 2, minWidth: 180, render: (a) => <Text style={styles.title}>{a.label}</Text> },
    ...ROLES.map(
      (role): Column<{ id: Area; label: string }> => ({
        key: role,
        label: role === 'Owner' ? 'Owner' : role,
        minWidth: editing && editableRoles.includes(role) ? 168 : 84,
        align: 'center',
        render: (a) =>
          editing && editableRoles.includes(role) ? (
            picker(role, a)
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {show(table[role]?.[a.id] ?? 'none', role, a.label)}
              {custom(role, a.id) ? <View accessibilityLabel="Changed from the default" style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning }} /> : null}
            </View>
          ),
      })
    ),
  ];

  return (
    <View>
      <Text style={styles.meta}>
        The server checks this table on every request, so a role cannot open or change an area from anywhere, not only from this portal. Owner is the Super Admin and always has full access. Drivers only see their own driver page
        (assigned trips and duty punch).
      </Text>
      <Grid cols={cols(2, 5, 5)} style={{ marginTop: 10 }}>
        {ROLES.map((role) => {
          const n = areas.filter((a) => (table[role]?.[a.id] ?? 'none') !== 'none').length;
          return <StatTile key={role} label={role} value={role === 'Driver' ? 'Own page' : n} hint={role === 'Driver' ? 'Trips & duty' : `of ${areas.length} areas`} tone={role === 'Owner' ? 'highlight' : role === 'Admin' ? 'primary' : role === 'Manager' ? 'info' : 'neutral'} />;
        })}
      </Grid>

      <View style={[styles.toolbar, { marginTop: 18, marginBottom: 12, flexWrap: 'wrap', gap: 10 }]}>
        {canEdit ? (
          editing ? (
            <Text style={[styles.meta, { flex: 1, minWidth: 220 }]}>
              Choose None, View or Edit for Admin, Manager and Staff. {changes ? `${changes} change${changes === 1 ? '' : 's'} not saved yet.` : 'No changes yet.'}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 220 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning }} />
              <Text style={styles.meta}>Changed from KeyGo’s default</Text>
            </View>
          )
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Lock size={14} color={colors.muted} />
            <Text style={styles.meta}>Only the Owner can change access.</Text>
          </View>
        )}
        {canEdit && !editing ? (
          <Button
            label="Change access"
            size="sm"
            icon={(c) => <SlidersHorizontal size={14} color={c} />}
            onPress={() => {
              setDraft(data.roles);
              setEditing(true);
            }}
          />
        ) : null}
        {canEdit && editing ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="Reset to defaults" size="sm" variant="ghost" icon={(c) => <RotateCcw size={14} color={c} />} onPress={() => setConfirmReset(true)} />
            <Button
              label="Cancel"
              size="sm"
              variant="outline"
              icon={(c) => <X size={14} color={c} />}
              onPress={() => {
                setDraft(data.roles);
                setEditing(false);
              }}
            />
            <Button
              label={saving ? 'Saving…' : 'Save changes'}
              size="sm"
              disabled={saving || !changes}
              icon={(c) => <Save size={14} color={c} />}
              onPress={() => save(() => api<{ roles: Table }>('/auth/permissions', { method: 'PUT', body: { roles: draft } }), 'Access updated. People see the change the next time they open the portal.')}
            />
          </View>
        ) : null}
      </View>

      {editing && (draft.Admin?.users === 'edit' || draft.Manager?.users === 'edit' || draft.Staff?.users === 'edit') ? (
        <Text style={[styles.meta, { color: colors.warning, marginBottom: 10 }]}>
          Edit on “User accounts” lets that role add, disable and delete staff accounts (but never Owners). Give it only to people you trust.
        </Text>
      ) : null}

      <Card padded={false}>
        <DataTable columns={columns} rows={areas} rowKey={(a) => a.id} />
      </Card>
      {isPhone && editing ? <Text style={[styles.meta, { marginTop: 8 }]}>Swipe the table sideways to see every role.</Text> : null}

      <ConfirmDialog
        visible={confirmReset}
        title="Reset to KeyGo’s default access?"
        message="Admin, Manager and Staff go back to the access KeyGo started with. Your changes are removed."
        confirmLabel="Reset"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          void save(() => api<{ roles: Table }>('/auth/permissions/reset', { method: 'POST' }), 'Access reset to the defaults.');
        }}
      />
    </View>
  );
}
