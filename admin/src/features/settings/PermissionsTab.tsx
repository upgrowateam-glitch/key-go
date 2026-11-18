import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Check, Minus } from 'lucide-react-native';
import { Card, ChipGroup, DataTable, EmptyState, Grid, SimulatedNote, StatTile, type Column } from '../../components/kit';
import { NAV_SECTIONS, type NavSection } from '../../config/navigation';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { StaffRole } from '../../services/auth';
import { ListToolbar, Pager, useListControls } from '../notifications/listControls';
import { makeSettingsStyles } from './formParts';

const ROLES: StaffRole[] = ['Owner', 'Admin', 'Manager', 'Staff'];
const ROLE_FILTERS = ['All roles', ...ROLES] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

export default function PermissionsTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeSettingsStyles);
  const { cols } = useResponsive();
  const [filter, setFilter] = useState<RoleFilter>('All roles');

  const rows = useMemo(() => (filter === 'All roles' ? NAV_SECTIONS : NAV_SECTIONS.filter((s) => s.roles.includes(filter))), [filter]);
  const list = useListControls(rows, { search: (s) => `${s.title} ${s.description}`, pageSize: 15 });

  const columns: Column<NavSection>[] = [
    {
      key: 'section',
      label: 'Section',
      flex: 3,
      minWidth: 240,
      render: (s) => (
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {s.description}
          </Text>
        </View>
      ),
    },
    ...ROLES.map(
      (role): Column<NavSection> => ({
        key: role,
        label: role,
        minWidth: 80,
        align: 'center',
        render: (s) =>
          s.roles.includes(role) ? (
            <View accessibilityLabel={`${role} can open ${s.title}`}>
              <Check size={16} color={colors.success} />
            </View>
          ) : (
            <View accessibilityLabel={`${role} cannot open ${s.title}`}>
              <Minus size={16} color={colors.muted} />
            </View>
          ),
      })
    ),
  ];

  return (
    <View>
      <SimulatedNote>This matrix shows the section access in the portal navigation. It is read-only, and enforcement moves to the backend later: today the check only runs in the browser.</SimulatedNote>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 8 }}>
        {ROLES.map((role) => (
          <StatTile key={role} label={role} value={NAV_SECTIONS.filter((s) => s.roles.includes(role)).length} hint={`of ${NAV_SECTIONS.length} sections`} tone={role === 'Owner' ? 'highlight' : role === 'Admin' ? 'primary' : role === 'Manager' ? 'info' : 'neutral'} />
        ))}
      </Grid>
      <View style={{ height: 16 }} />
      <ListToolbar controls={list} placeholder="Search sections" filters={<ChipGroup options={ROLE_FILTERS} value={filter} onChange={setFilter} />} />
      <Card padded={false}>
        <DataTable columns={columns} rows={list.pageRows} rowKey={(s) => s.id} empty={<EmptyState title="No sections" message="Nothing matches this search or role." compact />} />
      </Card>
      <Pager controls={list} />
    </View>
  );
}
