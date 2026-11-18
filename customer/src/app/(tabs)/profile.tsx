import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  Award,
  Camera,
  CheckCircle2,
  CreditCard,
  LogOut,
  PenLine,
  Pencil,
  Plus,
  Smartphone,
  UserRound,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import {
  Screen,
  PageHeader,
  Card,
  Section,
  SplitView,
  Button,
  Badge,
  Avatar,
  ProgressBar,
  KeyValueGrid,
  DocumentSlot,
  SignaturePad,
  FormSheet,
  Field,
  FormRow,
  EmptyState,
  SimulatedNote,
  ListRow,
} from '../../components/kit';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate } from '../../lib/format';
import { signOut } from '../../services/auth';
import { Customer, VerificationStatus } from '../../types';

type DocKey = 'id' | 'dl' | 'address' | 'photo';

interface PayMethod {
  id: string;
  label: string;
  detail: string;
  isDefault: boolean;
}

export default function ProfileScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone, cols } = useResponsive();
  const {
    customers,
    currentCustomerId,
    bookings,
    loyaltyTiers,
    updateCustomer,
    showToast,
  } = useApp();

  const customer = customers.find((c) => c.id === currentCustomerId) ?? customers[0];

  // ---------- Documents (simulated status changes, local only) ----------
  const docStatusOf = (kind: Customer['documents'][number]['kind']): VerificationStatus =>
    customer.documents.find((d) => d.kind === kind)?.status ?? 'Not uploaded';
  const [docs, setDocs] = useState<Record<DocKey, VerificationStatus>>(() => ({
    id: docStatusOf('ID card'),
    dl: docStatusOf('Driving licence'),
    address: docStatusOf('Address proof'),
    photo: customer.photoCaptured ? customer.faceVerification : 'Not uploaded',
  }));
  const simulateDoc = (key: DocKey, action: 'Uploaded' | 'Scanned' | 'Captured') => {
    setDocs((prev) => ({ ...prev, [key]: 'Pending' }));
    showToast(`${action} (simulated) · pending verification`);
  };
  const verifiedCount = Object.values(docs).filter((s) => s === 'Verified').length;

  // ---------- Signature (local only) ----------
  const [signature, setSignature] = useState('');
  const [sigDraft, setSigDraft] = useState('');
  const [sigOpen, setSigOpen] = useState(false);

  // ---------- Edit details ----------
  const [editOpen, setEditOpen] = useState(false);

  // ---------- Payment methods (placeholder, local only) ----------
  const [methods, setMethods] = useState<PayMethod[]>([
    { id: 'pm-1', label: 'UPI', detail: `${customer.firstName.toLowerCase()}@okhdfcbank`, isDefault: true },
    { id: 'pm-2', label: 'Visa card', detail: '•••• 4242 · expires 08/29', isDefault: false },
  ]);

  // ---------- Loyalty ----------
  const completedTrips = bookings.filter((b) => b.customerId === customer.id && b.status === 'Completed').length;
  const tierIndex = loyaltyTiers.findIndex((t) => t.tier === customer.loyaltyTier);
  const currentTier = loyaltyTiers[tierIndex];
  const nextTier = tierIndex >= 0 ? loyaltyTiers[tierIndex + 1] : undefined;
  const tierProgress = nextTier ? Math.min(1, completedTrips / nextTier.minTrips) : 1;

  const main = (
    <View>
      {/* Documents */}
      <Section
        title="Documents"
        subtitle={`${verifiedCount} of 4 verified · needed before pickup`}
        style={{ marginTop: 0 }}>
        <Card>
          <DocumentSlot
            title="ID card (Aadhaar)"
            subtitle={`No. ${customer.aadhaarNo}`}
            status={docs.id}
            onUpload={() => simulateDoc('id', 'Uploaded')}
            onScan={() => simulateDoc('id', 'Scanned')}
          />
          <DocumentSlot
            title="Driving licence"
            subtitle={`${customer.dlNumber} · ${customer.dlState} · valid till ${formatDate(customer.dlExpiry)}`}
            status={docs.dl}
            onUpload={() => simulateDoc('dl', 'Uploaded')}
            onScan={() => simulateDoc('dl', 'Scanned')}
          />
          <DocumentSlot
            title="Address proof"
            subtitle="Utility bill, rent agreement or passport"
            status={docs.address}
            onUpload={() => simulateDoc('address', 'Uploaded')}
            onScan={() => simulateDoc('address', 'Scanned')}
          />
          <View style={styles.photoRow}>
            <View style={[styles.photoCircle, docs.photo !== 'Not uploaded' && { borderStyle: 'solid', borderColor: colors.secondary }]}>
              {docs.photo === 'Not uploaded' ? <Camera size={22} color={colors.muted} /> : <UserRound size={26} color={colors.secondaryText} />}
            </View>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={styles.docTitle}>Customer photo</Text>
              <Text style={styles.muted}>Used for face match at pickup</Text>
              <View style={{ marginTop: 6 }}>
                <Badge label={docs.photo} tone={docs.photo === 'Verified' ? 'success' : docs.photo === 'Pending' ? 'warning' : 'neutral'} />
              </View>
            </View>
            <Button
              label={docs.photo === 'Not uploaded' ? 'Capture photo' : 'Retake'}
              size="sm"
              variant="outline"
              onPress={() => simulateDoc('photo', 'Captured')}
              icon={(c) => <Camera size={14} color={c} />}
            />
          </View>
          <SimulatedNote>Uploads, scans and camera capture are placeholders — no files leave your device in this preview.</SimulatedNote>
        </Card>
      </Section>

      {/* Personal details */}
      <Section
        title="Personal details"
        action={<Button label="Edit" size="sm" variant="outline" onPress={() => setEditOpen(true)} icon={(c) => <Pencil size={14} color={c} />} />}>
        <Card>
          <KeyValueGrid
            cols={cols(1, 2, 2)}
            items={[
              { label: 'Full name', value: customer.name },
              { label: 'Date of birth', value: formatDate(customer.dob) },
              { label: 'Phone', value: customer.phone },
              { label: 'Email', value: customer.email },
              { label: 'Address', value: `${customer.address}, ${customer.city}` },
              { label: 'Emergency contact', value: `${customer.careOfName} (${customer.careOfRelation}) · ${customer.careOfPhone}` },
            ]}
          />
        </Card>
      </Section>

      {/* Signature */}
      <Section title="Digital signature" subtitle="Used to sign rental agreements faster">
        <Card>
          {signature ? (
            <View style={styles.sigPreview} accessibilityLabel="Saved signature preview">
              <Svg width="100%" height={120}>
                <Path d={signature} stroke={colors.txt} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          ) : (
            <EmptyState compact title="No saved signature" message="Save one now and reuse it when you sign your next agreement." icon={(c) => <PenLine size={22} color={c} />} />
          )}
          <View style={[styles.rowBetween, { marginTop: 12 }]}>
            <Text style={styles.muted}>{signature ? `Signed as ${customer.name}` : 'Stored on this device only (preview)'}</Text>
            <Button
              label={signature ? 'Update my signature' : 'Add signature'}
              size="sm"
              onPress={() => {
                setSigDraft(signature);
                setSigOpen(true);
              }}
              icon={(c) => <PenLine size={14} color={c} />}
            />
          </View>
        </Card>
      </Section>
    </View>
  );

  const side = (
    <View>
      {/* Payment methods */}
      <Section
        title="Payment methods"
        action={<Button label="Add" size="sm" variant="ghost" onPress={() => showToast('Adding a payment method is simulated in this preview')} icon={(c) => <Plus size={14} color={c} />} />}>
        <Card padded={false} style={{ paddingHorizontal: 14 }}>
          {methods.map((m) => (
            <ListRow
              key={m.id}
              title={m.label}
              subtitle={m.detail}
              left={
                <View style={styles.pmIcon}>
                  {m.label === 'UPI' ? <Smartphone size={16} color={colors.primaryText} /> : <CreditCard size={16} color={colors.primaryText} />}
                </View>
              }
              right={
                m.isDefault ? (
                  <Badge label="Default" tone="primary" />
                ) : (
                  <Button
                    label="Make default"
                    size="sm"
                    variant="ghost"
                    onPress={() => setMethods((prev) => prev.map((x) => ({ ...x, isDefault: x.id === m.id })))}
                  />
                )
              }
            />
          ))}
          <Text style={[styles.muted, { paddingVertical: 10 }]}>Saved methods are placeholders — no payment gateway is connected.</Text>
        </Card>
      </Section>

      {/* Account */}
      <Section title="Account">
        <Card padded={false} style={{ paddingHorizontal: 14 }}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.signOut}
            onPress={() => {
              signOut();
              router.replace('/login' as any);
            }}>
            <LogOut size={18} color={colors.danger} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </Card>
      </Section>
    </View>
  );

  return (
    <Screen bottomInset={64}>
      <PageHeader eyebrow="My account" title="Profile" subtitle="Documents, details and preferences" />

      {/* Summary + loyalty */}
      <View style={[styles.summaryWrap, !isPhone && { flexDirection: 'row' }]}>
        <Card style={!isPhone ? { flex: 1 } : undefined}>
          <View style={styles.summaryRow}>
            <Avatar name={customer.name} bg={customer.avatarBg} size={60} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.name}>{customer.name}</Text>
                {customer.idCardStatus === 'Verified' ? (
                  <Badge label="Verified" tone="success" icon={(c) => <CheckCircle2 size={11} color={c} />} />
                ) : null}
              </View>
              <Text style={styles.muted}>{customer.phone}</Text>
              <Text style={styles.muted}>{customer.email}</Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>
                Member since {formatDate(customer.customerSince)} · Referral code {customer.customerCode}
              </Text>
            </View>
          </View>
        </Card>

        <Card tone="primary" style={!isPhone ? { flex: 1 } : undefined}>
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Award size={20} color={colors.highlight} />
              <Text style={styles.tierTitle}>{customer.loyaltyTier} member</Text>
            </View>
            <Text style={styles.tierPoints}>{customer.loyaltyPoints.toLocaleString('en-IN')} pts</Text>
          </View>
          {currentTier ? <Text style={styles.tierSub}>Your perk: {currentTier.reward}</Text> : null}
          <View style={{ marginTop: 14 }}>
            <ProgressBar value={tierProgress} tone="highlight" />
          </View>
          <Text style={styles.tierSub}>
            {nextTier
              ? `${completedTrips} completed ${completedTrips === 1 ? 'trip' : 'trips'} on record · ${nextTier.tier} at ${nextTier.minTrips} trips (${nextTier.reward})`
              : 'Top tier reached — enjoy your rewards'}
          </Text>
        </Card>
      </View>

      <View style={{ marginTop: 24 }}>
        <SplitView main={main} side={side} sideWidth={400} />
      </View>

      {editOpen ? (
        <EditDetailsSheet
          customer={customer}
          onClose={() => setEditOpen(false)}
          onSave={(patch) => {
            updateCustomer(customer.id, patch);
            showToast('Details updated');
            setEditOpen(false);
          }}
        />
      ) : null}

      <FormSheet
        visible={sigOpen}
        title="Update my signature"
        onClose={() => setSigOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setSigOpen(false)} />
            <Button
              label="Save signature"
              disabled={!sigDraft.trim()}
              onPress={() => {
                setSignature(sigDraft);
                setSigOpen(false);
                showToast('Signature saved on this device (simulated)');
              }}
            />
          </>
        }>
        <Text style={[styles.muted, { marginBottom: 12 }]}>Sign inside the box using your finger or mouse.</Text>
        <SignaturePad value={sigDraft} onChange={setSigDraft} signerName={customer.name} />
      </FormSheet>
    </Screen>
  );
}

function EditDetailsSheet({ customer, onClose, onSave }: { customer: Customer; onClose: () => void; onSave: (patch: Partial<Customer>) => void }) {
  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    city: customer.city,
    careOfName: customer.careOfName,
    careOfPhone: customer.careOfPhone,
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((prev) => ({ ...prev, [k]: v }));
  const emailError = form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Enter a valid email' : undefined;
  const nameError = !form.firstName.trim() ? 'First name is required' : undefined;

  return (
    <FormSheet
      visible
      title="Edit personal details"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save changes" disabled={!!emailError || !!nameError} onPress={() => onSave(form)} />
        </>
      }>
      <FormRow>
        <Field label="First name" value={form.firstName} onChangeText={set('firstName')} required error={nameError} />
        <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} />
      </FormRow>
      <FormRow>
        <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" error={emailError} />
      </FormRow>
      <FormRow>
        <Field label="Address" value={form.address} onChangeText={set('address')} />
        <Field label="City" value={form.city} onChangeText={set('city')} />
      </FormRow>
      <FormRow>
        <Field label="Emergency contact name" value={form.careOfName} onChangeText={set('careOfName')} />
        <Field label="Emergency contact phone" value={form.careOfPhone} onChangeText={set('careOfPhone')} keyboardType="phone-pad" />
      </FormRow>
      <Field label="Driving licence & ID" value="Change via Documents" editable={false} hint="Identity documents are re-verified when replaced." />
    </FormSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    summaryWrap: {
      gap: 12,
      marginTop: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    name: {
      color: colors.txt,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    muted: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    tierTitle: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    tierPoints: {
      color: colors.highlight,
      fontSize: 16,
      fontWeight: '800',
    },
    tierSub: {
      color: colors.onPrimary,
      opacity: 0.85,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 8,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      flexWrap: 'wrap',
    },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      paddingVertical: 12,
    },
    photoCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.lineStrong,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    docTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    sigPreview: {
      height: 120,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.bg,
      overflow: 'hidden',
    },
    notif: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
    },
    notifIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifTitle: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
      flex: 1,
    },
    notifMsg: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    notifTime: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 4,
    },
    pmIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    signOutText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '700',
    },
  });
