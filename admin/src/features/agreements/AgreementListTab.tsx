import { useRouter } from '@/shims/expo-router';
import { FileCheck, FileClock, FileSignature, IndianRupee, ShieldCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, Column, DataTable, EmptyState, Grid, Section, SegmentedControl, StatTile, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useThemedStyles, type ThemeColors } from '../../theme';
import type { Agreement, Booking } from '../../types';
import { FilterGroup, ListToolbar, Pager, usePaged } from './listTools';

const STATUS_FILTERS = ['All', 'Active', 'Draft', 'Closed'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const SORTS = ['Newest', 'Oldest', 'Rental high to low', 'Customer A-Z'] as const;
type Sort = (typeof SORTS)[number];

interface AgreementRow {
  agreement: Agreement;
  booking?: Booking;
  finesTotal: number;
}

function AwaitingRow({ booking: b, onPrepare, last }: { booking: Booking; onPrepare: () => void; last: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { isPhone } = useResponsive();
  return (
    <View style={[styles.awaitRow, isPhone && { flexDirection: 'column', alignItems: 'stretch' }, last && { borderBottomWidth: 0 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={styles.strong}>{b.id}</Text>
          <Badge label={`Pickup ${formatDate(b.pickupDate, false)} · ${b.pickupTime}`} tone="highlight" />
        </View>
        <Text style={styles.sub} numberOfLines={2}>
          {b.customerName} · {b.vehicleName} ({b.vehicleNumber}) · {formatINR(b.totalAmount)}
        </Text>
      </View>
      <Button label="Prepare agreement" size="sm" icon={(c) => <FileSignature size={14} color={c} />} onPress={onPrepare} />
    </View>
  );
}

function AgreementCard({ row, onPress }: { row: AgreementRow; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { agreement: a, booking: b } = row;
  return (
    <Card onPress={onPress} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle}>{a.id}</Text>
          <Text style={styles.sub}>
            Booking {a.bookingId} · signed {formatDate(a.signedDate)}
          </Text>
        </View>
        <StatusBadge status={a.status} />
      </View>
      <View>
        <Text style={styles.strong}>{a.customerName}</Text>
        <Text style={styles.sub}>
          {b?.vehicleName ? `${b.vehicleName} · ` : ''}
          {a.vehicleNumber}
        </Text>
      </View>
      <View style={styles.moneyRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kvLabel}>Rental</Text>
          <Text style={styles.strong}>{formatINR(a.rentalAmount)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kvLabel}>Deposit</Text>
          <Text style={styles.strong}>{formatINR(a.securityDeposit)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kvLabel}>Discount</Text>
          <Text style={styles.strong}>{a.discount ? formatINR(a.discount) : '—'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Badge label={a.depositTermsAccepted ? 'Deposit terms accepted' : 'Deposit terms pending'} tone={a.depositTermsAccepted ? 'success' : 'warning'} />
        <Badge
          label={a.fines.length ? `${a.fines.length} fine${a.fines.length > 1 ? 's' : ''} · ${formatINR(row.finesTotal)}` : 'No fines'}
          tone={a.fines.length ? 'danger' : 'neutral'}
        />
      </View>
      <Text style={styles.sub} numberOfLines={1}>
        Signature: {a.signaturePreview || 'Not signed'}
      </Text>
    </Card>
  );
}

export default function AgreementListTab() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isDesktop, cols, isPhone } = useResponsive();
  const { agreements, bookings } = useApp();

  const [status, setStatus] = useState<StatusFilter>('All');
  const [sort, setSort] = useState<Sort>('Newest');
  const [query, setQuery] = useState('');

  const rows: AgreementRow[] = useMemo(
    () =>
      agreements.map((a) => ({
        agreement: a,
        booking: bookings.find((b) => b.id === a.bookingId),
        finesTotal: a.fines.reduce((s, f) => s + f.amount, 0),
      })),
    [agreements, bookings]
  );

  const awaiting = useMemo(
    () => bookings.filter((b) => b.status === 'Confirmed' && !b.agreementId).sort((x, y) => x.pickupDate.localeCompare(y.pickupDate)),
    [bookings]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(
      ({ agreement: a, booking: b }) =>
        (status === 'All' || a.status === status) &&
        (!q || [a.id, a.bookingId, a.customerName, a.vehicleNumber, b?.vehicleName ?? ''].some((s) => s.toLowerCase().includes(q)))
    );
    return [...out].sort((x, y) => {
      const a = x.agreement;
      const b = y.agreement;
      if (sort === 'Oldest') return a.signedDate.localeCompare(b.signedDate);
      if (sort === 'Rental high to low') return b.rentalAmount - a.rentalAmount;
      if (sort === 'Customer A-Z') return a.customerName.localeCompare(b.customerName);
      return b.signedDate.localeCompare(a.signedDate);
    });
  }, [rows, status, query, sort]);

  const paged = usePaged(filtered, `${status}|${sort}|${query}`);

  const counts = useMemo(
    () => ({
      active: agreements.filter((a) => a.status === 'Active').length,
      draft: agreements.filter((a) => a.status === 'Draft').length,
      closed: agreements.filter((a) => a.status === 'Closed').length,
      depositsHeld: agreements.filter((a) => a.status === 'Active').reduce((s, a) => s + a.securityDeposit, 0),
    }),
    [agreements]
  );

  const filtersActive = status !== 'All' || !!query || sort !== 'Newest';
  const reset = () => {
    setStatus('All');
    setSort('Newest');
    setQuery('');
  };
  const openDetails = (id: string) => router.push(`/agreements?tab=agreement-details&id=${encodeURIComponent(id)}`);
  const prepare = (bookingId: string) => router.push(`/bookings/${encodeURIComponent(bookingId)}/agreement`);

  const columns: Column<AgreementRow>[] = [
    { key: 'id', label: 'Agreement', flex: 1.1, minWidth: 110, render: (r) => <Text style={styles.strong}>{r.agreement.id}</Text> },
    { key: 'booking', label: 'Booking', flex: 0.8, minWidth: 80, value: (r) => r.agreement.bookingId },
    {
      key: 'customer',
      label: 'Customer',
      flex: 1.4,
      minWidth: 130,
      render: ({ agreement: a }) => (
        <View>
          <Text style={styles.strong} numberOfLines={1}>
            {a.customerName}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {a.signaturePreview ? 'Digitally signed' : 'Not signed'}
          </Text>
        </View>
      ),
    },
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.3,
      minWidth: 120,
      render: ({ agreement: a, booking: b }) => (
        <View>
          <Text style={styles.strong} numberOfLines={1}>
            {b?.vehicleName ?? a.vehicleNumber}
          </Text>
          {b ? <Text style={styles.sub}>{a.vehicleNumber}</Text> : null}
        </View>
      ),
    },
    { key: 'signed', label: 'Signed', flex: 0.9, minWidth: 90, value: (r) => formatDate(r.agreement.signedDate) },
    { key: 'rental', label: 'Rental', flex: 0.9, minWidth: 90, align: 'right', value: (r) => formatINR(r.agreement.rentalAmount) },
    {
      key: 'deposit',
      label: 'Deposit',
      flex: 0.9,
      minWidth: 90,
      align: 'right',
      render: ({ agreement: a }) => (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.strong}>{formatINR(a.securityDeposit)}</Text>
          <Text style={styles.sub}>{a.depositTermsAccepted ? 'Terms accepted' : 'Terms pending'}</Text>
        </View>
      ),
    },
    { key: 'discount', label: 'Discount', flex: 0.8, minWidth: 80, align: 'right', value: (r) => (r.agreement.discount ? formatINR(r.agreement.discount) : '—') },
    {
      key: 'fines',
      label: 'Fines',
      flex: 0.8,
      minWidth: 80,
      render: (r) =>
        r.agreement.fines.length ? <Badge label={`${r.agreement.fines.length} · ${formatINRCompact(r.finesTotal)}`} tone="danger" /> : <Text style={styles.sub}>None</Text>,
    },
    { key: 'status', label: 'Status', flex: 0.8, minWidth: 80, render: (r) => <StatusBadge status={r.agreement.status} /> },
  ];

  const empty = (
    <EmptyState
      title={agreements.length === 0 ? 'No agreements yet' : 'No agreements match'}
      message={agreements.length === 0 ? 'Agreements are created from confirmed bookings.' : 'Try another search or clear the filters.'}
      icon={(c) => <FileCheck size={22} color={c} />}
      action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
    />
  );

  return (
    <View>
      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Active agreements" value={counts.active} hint="Vehicles out on contract" emphasis icon={(c) => <FileCheck size={16} color={c} />} />
        <StatTile label="Awaiting agreement" value={awaiting.length} hint="Confirmed bookings" tone="highlight" icon={(c) => <FileClock size={16} color={c} />} />
        <StatTile label="Deposits held" value={formatINRCompact(counts.depositsHeld)} hint="On active agreements" tone="info" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Closed" value={counts.closed} hint={`${counts.draft} in draft`} tone="neutral" icon={(c) => <ShieldCheck size={16} color={c} />} />
      </Grid>

      <Section title="Bookings awaiting agreement" subtitle="Confirmed bookings that need a signed agreement before pickup">
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {awaiting.length === 0 ? (
            <EmptyState compact title="All caught up" message="Every confirmed booking has an agreement." icon={(c) => <FileCheck size={22} color={c} />} />
          ) : (
            awaiting.map((b, i) => <AwaitingRow key={b.id} booking={b} last={i === awaiting.length - 1} onPrepare={() => prepare(b.id)} />)
          )}
        </Card>
      </Section>

      <Section title="Agreements" subtitle="Tap an agreement to open its details, e-signature and PDF">
        <ListToolbar query={query} onQuery={setQuery} placeholder="Agreement, booking, customer or vehicle" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Status">
            <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        {isDesktop ? (
          <DataTable columns={columns} rows={paged.pageRows} rowKey={(r) => r.agreement.id} onRowPress={(r) => openDetails(r.agreement.id)} empty={empty} />
        ) : filtered.length === 0 ? (
          <Card>{empty}</Card>
        ) : (
          <Grid cols={cols(1, 2, 2)}>
            {paged.pageRows.map((r) => (
              <AgreementCard key={r.agreement.id} row={r} onPress={() => openDetails(r.agreement.id)} />
            ))}
          </Grid>
        )}
        <Pager paged={paged} />
      </Section>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strong: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    sub: { color: colors.muted, fontSize: 11, marginTop: 2 },
    cardTitle: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    kvLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 2 },
    moneyRow: { flexDirection: 'row', gap: 10, backgroundColor: colors.bg, borderRadius: 12, padding: 10 },
    awaitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
  });
