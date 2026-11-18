import { useRouter } from '@/shims/expo-router';
import { Car, CarFront, CircleCheck, KeyRound, Plus, Search, Tag, Wrench } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
    Badge,
    Button,
    Card,
    ChipGroup,
    Column,
    DataTable,
    EmptyState,
    Field,
    Grid,
    PageHeader,
    ProgressBar,
    Screen,
    StatTile,
    StatusBadge,
    Tone,
} from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { findSection } from '../../config/navigation';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatKm } from '../../lib/format';
import { categoryOf, loadFleetExtras, readFleetExtras, VEHICLE_CATEGORIES } from '../../services/fleet';
import { useResource } from '../../services/mockClient';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { Vehicle, VehicleStatus } from '../../types';
import { ListPager, usePaged } from './ListPager';
import { expiryFlag, VehicleThumb } from './shared';
import { VehicleForm } from './VehicleForm';

const STATUS_FILTERS = ['All', 'Available', 'Reserved', 'On Rent', 'Maintenance', 'Sold'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const TYPE_FILTERS = ['All types', 'Hatchback', 'Sedan', 'SUV', 'MUV', 'Electric', 'Luxury'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];
const CATEGORY_FILTERS = ['All categories', ...VEHICLE_CATEGORIES] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];
const SORT_KEYS = ['Name', 'Registration', 'Daily rate', 'Odometer', 'Insurance expiry'] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORTERS: Record<SortKey, (a: Vehicle, b: Vehicle) => number> = {
  Name: (a, b) => a.name.localeCompare(b.name),
  Registration: (a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber),
  'Daily rate': (a, b) => b.pricePerDay - a.pricePerDay,
  Odometer: (a, b) => b.odometerKm - a.odometerKm,
  'Insurance expiry': (a, b) => a.insuranceExpiry.localeCompare(b.insuranceExpiry),
};

export default function FleetScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone, cols } = useResponsive();
  const { vehicles, today } = useApp();
  const section = findSection('fleet')!;
  const extras = useResource(loadFleetExtras);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [type, setType] = useState<TypeFilter>('All types');
  const [category, setCategory] = useState<CategoryFilter>('All categories');
  const [sort, setSort] = useState<SortKey>('Name');
  const [formOpen, setFormOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<VehicleStatus, number> = { Available: 0, Reserved: 0, 'On Rent': 0, Maintenance: 0, Sold: 0 };
    vehicles.forEach((v) => (c[v.status] += 1));
    return c;
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    return vehicles
      .filter((v) => {
        if (status !== 'All' && v.status !== status) return false;
        if (type !== 'All types' && v.type !== type) return false;
        if (category !== 'All categories' && extras.data && categoryOf(extras.data, v.id) !== category) return false;
        if (!q) return true;
        const hay = [v.name, v.vehicleNumber, v.id, v.brand ?? ''].join('|').toLowerCase().replace(/\s+/g, '');
        return hay.includes(q);
      })
      .sort(SORTERS[sort]);
  }, [vehicles, query, status, type, category, sort, extras.data]);
  const paged = usePaged(filtered);

  const filtersActive = query.trim() !== '' || status !== 'All' || type !== 'All types' || category !== 'All categories';
  const resetFilters = () => {
    setQuery('');
    setStatus('All');
    setType('All types');
    setCategory('All categories');
  };

  const openVehicle = (v: Vehicle) => router.push(`/fleet/${encodeURIComponent(v.id)}` as any);

  const header = (
    <PageHeader
      title={section.title}
      subtitle={section.description}
      actions={<Button label="Add vehicle" icon={(c) => <Plus size={16} color={c} />} onPress={() => setFormOpen(true)} />}
    />
  );

  if (!extras.data) {
    return (
      <Screen>
        {header}
        <ResourceState loading={extras.loading} error={extras.error} onRetry={extras.reload} />
      </Screen>
    );
  }
  const data = extras.data;

  const columns: Column<Vehicle>[] = [
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 2.4,
      minWidth: 240,
      render: (v) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <VehicleThumb vehicle={v} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cellTitle} numberOfLines={1}>
              {v.name}
            </Text>
            <Text style={styles.cellSub} numberOfLines={1}>
              ID {v.id}
            </Text>
          </View>
        </View>
      ),
    },
    { key: 'number', label: 'Number', flex: 1.2, minWidth: 130, value: (v) => v.vehicleNumber },
    {
      key: 'type',
      label: 'Type',
      flex: 0.9,
      minWidth: 100,
      render: (v) => (
        <View>
          <Text style={styles.cellText}>{v.type}</Text>
          <Text style={styles.cellSub}>{categoryOf(data, v.id)}</Text>
        </View>
      ),
    },
    { key: 'status', label: 'Status', flex: 1, minWidth: 120, render: (v) => <StatusBadge status={v.status} /> },
    { key: 'odo', label: 'Odometer', flex: 1, minWidth: 110, align: 'right', value: (v) => formatKm(v.odometerKm) },
    {
      key: 'fuel',
      label: 'Fuel / charge',
      flex: 1,
      minWidth: 120,
      render: (v) => (
        <View style={{ width: '100%', gap: 4 }}>
          <Text style={styles.cellText}>{v.fuelLevelPercent}%</Text>
          <ProgressBar value={v.fuelLevelPercent / 100} tone={v.fuelLevelPercent < 25 ? 'warning' : 'primary'} height={5} />
        </View>
      ),
    },
    {
      key: 'insurance',
      label: 'Insurance expiry',
      flex: 1.3,
      minWidth: 150,
      render: (v) => {
        const flag = v.status === 'Sold' ? null : expiryFlag(v.insuranceExpiry, today);
        return (
          <View style={{ gap: 4 }}>
            <Text style={styles.cellText}>{formatDate(v.insuranceExpiry)}</Text>
            {flag ? <Badge label={flag.label} tone={flag.tone} /> : null}
          </View>
        );
      },
    },
  ];

  const kpis: { label: string; value: number; tone: Tone; filter: StatusFilter; icon: (c: string) => React.ReactNode }[] = [
    { label: 'Available', value: counts.Available, tone: 'success', filter: 'Available', icon: (c) => <CircleCheck size={16} color={c} /> },
    { label: 'On rent', value: counts['On Rent'], tone: 'violet', filter: 'On Rent', icon: (c) => <KeyRound size={16} color={c} /> },
    { label: 'Maintenance', value: counts.Maintenance, tone: 'warning', filter: 'Maintenance', icon: (c) => <Wrench size={16} color={c} /> },
    { label: 'Sold', value: counts.Sold, tone: 'danger', filter: 'Sold', icon: (c) => <Tag size={16} color={c} /> },
  ];

  const emptyNode = (
    <EmptyState
      title={vehicles.length ? 'No vehicles match' : 'No vehicles yet'}
      message={vehicles.length ? 'Try a different search or clear the filters.' : 'Add your first vehicle to start renting it out.'}
      icon={(c) => <CarFront size={22} color={c} />}
      action={
        vehicles.length ? (
          <Button label="Reset filters" variant="outline" size="sm" onPress={resetFilters} />
        ) : (
          <Button label="Add vehicle" size="sm" onPress={() => setFormOpen(true)} />
        )
      }
    />
  );

  return (
    <Screen>
      {header}

      <Grid cols={cols(2, 3, 5)} style={{ marginTop: 16 }}>
        <StatTile label="Total fleet" value={vehicles.length} hint={`${counts.Reserved} reserved`} emphasis icon={(c) => <Car size={16} color={c} />} onPress={() => setStatus('All')} />
        {kpis.map((k) => (
          <StatTile
            key={k.label}
            label={k.label}
            value={k.value}
            tone={k.tone}
            icon={k.icon}
            hint={status === k.filter ? 'Filtered' : 'Tap to filter'}
            onPress={() => setStatus(status === k.filter ? 'All' : k.filter)}
          />
        ))}
      </Grid>

      <Card style={{ marginTop: 4 }}>
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Name, registration number or vehicle ID"
          left={<Search size={16} color={colors.muted} />}
          style={{ marginBottom: 12 }}
        />
        <Text style={styles.filterLabel}>Status</Text>
        <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll={isPhone} />
        <Text style={[styles.filterLabel, { marginTop: 12 }]}>Type</Text>
        <ChipGroup options={TYPE_FILTERS} value={type} onChange={setType} scroll={isPhone} />
        <Text style={[styles.filterLabel, { marginTop: 12 }]}>Category</Text>
        <ChipGroup options={CATEGORY_FILTERS} value={category} onChange={setCategory} scroll={isPhone} />
        <Text style={[styles.filterLabel, { marginTop: 12 }]}>Sort by</Text>
        <ChipGroup options={SORT_KEYS} value={sort} onChange={setSort} scroll={isPhone} />
        <View style={styles.resultRow}>
          <Text style={styles.resultText}>
            Showing {filtered.length} of {vehicles.length} vehicles
          </Text>
          {filtersActive ? <Button label="Reset filters" variant="ghost" size="sm" onPress={resetFilters} /> : null}
        </View>
      </Card>

      <View style={{ marginTop: 16 }}>
        {isPhone ? (
          filtered.length === 0 ? (
            <Card>{emptyNode}</Card>
          ) : (
            <View style={{ gap: 10 }}>
              {paged.rows.map((v) => (
                <VehicleCard key={v.id} vehicle={v} today={today} onPress={() => openVehicle(v)} />
              ))}
            </View>
          )
        ) : (
          <DataTable columns={columns} rows={paged.rows} rowKey={(v) => v.id} onRowPress={openVehicle} empty={emptyNode} />
        )}
        <ListPager paged={paged} />
      </View>

      {formOpen ? <VehicleForm onClose={() => setFormOpen(false)} onSaved={() => extras.setData(readFleetExtras())} /> : null}
    </Screen>
  );
}

function VehicleCard({ vehicle: v, today, onPress }: { vehicle: Vehicle; today: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const ins = v.status === 'Sold' ? null : expiryFlag(v.insuranceExpiry, today);
  const puc = v.status === 'Sold' ? null : expiryFlag(v.pucExpiry, today);
  return (
    <Card onPress={onPress} style={{ padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel={`${v.name}, ${v.vehicleNumber}, ${v.status}`}>
        <VehicleThumb vehicle={v} width={84} height={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cellTitle} numberOfLines={1}>
            {v.name}
          </Text>
          <Text style={styles.cellSub} numberOfLines={1}>
            {v.vehicleNumber} · {v.type}
          </Text>
          <View style={{ marginTop: 6 }}>
            <StatusBadge status={v.status} />
          </View>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>{formatKm(v.odometerKm)}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>
          {v.fuelLevelPercent}% {v.fuel === 'Electric' ? 'charge' : 'fuel'}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{formatINR(v.pricePerDay)}/day</Text>
      </View>
      {ins || puc ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {ins ? <Badge label={`Insurance: ${ins.label}`} tone={ins.tone} /> : null}
          {puc ? <Badge label={`PUC: ${puc.label}`} tone={puc.tone} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cellTitle: { color: colors.txt, fontSize: 14, fontWeight: '700' },
    cellSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    cellText: { color: colors.txt, fontSize: 13 },
    filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
    resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, minHeight: 32 },
    resultText: { color: colors.muted, fontSize: 12 },
    cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
    metaText: { color: colors.txt, fontSize: 12, fontWeight: '600' },
    metaDot: { color: colors.muted, fontSize: 12 },
  });
