import React from 'react';
import { Text, View } from 'react-native';
import { Eye, Minus, Pencil } from 'lucide-react-native';
import { Card, DataTable, Grid, StatTile, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../lib/api';
import type { Access, Area, StaffRole } from '../../services/auth';
import { useResource } from '../../services/mockClient';
import { useThemeColors, useThemedStyles } from '../../theme';
import { makeSettingsStyles } from './formParts';

interface PermissionTable {
  areas: { id: Area; label: string }[];
  roles: Record<StaffRole, Record<Area, Access>>;
}

const ROLES: StaffRole[] = ['Owner', 'Admin', 'Manager', 'Staff', 'Driver'];
const loadTable = () => api<PermissionTable>('/auth/permissions');

/** What every role can view or change. This is the table the server enforces on every request. */
export default function PermissionsTab() {
  const table = useResource(loadTable);
  const colors = useThemeColors();
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols } = useResponsive();
  if (!table.data) return <ResourceState loading={table.loading} error={table.error} onRetry={table.reload} />;
  const { areas, roles } = table.data;

  const cell = (access: Access, role: StaffRole, label: string) =>
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

  const columns: Column<{ id: Area; label: string }>[] = [
    { key: 'area', label: 'Area', flex: 2, minWidth: 190, render: (a) => <Text style={styles.title}>{a.label}</Text> },
    ...ROLES.map((role): Column<{ id: Area; label: string }> => ({ key: role, label: role, minWidth: 84, align: 'center', render: (a) => cell(roles[role]?.[a.id] ?? 'none', role, a.label) })),
  ];

  return (
    <View>
      <Text style={styles.meta}>
        The server checks this table on every request, so a role cannot open or change an area from anywhere, not only from this portal. Owner is the Super Admin. Drivers only see their own driver page
        (assigned trips and duty punch).
      </Text>
      <Grid cols={cols(2, 5, 5)} style={{ marginTop: 10 }}>
        {ROLES.map((role) => {
          const n = areas.filter((a) => (roles[role]?.[a.id] ?? 'none') !== 'none').length;
          return <StatTile key={role} label={role} value={role === 'Driver' ? 'Own page' : n} hint={role === 'Driver' ? 'Trips & duty' : `of ${areas.length} areas`} tone={role === 'Owner' ? 'highlight' : role === 'Admin' ? 'primary' : role === 'Manager' ? 'info' : 'neutral'} />;
        })}
      </Grid>
      <View style={{ height: 16 }} />
      <Card padded={false}>
        <DataTable columns={columns} rows={areas} rowKey={(a) => a.id} />
      </Card>
    </View>
  );
}
