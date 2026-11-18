import { useRouter } from '@/shims/expo-router';
import { IdCard, RotateCcw, ScanFace, Search, ShieldCheck, TriangleAlert, UserPlus, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Badge, Button, Card, ChipGroup, Column, DataTable, EmptyState, Field, Grid, PageHeader, Screen, Section, StatTile, StatusBadge } from '../../components/kit';
import { findSection } from '../../config/navigation';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Booking, Customer } from '../../types';
import { ListPager, usePaged } from '../fleet/ListPager';
import { CustomerForm } from './CustomerForm';
import { KYC_FILTERS, KycFilter, kycState, licenceState, makeStyles, maskLicence, statusToneFor, TIER_TONE } from './shared';

const TIER_FILTERS = ['All', 'Bronze', 'Silver', 'Gold', 'VIP'] as const;
type TierFilter = (typeof TIER_FILTERS)[number];
const SORT_KEYS = ['Name', 'Newest', 'Spend', 'Bookings'] as const;
type SortKey = (typeof SORT_KEYS)[number];

const countsTowardSpend = (b: Booking) => b.status === 'Active' || b.status === 'Completed' || b.status === 'Confirmed';

interface CustomerRow {
  customer: Customer;
  bookings: number;
  spent: number;
  kyc: Exclude<KycFilter, 'All'>;
  licence: ReturnType<typeof licenceState>;
}

const SORTERS: Record<SortKey, (a: CustomerRow, b: CustomerRow) => number> = {
  Name: (a, b) => a.customer.name.localeCompare(b.customer.name),
  Newest: (a, b) => b.customer.customerSince.localeCompare(a.customer.customerSince),
  Spend: (a, b) => b.spent - a.spent,
  Bookings: (a, b) => b.bookings - a.bookings,
};

function LicenceCell({ row, compact }: { row: CustomerRow; compact?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const c = row.customer;
  return (
    <View>
      <Text style={styles.cellStrong} numberOfLines={1}>
        {maskLicence(c.dlNumber)}
      </Text>
      <Text style={styles.cellSub} numberOfLines={1}>
        {c.dlState || '—'} · exp {c.dlExpiry ? formatDate(c.dlExpiry, !compact) : '—'}
      </Text>
      {row.licence === 'Expired' || row.licence === 'Expiring' ? (
        <View style={{ marginTop: 4 }}>
          <Badge label={row.licence === 'Expired' ? 'Licence expired' : 'Expires soon'} tone={row.licence === 'Expired' ? 'danger' : 'warning'} />
        </View>
      ) : null}
    </View>
  );
}

function CustomerCard({ row, onPress }: { row: CustomerRow; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const c = row.customer;
  return (
    <Card onPress={onPress} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={c.name} bg={c.avatarBg} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.cellSub} numberOfLines={1}>
            {c.phone} · {c.city || '—'}
          </Text>
        </View>
        <Badge label={c.loyaltyTier} tone={TIER_TONE[c.loyaltyTier]} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Badge label={`ID ${c.idCardStatus.toLowerCase()}`} tone={statusToneFor(c.idCardStatus)} />
        <Badge label={`Face ${c.faceVerification.toLowerCase()}`} tone={statusToneFor(c.faceVerification)} />
      </View>
      <View style={styles.cardFoot}>
        <View style={{ flex: 1.4, minWidth: 0 }}>
          <Text style={styles.kvLabel}>Driving licence</Text>
          <LicenceCell row={row} />
        </View>
        <View style={{ flex: 0.6 }}>
          <Text style={styles.kvLabel}>Bookings</Text>
          <Text style={styles.cellStrong}>{row.bookings}</Text>
        </View>
        <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
          <Text style={styles.kvLabel}>Spent</Text>
          <Text style={styles.cellStrong}>{formatINR(row.spent)}</Text>
        </View>
      </View>
    </Card>
  );
}

/** `openCreate` is set by the /customers/new link, which opens the list with the create form on top. */
export default function CustomersScreen({ openCreate }: { openCreate?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isDesktop, cols } = useResponsive();
  const { customers, bookings, today } = useApp();
  const section = findSection('customers')!;

  const [query, setQuery] = useState('');
  const [kyc, setKyc] = useState<KycFilter>('All');
  const [tier, setTier] = useState<TierFilter>('All');
  const [city, setCity] = useState('All');
  const [sort, setSort] = useState<SortKey>('Name');
  const [creating, setCreating] = useState(!!openCreate);

  const rows: CustomerRow[] = useMemo(
    () =>
      customers.map((c) => {
        const own = bookings.filter((b) => b.customerId === c.id);
        return {
          customer: c,
          bookings: own.length,
          spent: own.filter(countsTowardSpend).reduce((s, b) => s + b.totalAmount, 0),
          kyc: kycState(c),
          licence: licenceState(c.dlExpiry, today),
        };
      }),
    [customers, bookings, today]
  );

  const cities = useMemo(() => ['All', ...Array.from(new Set(customers.map((c) => c.city).filter(Boolean))).sort()], [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return rows
      .filter(({ customer: c, kyc: k }) => {
        if (kyc !== 'All' && k !== kyc) return false;
        if (tier !== 'All' && c.loyaltyTier !== tier) return false;
        if (city !== 'All' && c.city !== city) return false;
        if (!q) return true;
        return (
          [c.name, c.email, c.dlNumber, c.customerCode, c.city].some((s) => s.toLowerCase().includes(q)) ||
          (qDigits.length >= 3 && c.phone.replace(/\D/g, '').includes(qDigits))
        );
      })
      .sort(SORTERS[sort]);
  }, [rows, query, kyc, tier, city, sort]);
  const paged = usePaged(filtered);

  const stats = useMemo(
    () => ({
      verified: rows.filter((r) => r.kyc === 'Verified').length,
      pending: rows.filter((r) => r.kyc === 'Pending' || r.kyc === 'Incomplete').length,
      licenceIssues: rows.filter((r) => r.licence === 'Expired' || r.licence === 'Expiring').length,
      spend: rows.reduce((s, r) => s + r.spent, 0),
    }),
    [rows]
  );

  const filtersActive = !!query || kyc !== 'All' || tier !== 'All' || city !== 'All';
  const reset = () => {
    setQuery('');
    setKyc('All');
    setTier('All');
    setCity('All');
  };
  const open = (r: CustomerRow) => router.push(`/customers/${encodeURIComponent(r.customer.id)}` as any);
  const addNew = () => setCreating(true);
  const closeCreate = () => {
    setCreating(false);
    if (openCreate) router.replace('/customers' as any);
  };

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      label: 'Customer',
      flex: 2,
      minWidth: 180,
      render: ({ customer: c }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={c.name} bg={c.avatarBg} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cellStrong} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.cellSub} numberOfLines={1}>
              {c.email || c.customerCode}
            </Text>
          </View>
        </View>
      ),
    },
    { key: 'phone', label: 'Phone', flex: 1.2, minWidth: 120, value: (r) => r.customer.phone },
    { key: 'city', label: 'City', flex: 0.9, minWidth: 90, value: (r) => r.customer.city || '—' },
    { key: 'dl', label: 'Driving licence', flex: 1.7, minWidth: 170, render: (r) => <LicenceCell row={r} compact /> },
    { key: 'id', label: 'ID card', flex: 1, minWidth: 95, render: (r) => <StatusBadge status={r.customer.idCardStatus} /> },
    { key: 'face', label: 'Face match', flex: 1, minWidth: 95, render: (r) => <StatusBadge status={r.customer.faceVerification} /> },
    { key: 'bookings', label: 'Bookings', flex: 0.7, minWidth: 70, align: 'right', value: (r) => r.bookings },
    { key: 'spent', label: 'Spent', flex: 0.9, minWidth: 90, align: 'right', value: (r) => formatINR(r.spent) },
    { key: 'tier', label: 'Tier', flex: 0.7, minWidth: 70, render: (r) => <Badge label={r.customer.loyaltyTier} tone={TIER_TONE[r.customer.loyaltyTier]} /> },
  ];

  const empty = (
    <EmptyState
      title={customers.length === 0 ? 'No customers yet' : 'No customers match'}
      message={customers.length === 0 ? 'Add your first customer profile.' : 'Try another search or clear the filters.'}
      icon={(c) => <Users size={22} color={c} />}
      action={
        filtersActive ? (
          <Button label="Reset filters" variant="outline" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} />
        ) : (
          <Button label="Add customer" size="sm" icon={(c) => <UserPlus size={14} color={c} />} onPress={addNew} />
        )
      }
    />
  );

  return (
    <Screen>
      <PageHeader title={section.title} subtitle={section.description} actions={<Button label="Add customer" icon={(c) => <UserPlus size={16} color={c} />} onPress={addNew} />} />

      <Grid cols={cols(2, 4, 4)} style={{ marginTop: 12 }}>
        <StatTile label="Customers" value={customers.length} hint={`${cities.length - 1} cities`} emphasis icon={(c) => <Users size={16} color={c} />} />
        <StatTile label="KYC verified" value={stats.verified} hint="ID card + face match" tone="success" icon={(c) => <ShieldCheck size={16} color={c} />} />
        <StatTile label="KYC to review" value={stats.pending} hint="Pending or incomplete" tone="warning" icon={(c) => <ScanFace size={16} color={c} />} />
        <StatTile label="Licence alerts" value={stats.licenceIssues} hint="Expired or expiring in 60 days" tone="danger" icon={(c) => <TriangleAlert size={16} color={c} />} />
      </Grid>

      <Card style={{ marginTop: 8, gap: 12 }}>
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Name, phone, email, licence or customer code"
          left={<Search size={16} color={colors.muted} />}
          style={{ marginBottom: 0 }}
        />
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
          <View style={isDesktop ? { flex: 1 } : undefined}>
            <Text style={styles.filterLabel}>KYC status</Text>
            <ChipGroup options={KYC_FILTERS} value={kyc} onChange={setKyc} scroll />
          </View>
          <View style={isDesktop ? { flex: 0.8 } : undefined}>
            <Text style={styles.filterLabel}>Loyalty tier</Text>
            <ChipGroup options={TIER_FILTERS} value={tier} onChange={setTier} scroll />
          </View>
        </View>
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
          <View style={isDesktop ? { flex: 1 } : undefined}>
            <Text style={styles.filterLabel}>City</Text>
            <ChipGroup options={cities} value={city} onChange={setCity} scroll />
          </View>
          <View style={isDesktop ? { flex: 0.8 } : undefined}>
            <Text style={styles.filterLabel}>Sort by</Text>
            <ChipGroup options={SORT_KEYS} value={sort} onChange={setSort} scroll />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.cellSub}>
            Showing {filtered.length} of {customers.length} customers · lifetime spend {formatINRCompact(stats.spend)}
          </Text>
          {filtersActive ? <Button label="Reset" variant="ghost" size="sm" icon={(c) => <RotateCcw size={14} color={c} />} onPress={reset} /> : null}
        </View>
      </Card>

      <Section title="Customer directory" subtitle="Open a profile to edit details, verify KYC and view history">
        {isDesktop ? (
          <DataTable columns={columns} rows={paged.rows} rowKey={(r) => r.customer.id} onRowPress={open} empty={empty} />
        ) : filtered.length === 0 ? (
          <Card>{empty}</Card>
        ) : (
          <Grid cols={cols(1, 2, 2)}>
            {paged.rows.map((r) => (
              <CustomerCard key={r.customer.id} row={r} onPress={() => open(r)} />
            ))}
          </Grid>
        )}
        <ListPager paged={paged} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <IdCard size={14} color={colors.muted} />
          <Text style={styles.cellSub}>Spend counts confirmed, active and completed bookings. Licence numbers are masked in this list.</Text>
        </View>
      </Section>

      {creating ? <CustomerForm onClose={closeCreate} onSaved={(id) => router.replace(`/customers/${encodeURIComponent(id)}` as any)} /> : null}
    </Screen>
  );
}
