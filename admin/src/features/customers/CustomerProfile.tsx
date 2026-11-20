import { useRouter } from '@/shims/expo-router';
import { KeyRound, Pencil, Star, UserRound, Users } from 'lucide-react-native';
import { useRouter as useNextRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, Badge, Button, Card, Divider, EmptyState, Field, FormSheet, KeyValueGrid, PageHeader, PageTabs, Screen, SplitView, StatusBadge } from '../../components/kit';
import { useStaffSession } from '../../components/portal/PortalShell';
import { api } from '../../lib/api';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { formatDate, formatINR } from '../../lib/format';
import { ActivityInput, loadCustomerActivity, logCustomerActivity, readCustomerActivity } from '../../services/customers';
import { useResource } from '../../services/mockClient';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Customer } from '../../types';
import { CustomerForm } from './CustomerForm';
import CustomersScreen from './CustomersScreen';
import { kycState, licenceState, makeStyles, TIER_TONE } from './shared';
import { ActivityTab } from './tabs/ActivityTab';
import { AgreementsTab } from './tabs/AgreementsTab';
import { BookingsTab } from './tabs/BookingsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { OverviewTab } from './tabs/OverviewTab';
import { PaymentsTab } from './tabs/PaymentsTab';

const TABS = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'documents', label: 'Documents' },
  { slug: 'bookings', label: 'Bookings' },
  { slug: 'payments', label: 'Payments' },
  { slug: 'agreements', label: 'Agreements' },
  { slug: 'activity', label: 'Activity' },
] as const;
const TAB_LABELS = TABS.map((t) => t.label);

function ProfileSummary({ customer: c, stats }: { customer: Customer; stats: { trips: number; bookings: number; spend: number } }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { today } = useApp();
  const kyc = kycState(c);
  const lic = licenceState(c.dlExpiry, today);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={[styles.photoCircle, { width: 84, height: 84 }, c.photoCaptured && { borderStyle: 'solid', borderColor: colors.secondary }]}>
          {c.photoCaptured ? <Avatar name={c.name} bg={c.avatarBg} size={76} /> : <UserRound size={34} color={colors.muted} />}
        </View>
        <Text style={styles.summaryName}>{c.name}</Text>
        <Text style={styles.sub}>
          {c.phone || 'No phone yet'}
          {c.city ? ` · ${c.city}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          <Badge label={c.loyaltyTier} tone={TIER_TONE[c.loyaltyTier]} icon={(col) => <Star size={11} color={col} />} />
          <Badge label={`KYC ${kyc.toLowerCase()}`} tone={kyc === 'Verified' ? 'success' : kyc === 'Rejected' ? 'danger' : kyc === 'Pending' ? 'warning' : 'neutral'} />
          {lic === 'Expired' ? <Badge label="Licence expired" tone="danger" /> : lic === 'Expiring' ? <Badge label="Licence expiring" tone="warning" /> : null}
        </View>
      </View>
      <Divider style={{ marginVertical: 0 }} />
      <KeyValueGrid
        cols={2}
        items={[
          { label: 'Trips completed', value: String(stats.trips) },
          { label: 'Total bookings', value: String(stats.bookings) },
          { label: 'Total spend', value: formatINR(stats.spend) },
          { label: 'Loyalty points', value: c.loyaltyPoints.toLocaleString('en-IN') },
          { label: 'Customer since', value: formatDate(c.customerSince) },
          { label: 'Trust rating', value: `${c.trustRating.toFixed(1)} / 5` },
          { label: 'Customer code', value: c.customerCode || '—' },
          { label: 'Face match', value: <StatusBadge status={c.faceVerification} /> },
        ]}
      />
    </Card>
  );
}

function Profile({ id }: { id: string }) {
  const router = useRouter();
  const nextRouter = useNextRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { customers, bookings, updateCustomer, showToast } = useApp();
  const { session } = useStaffSession();
  // Matches the server: Owners (Super Admin), Admins and Managers reset customer app passwords
  const canResetPassword = !!session && ['Owner', 'Admin', 'Manager'].includes(session.role);
  const [resetting, setResetting] = useState(false);
  const customer = customers.find((c) => c.id === id);
  const activity = useResource(() => loadCustomerActivity(id));
  const [editing, setEditing] = useState(false);

  const active = TABS.find((t) => t.slug === search.get('tab')) ?? TABS[0];
  const history = useMemo(() => bookings.filter((b) => b.customerId === id), [bookings, id]);
  const stats = useMemo(
    () => ({
      trips: history.filter((b) => b.status === 'Completed').length,
      bookings: history.length,
      spend: history.filter((b) => ['Confirmed', 'Active', 'Completed'].includes(b.status)).reduce((s, b) => s + b.totalAmount, 0),
    }),
    [history]
  );

  if (!customer) {
    return (
      <Screen>
        <PageHeader title="Customer" back />
        <Card>
          <EmptyState
            title="Customer not found"
            message="This profile may have been removed, or the link is incorrect."
            icon={(c) => <Users size={22} color={c} />}
            action={<Button label="All customers" variant="outline" onPress={() => router.replace('/customers' as any)} />}
          />
        </Card>
      </Screen>
    );
  }

  const refreshActivity = () => activity.setData(readCustomerActivity(id));
  /** Applies a change made outside the edit form and records it in the audit trail. */
  const applyChange = (patch: Partial<Customer>, entries: ActivityInput[]) => {
    updateCustomer(id, patch);
    logCustomerActivity(id, entries);
    refreshActivity();
  };
  const changeTab = (label: string) => {
    const slug = TABS.find((t) => t.label === label)!.slug;
    nextRouter.replace(`${pathname}?tab=${slug}`);
  };

  const main = (
    <View>
      <PageTabs tabs={TAB_LABELS} value={active.label} onChange={changeTab} />
      {active.slug === 'overview' ? <OverviewTab customer={customer} /> : null}
      {active.slug === 'documents' ? <DocumentsTab customer={customer} /> : null}
      {active.slug === 'bookings' ? <BookingsTab customer={customer} history={history} stats={stats} /> : null}
      {active.slug === 'payments' ? <PaymentsTab history={history} /> : null}
      {active.slug === 'agreements' ? <AgreementsTab history={history} /> : null}
      {active.slug === 'activity' ? (
        activity.data ? <ActivityTab entries={activity.data} /> : <ResourceState loading={activity.loading} error={activity.error} onRetry={activity.reload} />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <PageHeader
        eyebrow="Customers"
        title={customer.name}
        subtitle={`${id} · since ${formatDate(customer.customerSince)}`}
        back
        actions={
          <>
            {canResetPassword && customer.email ? <Button label="Reset app password" variant="outline" icon={(c) => <KeyRound size={14} color={c} />} onPress={() => setResetting(true)} /> : null}
            <Button label="Edit customer" variant="outline" icon={(c) => <Pencil size={14} color={c} />} onPress={() => setEditing(true)} />
          </>
        }
      />
      <View style={{ marginTop: 16 }}>
        <SplitView main={main} side={<ProfileSummary customer={customer} stats={stats} />} sideWidth={340} />
      </View>
      {editing ? <CustomerForm customer={customer} onClose={() => setEditing(false)} onSaved={refreshActivity} /> : null}
      {resetting ? (
        <ResetPasswordSheet
          name={customer.name}
          onClose={() => setResetting(false)}
          onSave={async (password) => {
            try {
              await api(`/admin/customers/${encodeURIComponent(id)}/password`, { method: 'PUT', body: { password } });
              logCustomerActivity(id, [{ action: 'App password reset by staff (signed out on all devices)' }]);
              refreshActivity();
              showToast(`New app password set for ${customer.name}. Share it with them privately.`);
              setResetting(false);
            } catch (e) {
              showToast((e as Error).message);
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

export default function CustomerProfile() {
  const params = useParams();
  const id = decodeURIComponent(String(params?.id ?? ''));
  if (id === 'new') return <CustomersScreen openCreate />;
  return (
    <Suspense fallback={null}>
      <Profile key={id} id={id} />
    </Suspense>
  );
}

/** Staff set a new app password for a customer who forgot theirs (no email or SMS reset yet). */
function ResetPasswordSheet({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const error = password.length < 8 ? 'Use at least 8 characters' : undefined;
  return (
    <FormSheet
      visible
      title={`Reset app password: ${name}`}
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
      <Field
        label="New password"
        required
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={touched ? error : undefined}
        hint="Check the customer's identity first. Share the password privately; they can change it in the app under Profile → Privacy & Security."
      />
    </FormSheet>
  );
}
