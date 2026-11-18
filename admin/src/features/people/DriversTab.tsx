import { useRouter } from '@/shims/expo-router';
import { Car, IndianRupee, Link2, Navigation, RotateCcw, Star, UserCheck, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
    Avatar,
    Badge,
    Button,
    Card,
    ConfirmDialog,
    DataTable,
    Divider,
    DocumentSlot,
    EmptyState,
    Field,
    FormSheet,
    Grid,
    KeyValueGrid,
    ListRow,
    Section,
    SegmentedControl,
    SplitView,
    StatTile,
    StatusBadge,
    type Column,
} from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Driver } from '../../types';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, usePaged } from '../finance/tableTools';
import { AssignDriverSheet, licenceState } from './AssignDriverSheet';

const DUTY_OPTIONS = ['On Duty', 'On Trip', 'Off Duty'] as const;
const DUTY_FILTERS = ['All', ...DUTY_OPTIONS] as const;
const SORTS = ['Name', 'Rating', 'Trips', 'Licence expiry'] as const;

export default function DriversTab() {
  const styles = useThemedStyles(makeStyles);
  const { cols, isDesktop, isPhone } = useResponsive();
  const { drivers, today } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [duty, setDuty] = useState<(typeof DUTY_FILTERS)[number]>('All');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Name');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers
      .filter((d) => duty === 'All' || d.dutyStatus === duty)
      .filter((d) => !q || `${d.name} ${d.phone} ${d.licenseNo} ${d.assignedVehicle ?? ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (sort === 'Rating' ? b.rating - a.rating : sort === 'Trips' ? b.tripsThisMonth - a.tripsThisMonth : sort === 'Licence expiry' ? a.licenseExpiry.localeCompare(b.licenseExpiry) : a.name.localeCompare(b.name)));
  }, [drivers, duty, query, sort]);
  const paged = usePaged(rows);

  // On desktop the side panel always shows a driver (first one by default).
  const selected = drivers.find((d) => d.id === selectedId) ?? (isDesktop ? drivers[0] : undefined);

  const kpis = useMemo(
    () => ({
      onDuty: drivers.filter((d) => d.dutyStatus === 'On Duty').length,
      onTrip: drivers.filter((d) => d.dutyStatus === 'On Trip').length,
      payroll: drivers.reduce((s, d) => s + d.monthlySalary, 0),
      commission: drivers.reduce((s, d) => s + (d.tripRevenueThisMonth * d.commissionPercent) / 100, 0),
    }),
    [drivers]
  );

  const filtered = !!query.trim() || duty !== 'All';
  const reset = () => {
    setQuery('');
    setDuty('All');
  };

  const columns: Column<Driver>[] = [
    {
      key: 'name',
      label: 'Driver',
      flex: 1.8,
      minWidth: 200,
      render: (d) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={d.name} bg={d.avatarBg} size={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {d.name}
            </Text>
            <Text style={styles.sub}>{d.phone}</Text>
          </View>
        </View>
      ),
    },
    {
      key: 'licence',
      label: 'Licence',
      flex: 1.7,
      minWidth: 190,
      render: (d) => {
        const ls = licenceState(d.licenseExpiry, today);
        return (
          <View style={{ gap: 3 }}>
            <Text style={styles.cellText}>{d.licenseNo}</Text>
            <Text style={styles.sub}>
              {d.licenseState} · exp {formatDate(d.licenseExpiry)}
            </Text>
            {ls.tone !== 'success' ? <Badge label={ls.label} tone={ls.tone} /> : null}
          </View>
        );
      },
    },
    { key: 'duty', label: 'Duty', flex: 1, minWidth: 110, render: (d) => <StatusBadge status={d.dutyStatus} /> },
    { key: 'rating', label: 'Rating', flex: 0.7, minWidth: 80, align: 'center', value: (d) => d.rating.toFixed(1) },
    { key: 'trips', label: 'Trips (Sep)', flex: 0.8, minWidth: 100, align: 'right', value: (d) => d.tripsThisMonth },
  ];

  const empty = (
    <EmptyState
      compact
      title={drivers.length ? 'No matching drivers' : 'No drivers yet'}
      message={drivers.length ? 'Nothing matches these filters.' : 'Driver profiles will appear here.'}
      icon={(c) => <Users size={22} color={c} />}
      action={filtered ? <Button label="Clear filters" variant="outline" size="sm" onPress={reset} /> : undefined}
    />
  );

  const list = (
    <Section title="Drivers" subtitle={`${rows.length} chauffeurs · tap a driver for details`}>
      <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Name, phone, licence or vehicle" />}>
        <FilterGroup label="Duty">
          <SegmentedControl options={DUTY_FILTERS} value={duty} onChange={setDuty} />
        </FilterGroup>
        <FilterGroup label="Sort by">
          <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
        </FilterGroup>
        <CsvButton
          data={() => ({
            filename: 'keygo-drivers.csv',
            headers: ['Name', 'Phone', 'Licence', 'State', 'Licence expiry', 'Duty', 'Vehicle', 'Rating', 'Trips (Sep)'],
            rows: rows.map((d) => [d.name, d.phone, d.licenseNo, d.licenseState, d.licenseExpiry, d.dutyStatus, d.assignedVehicle ?? '', d.rating, d.tripsThisMonth]),
          })}
        />
        {filtered ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
      </ListToolbar>
      {isPhone ? (
        rows.length === 0 ? (
          <Card>{empty}</Card>
        ) : (
          <View style={{ gap: 10 }}>
            {paged.pageRows.map((d) => (
              <DriverCard key={d.id} driver={d} today={today} onPress={() => setSelectedId(d.id)} />
            ))}
          </View>
        )
      ) : (
        <DataTable columns={columns} rows={paged.pageRows} rowKey={(d) => d.id} onRowPress={(d) => setSelectedId(d.id)} empty={empty} />
      )}
      <Pager paged={paged} />
    </Section>
  );

  const detail = selected ? <DriverDetail key={selected.id} driver={selected} onAssign={() => setAssignFor(selected.id)} /> : null;

  return (
    <View>
      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 8 }}>
        <StatTile label="Drivers" value={drivers.length} hint="On the roster" icon={(c) => <Users size={16} color={c} />} />
        <StatTile label="On duty" value={kpis.onDuty} hint="Available for assignment" tone="success" icon={(c) => <UserCheck size={16} color={c} />} />
        <StatTile label="On trip" value={kpis.onTrip} hint="Currently driving" tone="violet" icon={(c) => <Navigation size={16} color={c} />} />
        <StatTile label="Monthly payroll" value={formatINRCompact(kpis.payroll)} hint={`+ ${formatINRCompact(kpis.commission)} commission (estimate)`} emphasis icon={(c) => <IndianRupee size={16} color={c} />} />
      </Grid>

      {isDesktop ? <SplitView main={list} side={<View style={{ marginTop: 24 }}>{detail}</View>} sideWidth={400} /> : list}

      <FormSheet visible={!isDesktop && !!selectedId && !assignFor} title={selected ? selected.name : 'Driver'} onClose={() => setSelectedId(null)}>
        {detail}
      </FormSheet>

      {assignFor ? <AssignDriverSheet driverId={assignFor} onClose={() => setAssignFor(null)} /> : null}
    </View>
  );
}

function DriverCard({ driver: d, today, onPress }: { driver: Driver; today: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const ls = licenceState(d.licenseExpiry, today);
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={d.name} bg={d.avatarBg} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{d.name}</Text>
          <Text style={styles.sub}>{d.phone}</Text>
        </View>
        <StatusBadge status={d.dutyStatus} />
      </View>
      <Divider />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Text style={styles.sub}>
          {d.licenseNo} · {d.licenseState} · exp {formatDate(d.licenseExpiry)}
        </Text>
        {ls.tone !== 'success' ? <Badge label={ls.label} tone={ls.tone} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Star size={13} color={colors.warmText} />
          <Text style={styles.cellText}>{d.rating.toFixed(1)}</Text>
        </View>
        <Text style={styles.cellText}>{d.tripsThisMonth} trips this month</Text>
      </View>
    </Card>
  );
}

function DriverDetail({ driver: d, onAssign }: { driver: Driver; onAssign: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { today, updateDriver, showToast } = useApp();
  const [pctText, setPctText] = useState(String(d.commissionPercent));
  const [pendingDuty, setPendingDuty] = useState<Driver['dutyStatus'] | null>(null);

  const pct = Number(pctText);
  const pctError = pctText.trim() === '' || Number.isNaN(pct) ? 'Enter a number' : pct < 0 || pct > 100 ? 'Must be between 0 and 100' : undefined;
  const estimate = pctError ? 0 : (d.tripRevenueThisMonth * pct) / 100;
  const ls = licenceState(d.licenseExpiry, today);

  const saveCommission = () => {
    if (pctError) return;
    updateDriver(d.id, { commissionPercent: pct });
    showToast(`Commission for ${d.name} set to ${pct}%`);
  };

  const applyDuty = () => {
    if (!pendingDuty) return;
    updateDriver(d.id, { dutyStatus: pendingDuty });
    showToast(`${d.name} is now ${pendingDuty}`);
    setPendingDuty(null);
  };

  const uploadDoc = (docId: string, name: string) => {
    updateDriver(d.id, {
      documents: d.documents.map((doc) => (doc.id === docId ? { ...doc, status: 'Pending', uploadedAt: today } : doc)),
    });
    showToast(`${name} uploaded (simulated) · pending verification`);
  };

  return (
    <View style={{ gap: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={d.name} bg={d.avatarBg} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>{d.name}</Text>
            <Text style={styles.sub}>
              {d.phone} · joined {formatDate(d.joinedOn)}
            </Text>
          </View>
          <StatusBadge status={d.dutyStatus} />
        </View>
        <Divider />
        <Text style={styles.label}>Duty status</Text>
        <SegmentedControl options={DUTY_OPTIONS} value={d.dutyStatus} onChange={(s) => (s === d.dutyStatus ? undefined : setPendingDuty(s))} />
        <View style={{ marginTop: 14 }}>
          <KeyValueGrid
            cols={2}
            items={[
              { label: 'Rating', value: `${d.rating.toFixed(1)} / 5` },
              { label: 'Trips this month', value: String(d.tripsThisMonth) },
              { label: 'Assigned vehicle', value: d.assignedVehicle ?? 'None' },
              { label: 'Trip revenue (Sep)', value: formatINR(d.tripRevenueThisMonth) },
            ]}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Licence</Text>
        <View style={{ marginTop: 10 }}>
          <KeyValueGrid
            cols={2}
            items={[
              { label: 'Licence no.', value: d.licenseNo },
              { label: 'State', value: d.licenseState },
              { label: 'Expiry', value: formatDate(d.licenseExpiry) },
              { label: 'Status', value: <Badge label={ls.label} tone={ls.tone} /> },
            ]}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Documents</Text>
        <Text style={styles.sub}>Uploads are simulated and nothing leaves the device.</Text>
        <View style={{ marginTop: 8, gap: 8 }}>
          {d.documents.length === 0 ? (
            <EmptyState compact title="No documents" message="Upload licence, ID and police verification." />
          ) : (
            d.documents.map((doc) => (
              <DocumentSlot key={doc.id} title={doc.name} subtitle={doc.uploadedAt ? `Uploaded ${formatDate(doc.uploadedAt)}` : doc.kind} status={doc.status} onUpload={() => uploadDoc(doc.id, doc.name)} />
            ))
          )}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.cardTitle, { flex: 1 }]}>Assignments</Text>
          <Button label="Assign to booking" size="sm" icon={(c) => <Link2 size={14} color={c} />} onPress={onAssign} />
        </View>
        <View style={{ marginTop: 6 }}>
          {d.assignments.length === 0 ? (
            <EmptyState compact title="No assignments" message="Assign this driver to a confirmed booking." icon={(c) => <Car size={22} color={c} />} />
          ) : (
            d.assignments
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((a) => (
                <ListRow
                  key={a.id}
                  title={`${a.bookingId} · ${a.vehicleNumber}`}
                  subtitle={formatDate(a.date)}
                  right={<StatusBadge status={a.status} />}
                  onPress={() => router.push(`/bookings/${encodeURIComponent(a.bookingId)}`)}
                />
              ))
          )}
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Salary & commission</Text>
        <View style={{ marginTop: 10 }}>
          <KeyValueGrid
            cols={2}
            items={[
              { label: 'Monthly salary', value: formatINR(d.monthlySalary) },
              { label: 'Trip revenue (Sep)', value: formatINR(d.tripRevenueThisMonth) },
            ]}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Commission %" value={pctText} onChangeText={setPctText} keyboardType="decimal-pad" error={pctError} hint="Configurable per driver (0–100)" right={<Text style={styles.sub}>%</Text>} />
          </View>
          <Button label="Save" size="md" variant="outline" disabled={!!pctError || pct === d.commissionPercent} onPress={saveCommission} style={{ marginTop: 22 }} />
        </View>
        <View style={[styles.estimate, { backgroundColor: colors.highlightSoft }]}>
          <Text style={styles.sub}>Commission this month (estimate)</Text>
          <Text style={styles.estimateValue}>{formatINR(estimate)}</Text>
          <Text style={styles.sub}>
            {formatINR(d.tripRevenueThisMonth)} trip revenue × {pctError ? '—' : `${pct}%`} · payout rules pending confirmation
          </Text>
        </View>
      </Card>

      <ConfirmDialog
        visible={!!pendingDuty}
        title={`Mark ${d.name} as ${pendingDuty ?? ''}?`}
        message={`Duty status changes from ${d.dutyStatus} to ${pendingDuty ?? ''}. This affects who can be picked for new assignments.`}
        confirmLabel="Change status"
        onConfirm={applyDuty}
        onCancel={() => setPendingDuty(null)}
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
    detailName: {
      color: colors.txt,
      fontSize: 17,
      fontWeight: '800',
    },
    sub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 1,
    },
    cellText: {
      color: colors.txt,
      fontSize: 13,
    },
    label: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    cardTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    estimate: {
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
    },
    estimateValue: {
      color: colors.onHighlight,
      fontSize: 20,
      fontWeight: '800',
      marginVertical: 2,
    },
  });
