import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from '@/shims/expo-router';
import { FolderOpen } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, DataTable, EmptyState, PageHeader, Screen, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate } from '../../lib/format';
import { documentsOf, loadFleetExtras, type FleetExtras } from '../../services/fleet';
import { useResource } from '../../services/mockClient';
import { useThemeColors } from '../../theme';
import type { Vehicle } from '../../types';
import { expiryFlag, VehicleThumb } from './shared';

const FILTERS = ['All vehicles', 'Needs attention'] as const;
type Filter = (typeof FILTERS)[number];

interface Row {
  vehicle: Vehicle;
  insurance: ReturnType<typeof expiryFlag>;
  puc: ReturnType<typeof expiryFlag>;
  verified: number;
  pending: number;
  missing: number;
  total: number;
  attention: boolean;
}

/** Paperwork across the whole fleet: insurance, PUC and the document checklist of every vehicle. */
export default function DocumentsOverview() {
  const extras = useResource(loadFleetExtras);
  if (!extras.data) {
    return (
      <Screen>
        <ResourceState loading={extras.loading} error={extras.error} onRetry={extras.reload} />
      </Screen>
    );
  }
  return <Overview extras={extras.data} />;
}

function Overview({ extras }: { extras: FleetExtras }) {
  const colors = useThemeColors();
  const router = useRouter();
  const { isPhone } = useResponsive();
  const { vehicles, today } = useApp();
  const [filter, setFilter] = useState<Filter>('All vehicles');

  const rows = useMemo<Row[]>(
    () =>
      vehicles
        .filter((v) => v.status !== 'Sold')
        .map((vehicle) => {
          const docs = documentsOf(extras, vehicle.id);
          const verified = docs.filter((d) => d.status === 'Verified').length;
          const pending = docs.filter((d) => d.status === 'Pending').length;
          const missing = docs.filter((d) => d.status === 'Not uploaded' || d.status === 'Rejected').length;
          const docExpiring = docs.some((d) => d.expiry && expiryFlag(d.expiry, today));
          const insurance = expiryFlag(vehicle.insuranceExpiry, today);
          const puc = expiryFlag(vehicle.pucExpiry, today);
          return { vehicle, insurance, puc, verified, pending, missing, total: docs.length, attention: !!insurance || !!puc || missing > 0 || pending > 0 || docExpiring };
        }),
    [vehicles, extras, today]
  );
  const shown = filter === 'Needs attention' ? rows.filter((r) => r.attention) : rows;
  const open = (v: Vehicle) => router.push(`/fleet/${encodeURIComponent(v.id)}?tab=documents`);

  const expiry = (date: string, flag: Row['insurance']) => (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.txt, fontSize: 13 }}>{date ? formatDate(date) : 'Not recorded'}</Text>
      {flag ? <Badge label={flag.label} tone={flag.tone} /> : date ? <Badge label="Valid" tone="success" /> : null}
    </View>
  );

  const columns: Column<Row>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 2,
      minWidth: 230,
      render: (r) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <VehicleThumb vehicle={r.vehicle} />
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {r.vehicle.brand ? `${r.vehicle.brand} ` : ''}
              {r.vehicle.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{r.vehicle.vehicleNumber}</Text>
          </View>
        </View>
      ),
    },
    { key: 'insurance', label: 'Insurance', minWidth: 130, render: (r) => expiry(r.vehicle.insuranceExpiry, r.insurance) },
    { key: 'puc', label: 'PUC', minWidth: 130, render: (r) => expiry(r.vehicle.pucExpiry, r.puc) },
    {
      key: 'docs',
      label: 'Documents',
      minWidth: 170,
      render: (r) => (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={`${r.verified}/${r.total} verified`} tone={r.verified === r.total ? 'success' : 'neutral'} />
          {r.pending ? <Badge label={`${r.pending} to review`} tone="warning" /> : null}
          {r.missing ? <Badge label={`${r.missing} missing`} tone="danger" /> : null}
        </View>
      ),
    },
    {
      key: 'actions',
      label: '',
      minWidth: 150,
      align: 'right',
      render: (r) => <Button label="Open documents" size="sm" variant="outline" icon={(c) => <FolderOpen size={14} color={c} />} onPress={() => open(r.vehicle)} />,
    },
  ];

  return (
    <Screen>
      <PageHeader title="Vehicle Documents" subtitle="Insurance, PUC, registration, fitness and tax papers for every vehicle" />
      <View style={{ marginTop: 12, marginBottom: 12 }}>
        <ChipGroup options={FILTERS} value={filter} onChange={setFilter} scroll={isPhone} />
      </View>
      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={shown}
          rowKey={(r) => r.vehicle.id}
          onRowPress={(r) => open(r.vehicle)}
          empty={
            <EmptyState
              title={filter === 'Needs attention' ? 'Nothing needs attention' : 'No vehicles yet'}
              message={filter === 'Needs attention' ? 'All papers are uploaded, verified and valid.' : 'Add vehicles in Fleet Management first.'}
              compact
            />
          }
        />
      </Card>
    </Screen>
  );
}
