import React, { ReactNode, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import {
  Award,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  CreditCard,
  FileSignature,
  FileText,
  History,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  RefreshCw,
  Share2,
  TicketPercent,
  TriangleAlert,
  Wallet,
} from 'lucide-react-native';
import { useApp } from '../../context/AppContext';
import { useContact, phoneDigits } from '../../hooks/useContact';
import { formatDate, formatINR, formatKm } from '../../lib/format';
import { ratesFor } from '../../data/pricing';
import { changePassword, signOut, signOutEverywhere } from '../../services/auth';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking, Customer, VerificationStatus } from '../../types';
import { Badge, Button, Card, ConfirmDialog, Divider, EmptyState, Field, FormRow, FormSheet, KeyValueGrid, ProgressBar, StatusBadge, type Tone } from '../kit';
import { additionalCharges, depositState, dueOn, myBookings, paidOn } from './money';

export interface AccountSection {
  title: string;
  eyebrow: string;
  subtitle?: string;
  Body: React.ComponentType;
}

const statusTone = (s: VerificationStatus): Tone => (s === 'Verified' ? 'success' : s === 'Pending' ? 'warning' : s === 'Rejected' ? 'danger' : 'neutral');
const maskAadhaar = (n: string) => (n ? `XXXX XXXX ${n.replace(/\D/g, '').slice(-4)}` : '—');
const orDash = (v?: string) => (v && v.trim() ? v : '—');

function useMe() {
  const app = useApp();
  const me = app.customers.find((c) => c.id === app.currentCustomerId) as Customer;
  const mine = myBookings(app.bookings, app.currentCustomerId);
  return { ...app, me, mine };
}

/** Opens the rental's own page. */
function useOpenRental() {
  const router = useRouter();
  return (b: Booking) => router.push(`/rental/${encodeURIComponent(b.id)}` as never);
}

async function shareText(message: string, onCopied: () => void) {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    try {
      if (nav?.share) {
        await nav.share({ text: message });
        return;
      }
      await nav?.clipboard?.writeText(message);
      onCopied();
    } catch {
      // The person closed the share sheet
    }
    return;
  }
  await Share.share({ message }).catch(() => undefined);
}

// ---------------------------------------------------------------- small building blocks

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      {typeof value === 'string' ? <Text style={[styles.lineValue, strong && styles.strong]}>{value}</Text> : value}
    </View>
  );
}

function BookingRow({ b, right, sub }: { b: Booking; right?: ReactNode; sub?: string }) {
  const styles = useThemedStyles(makeStyles);
  const open = useOpenRental();
  return (
    <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={() => open(b)}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {b.vehicleName}
        </Text>
        <Text style={styles.itemSub} numberOfLines={2}>
          {sub ?? `${b.id} · ${formatDate(b.pickupDate)} – ${formatDate(b.returnDate)}`}
        </Text>
      </View>
      {right}
    </TouchableOpacity>
  );
}

function List({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.list}>{children}</View>;
}

function Empty({ title, message, icon, action }: { title: string; message: string; icon: (c: string) => ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <EmptyState title={title} message={message} icon={icon} action={action} />
    </Card>
  );
}

function Summary({ items }: { items: { label: string; value: string; tone?: 'danger' | 'success' }[] }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.summary}>
      {items.map((s) => (
        <View key={s.label} style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>{s.label}</Text>
          <Text style={[styles.summaryValue, s.tone === 'danger' && { color: colors.danger }, s.tone === 'success' && { color: colors.success }]}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Asks the customer to send a document to KeyGo on WhatsApp (staff verify it at the counter). */
function SendOnWhatsApp({ what }: { what: string }) {
  const { contact } = useContact();
  const { me } = useMe();
  if (!contact?.phone) return null;
  return (
    <Button
      label="Send on WhatsApp"
      variant="outline"
      size="sm"
      icon={(c) => <MessageCircle size={14} color={c} />}
      onPress={() => Linking.openURL(`https://wa.me/${phoneDigits(contact.phone)}?text=${encodeURIComponent(`Hi KeyGo, this is ${me.name} (${me.customerCode}). Sending my ${what} for verification.`)}`)}
    />
  );
}

// ---------------------------------------------------------------- Main menu

function HistoryBody() {
  const { mine } = useMe();
  const router = useRouter();
  const past = mine.filter((b) => b.status === 'Completed' || b.status === 'Cancelled');
  if (!past.length)
    return <Empty title="No past rentals yet" message="Completed and cancelled bookings will appear here." icon={(c) => <History size={22} color={c} />} action={<Button label="Explore vehicles" onPress={() => router.push('/(tabs)/explore' as never)} />} />;
  return (
    <List>
      {past.map((b) => (
        <BookingRow key={b.id} b={b} sub={`${b.id} · ${formatDate(b.pickupDate)} – ${formatDate(b.returnDate)} · ${formatINR(b.totalAmount)}${b.kmDriven ? ` · ${formatKm(b.kmDriven)}` : ''}`} right={<StatusBadge status={b.status} />} />
      ))}
    </List>
  );
}

// ---------------------------------------------------------------- Booking & rental

function QuotationsBody() {
  const { mine } = useMe();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const quotes = mine.filter((b) => b.status === 'Quoted');
  if (!quotes.length)
    return <Empty title="No open quotations" message="When you price a car, the quote is kept here until you confirm it." icon={(c) => <FileText size={22} color={c} />} action={<Button label="Get a quote" onPress={() => router.push('/booking' as never)} />} />;
  return (
    <View style={{ gap: 12 }}>
      {quotes.map((b) => (
        <Card key={b.id}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{b.vehicleName}</Text>
              <Text style={styles.itemSub}>
                {b.id} · {formatDate(b.pickupDate)} – {formatDate(b.returnDate)} · {b.term}
              </Text>
            </View>
            <Badge label="Quote" tone="warning" />
          </View>
          <Divider />
          <Row label={`${formatINR(b.baseRatePerDay)} × ${b.days} day${b.days === 1 ? '' : 's'}`} value={formatINR(b.baseRatePerDay * b.days)} />
          {b.discount ? <Row label="Discounts" value={`− ${formatINR(b.discount)}`} /> : null}
          <Row label="GST" value={formatINR(b.tax)} />
          <Row label="Rental total" value={formatINR(b.totalAmount)} strong />
          <Row label="Refundable deposit" value={formatINR(b.depositAmount)} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Button label="Confirm & pay deposit" size="sm" icon={(c) => <CreditCard size={14} color={c} />} onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}/pay` as never)} />
            <Button label="Details" size="sm" variant="outline" onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}` as never)} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function AgreementsBody() {
  const { mine, agreements } = useMe();
  const router = useRouter();
  const byId = new Map(mine.map((b) => [b.id, b]));
  const list = agreements.filter((a) => byId.has(a.bookingId));
  const toSign = mine.filter((b) => b.status === 'Confirmed' && !b.agreementId);
  if (!list.length && !toSign.length)
    return <Empty title="No agreements yet" message="You sign the rental agreement after your booking is confirmed." icon={(c) => <FileSignature size={22} color={c} />} />;
  return (
    <View style={{ gap: 16 }}>
      {toSign.length ? (
        <List>
          {toSign.map((b) => (
            <BookingRow key={b.id} b={b} sub={`${b.id} · ready to sign before pickup`} right={<Button label="Sign" size="sm" onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}/agreement` as never)} />} />
          ))}
        </List>
      ) : null}
      {list.length ? (
        <List>
          {list.map((a) => {
            const b = byId.get(a.bookingId)!;
            return (
              <BookingRow
                key={a.id}
                b={b}
                sub={`${a.id} · signed ${formatDate(a.signedDate)} · ${formatINR(a.rentalAmount)}`}
                right={<Button label="View" size="sm" variant="outline" onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}/agreement` as never)} />}
              />
            );
          })}
        </List>
      ) : null}
    </View>
  );
}

function InspectionsBody() {
  const { mine, inspections } = useMe();
  const styles = useThemedStyles(makeStyles);
  const byId = new Map(mine.map((b) => [b.id, b]));
  const list = inspections.filter((r) => byId.has(r.bookingId)).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return <Empty title="No inspection reports" message="KeyGo staff check the car with you at pickup and return." icon={(c) => <ClipboardCheck size={22} color={c} />} />;
  return (
    <View style={{ gap: 12 }}>
      {list.map((r) => (
        <Card key={r.id}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>
                {r.type} check · {byId.get(r.bookingId)?.vehicleName}
              </Text>
              <Text style={styles.itemSub}>
                {r.vehicleNumber} · {formatDate(r.date)} · by {r.inspectorName}
              </Text>
            </View>
            <Badge label={r.type} tone={r.type === 'Pickup' ? 'info' : 'violet'} />
          </View>
          <Divider />
          <Row label="Fuel" value={`${r.fuelPercent}%`} />
          <Row label="Odometer" value={formatKm(r.odometerKm)} />
          <Row label="Photos taken" value={String(r.photosCaptured.length)} />
          <Row label="Damage marks" value={r.damageMarks.length ? r.damageMarks.map((d) => `${d.kind} (${d.zone}, ${d.severity})`).join(', ') : 'None'} />
          {r.estimatedDamageCost ? <Row label="Estimated damage cost" value={formatINR(r.estimatedDamageCost)} strong /> : null}
          {r.notes ? <Text style={[styles.itemSub, { marginTop: 8 }]}>Notes: {r.notes}</Text> : null}
        </Card>
      ))}
    </View>
  );
}

function ReturnsBody() {
  const { mine, today } = useMe();
  const { contact } = useContact();
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const list = mine.filter((b) => b.status === 'Active' || b.status === 'Confirmed').sort((a, b) => a.returnDate.localeCompare(b.returnDate));
  if (!list.length) return <Empty title="No upcoming returns" message="Return details appear once a booking is confirmed." icon={(c) => <CalendarClock size={22} color={c} />} />;
  return (
    <View style={{ gap: 12 }}>
      {list.map((b) => {
        const late = b.status === 'Active' && b.returnDate < today;
        return (
          <Card key={b.id}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{b.vehicleName}</Text>
                <Text style={styles.itemSub}>
                  {b.vehicleNumber} · {b.id}
                </Text>
              </View>
              {late ? <Badge label="Overdue" tone="danger" /> : <StatusBadge status={b.status} />}
            </View>
            <Divider />
            <Row label="Return by" value={`${formatDate(b.returnDate)} · ${b.returnTime}`} strong />
            <View style={[styles.line, { alignItems: 'flex-start' }]}>
              <Text style={styles.lineLabel}>Return to</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexShrink: 1 }}>
                <MapPin size={14} color={colors.primaryText} />
                <Text style={[styles.lineValue, { flexShrink: 1 }]}>{b.pickupLocation}</Text>
              </View>
            </View>
          </Card>
        );
      })}
      <Card tone="primary">
        <Text style={styles.onPrimaryTitle}>Before you return the car</Text>
        {[
          'Bring the car back by the time above, to the same place you picked it up.',
          'Return it with the same fuel or charge level it had at pickup to avoid a fuel charge.',
          'Remove your belongings and hand over the key; staff check the car with you.',
          'Your deposit is refunded after the return check, less any tolls, fines or damage.',
        ].map((t) => (
          <Text key={t} style={styles.onPrimaryText}>
            • {t}
          </Text>
        ))}
        {contact?.phone ? <Text style={[styles.onPrimaryText, { marginTop: 8, fontWeight: '700' }]}>Running late? Call {contact.phone}</Text> : null}
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- My account

function DetailsBody() {
  const { me, updateCustomer, showToast } = useMe();
  const [edit, setEdit] = useState(false);
  return (
    <>
      <Card>
        <KeyValueGrid
          cols={1}
          items={[
            { label: 'First name', value: orDash(me.firstName) },
            { label: 'Last name', value: orDash(me.lastName) },
            { label: 'Date of birth', value: me.dob ? formatDate(me.dob) : '—' },
            { label: 'Phone', value: orDash(me.phone) },
            { label: 'Email', value: orDash(me.email) },
            { label: 'Address', value: orDash(me.address) },
            { label: 'City', value: orDash(me.city) },
            { label: 'Customer since', value: formatDate(me.customerSince) },
          ]}
        />
        <View style={{ marginTop: 14 }}>
          <Button label="Edit my details" onPress={() => setEdit(true)} />
        </View>
      </Card>
      {edit ? (
        <DetailsSheet
          customer={me}
          onClose={() => setEdit(false)}
          onSave={(patch) => {
            updateCustomer(me.id, patch);
            showToast('Details updated');
            setEdit(false);
          }}
        />
      ) : null}
    </>
  );
}

function DetailsSheet({ customer, onClose, onSave }: { customer: Customer; onClose: () => void; onSave: (patch: Partial<Customer>) => void }) {
  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    dob: customer.dob,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    city: customer.city,
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const nameError = !form.firstName.trim() ? 'First name is required' : undefined;
  const emailError = form.email && !/^\S+@\S+\.\S+$/.test(form.email) ? 'Enter a valid email' : undefined;
  const dobError = form.dob && !/^\d{4}-\d{2}-\d{2}$/.test(form.dob) ? 'Use YYYY-MM-DD' : undefined;
  return (
    <FormSheet
      visible
      title="Edit my details"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label="Save" disabled={!!nameError || !!emailError || !!dobError} onPress={() => onSave(form)} />
        </>
      }>
      <FormRow>
        <Field label="First name" value={form.firstName} onChangeText={set('firstName')} required error={nameError} />
        <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} />
      </FormRow>
      <FormRow>
        <Field label="Date of birth" value={form.dob} onChangeText={set('dob')} placeholder="YYYY-MM-DD" error={dobError} />
        <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      </FormRow>
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" error={emailError} />
      <FormRow>
        <Field label="Address" value={form.address} onChangeText={set('address')} />
        <Field label="City" value={form.city} onChangeText={set('city')} />
      </FormRow>
    </FormSheet>
  );
}

function IdentityBody() {
  const { me } = useMe();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>ID card (Aadhaar)</Text>
            <Text style={styles.itemSub}>{maskAadhaar(me.aadhaarNo)}</Text>
          </View>
          <Badge label={me.idCardStatus} tone={statusTone(me.idCardStatus)} />
        </View>
        {me.idCardStatus !== 'Verified' ? (
          <View style={{ marginTop: 12 }}>
            <SendOnWhatsApp what="ID card" />
          </View>
        ) : null}
      </Card>
      <Card>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Face check</Text>
            <Text style={styles.itemSub}>Your photo is matched with your ID at pickup</Text>
          </View>
          <Badge label={me.faceVerification} tone={statusTone(me.faceVerification)} />
        </View>
      </Card>
      <Text style={styles.note}>KeyGo staff verify your ID before your first pickup. Your Aadhaar number is stored encrypted and only the last 4 digits are shown.</Text>
    </View>
  );
}

function LicenceBody() {
  const { me, today } = useMe();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const dl = me.documents.find((d) => d.kind === 'Driving licence');
  const expired = !!me.dlExpiry && me.dlExpiry < today;
  return (
    <Card>
      <KeyValueGrid
        cols={1}
        items={[
          { label: 'Licence number', value: orDash(me.dlNumber) },
          { label: 'Issuing state', value: orDash(me.dlState) },
          { label: 'Valid till', value: me.dlExpiry ? <Text style={[styles.lineValue, expired && { color: colors.danger }]}>{formatDate(me.dlExpiry)}{expired ? ' · expired' : ''}</Text> : '—' },
          { label: 'Verification', value: <Badge label={dl?.status ?? 'Not uploaded'} tone={statusTone(dl?.status ?? 'Not uploaded')} /> },
        ]}
      />
      {dl?.status !== 'Verified' ? (
        <View style={{ marginTop: 12 }}>
          <SendOnWhatsApp what="driving licence" />
        </View>
      ) : null}
    </Card>
  );
}

function DocumentsBody() {
  const { me } = useMe();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <View style={styles.cardHead}>
          <View style={styles.photoCircle}>
            <Camera size={20} color={me.photoCaptured ? colors.success : colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>Customer photo</Text>
            <Text style={styles.itemSub}>{me.photoCaptured ? 'Taken by KeyGo staff' : 'Taken at the counter on your first pickup'}</Text>
          </View>
          <Badge label={me.photoCaptured ? 'On file' : 'Not taken'} tone={me.photoCaptured ? 'success' : 'neutral'} />
        </View>
      </Card>
      {me.documents.length ? (
        <List>
          {me.documents.map((d) => (
            <View key={d.id} style={styles.item}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle}>{d.name}</Text>
                <Text style={styles.itemSub}>
                  {d.kind}
                  {d.uploadedAt ? ` · added ${formatDate(d.uploadedAt)}` : ''}
                </Text>
              </View>
              <Badge label={d.status} tone={statusTone(d.status)} />
            </View>
          ))}
        </List>
      ) : (
        <Empty title="No documents on file" message="Share your ID, driving licence and address proof with KeyGo before your first pickup." icon={(c) => <FileText size={22} color={c} />} action={<SendOnWhatsApp what="documents" />} />
      )}
    </View>
  );
}

function EmergencyBody() {
  const { me, updateCustomer, showToast } = useMe();
  const [form, setForm] = useState({ careOfName: me.careOfName, careOfRelation: me.careOfRelation, careOfPhone: me.careOfPhone });
  const changed = form.careOfName !== me.careOfName || form.careOfRelation !== me.careOfRelation || form.careOfPhone !== me.careOfPhone;
  const styles = useThemedStyles(makeStyles);
  return (
    <Card>
      <Text style={[styles.note, { marginTop: 0, marginBottom: 12 }]}>Someone KeyGo can call if we can&apos;t reach you during a rental.</Text>
      <Field label="Name" value={form.careOfName} onChangeText={(v) => setForm((p) => ({ ...p, careOfName: v }))} />
      <FormRow>
        <Field label="Relation" value={form.careOfRelation} onChangeText={(v) => setForm((p) => ({ ...p, careOfRelation: v }))} placeholder="e.g. Father, Spouse" />
        <Field label="Phone" value={form.careOfPhone} onChangeText={(v) => setForm((p) => ({ ...p, careOfPhone: v }))} keyboardType="phone-pad" />
      </FormRow>
      <Button
        label="Save contact"
        disabled={!changed}
        onPress={() => {
          updateCustomer(me.id, form);
          showToast('Emergency contact saved');
        }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- Payments

function PaymentsBody() {
  const { mine } = useMe();
  const router = useRouter();
  const list = mine.filter((b) => b.status !== 'Cancelled' || b.paymentStatus !== 'Unpaid');
  const paid = list.reduce((s, b) => s + paidOn(b), 0);
  const due = list.reduce((s, b) => s + dueOn(b), 0);
  if (!list.length) return <Empty title="No payments yet" message="Payments for your bookings will be listed here." icon={(c) => <CreditCard size={22} color={c} />} />;
  return (
    <View style={{ gap: 14 }}>
      <Summary items={[{ label: 'Paid so far', value: formatINR(paid), tone: 'success' }, { label: 'Due now', value: formatINR(due), tone: due ? 'danger' : undefined }]} />
      <List>
        {list.map((b) => {
          const d = dueOn(b);
          return (
            <BookingRow
              key={b.id}
              b={b}
              sub={`${b.id} · paid ${formatINR(paidOn(b))}${d ? ` · due ${formatINR(d)}` : ''}`}
              right={d ? <Button label="Pay" size="sm" variant="highlight" onPress={() => router.push(`/rental/${encodeURIComponent(b.id)}/pay` as never)} /> : <Badge label={b.paymentStatus} tone={b.paymentStatus === 'Refunded' ? 'info' : 'success'} />}
            />
          );
        })}
      </List>
    </View>
  );
}

function DepositBody() {
  const { mine } = useMe();
  const styles = useThemedStyles(makeStyles);
  const list = mine.filter((b) => b.depositAmount > 0 && b.status !== 'Quoted' && !(b.status === 'Cancelled' && b.paymentStatus === 'Unpaid'));
  const held = list.filter((b) => depositState(b) === 'Held').reduce((s, b) => s + b.depositAmount, 0);
  const refunded = list.filter((b) => depositState(b) === 'Refunded').reduce((s, b) => s + b.depositAmount, 0);
  if (!list.length) return <Empty title="No deposits" message="A refundable security deposit is taken when you confirm a booking." icon={(c) => <Wallet size={22} color={c} />} />;
  return (
    <View style={{ gap: 14 }}>
      <Summary items={[{ label: 'Held by KeyGo', value: formatINR(held) }, { label: 'Refunded', value: formatINR(refunded), tone: 'success' }]} />
      <List>
        {list.map((b) => {
          const s = depositState(b);
          return <BookingRow key={b.id} b={b} sub={`${b.id} · deposit ${formatINR(b.depositAmount)}`} right={<Badge label={s} tone={s === 'Refunded' ? 'success' : s === 'Held' ? 'info' : 'warning'} />} />;
        })}
      </List>
      <Text style={styles.note}>Deposits are refunded after the return check, less any tolls, fines, fuel or damage charges.</Text>
    </View>
  );
}

function InvoicesBody() {
  const { mine, me } = useMe();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState<string | null>(null);
  const list = mine.filter((b) => paidOn(b) > 0);
  if (!list.length) return <Empty title="No receipts yet" message="A receipt is created for every booking you pay for." icon={(c) => <Receipt size={22} color={c} />} />;
  return (
    <View style={{ gap: 10 }}>
      {list.map((b) => {
        const extras = (b.fuelCharges ?? 0) + (b.tollCharges ?? 0) + (b.fineCharges ?? 0) + (b.damageCharges ?? 0);
        const receipt = [
          `KeyGo receipt · ${b.id}`,
          `${me.name}`,
          `${b.vehicleName} (${b.vehicleNumber})`,
          `${formatDate(b.pickupDate)} – ${formatDate(b.returnDate)} · ${b.days} day(s)`,
          `Rental: ${formatINR(b.subtotal)}`,
          `GST: ${formatINR(b.tax)}`,
          `Total: ${formatINR(b.totalAmount)}`,
          `Deposit: ${formatINR(b.depositAmount)}`,
          extras ? `Extra charges: ${formatINR(extras)}` : '',
          `Payment: ${b.paymentStatus}`,
        ]
          .filter(Boolean)
          .join('\n');
        return (
          <Card key={b.id}>
            <TouchableOpacity accessibilityRole="button" style={styles.cardHead} onPress={() => setOpen(open === b.id ? null : b.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{b.vehicleName}</Text>
                <Text style={styles.itemSub}>
                  {b.id} · {formatDate(b.pickupDate)} · {formatINR(paidOn(b))}
                </Text>
              </View>
              <Badge label={b.paymentStatus} tone={b.paymentStatus === 'Paid' ? 'success' : 'info'} />
            </TouchableOpacity>
            {open === b.id ? (
              <>
                <Divider />
                <Row label="Rental (before tax)" value={formatINR(b.subtotal)} />
                {b.discount ? <Row label="Discounts" value={`− ${formatINR(b.discount)}`} /> : null}
                <Row label="GST" value={formatINR(b.tax)} />
                <Row label="Rental total" value={formatINR(b.totalAmount)} strong />
                <Row label="Security deposit" value={formatINR(b.depositAmount)} />
                {extras ? <Row label="Extra charges" value={formatINR(extras)} /> : null}
                <View style={{ marginTop: 10 }}>
                  <Button label="Share receipt" size="sm" variant="outline" icon={(c) => <Share2 size={14} color={c} />} onPress={() => shareText(receipt, () => undefined)} />
                </View>
              </>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

function ChargesBody() {
  const { mine, fastagLogs } = useMe();
  const open = useOpenRental();
  const styles = useThemedStyles(makeStyles);
  const list = additionalCharges(mine, fastagLogs);
  const byId = new Map(mine.map((b) => [b.id, b]));
  if (!list.length) return <Empty title="No extra charges" message="Tolls, fuel, fines or damage charges would show here." icon={(c) => <TriangleAlert size={22} color={c} />} />;
  const total = list.reduce((s, c) => s + c.amount, 0);
  return (
    <View style={{ gap: 14 }}>
      <Summary items={[{ label: 'Total extra charges', value: formatINR(total), tone: 'danger' }]} />
      <List>
        {list.map((c) => (
          <TouchableOpacity key={c.id} accessibilityRole="button" style={styles.item} onPress={() => byId.get(c.bookingId) && open(byId.get(c.bookingId)!)}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemTitle}>{c.label}</Text>
              <Text style={styles.itemSub}>
                {c.bookingId} · {formatDate(c.date)}
              </Text>
            </View>
            <Text style={styles.amount}>{formatINR(c.amount)}</Text>
          </TouchableOpacity>
        ))}
      </List>
    </View>
  );
}

// ---------------------------------------------------------------- Rewards & offers

function CodeCard() {
  const { me, showToast } = useMe();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card tone="primary">
      <Text style={styles.onPrimaryText}>Your customer code</Text>
      <Text style={styles.code} selectable>
        {me.customerCode || '—'}
      </Text>
      <Text style={styles.onPrimaryText}>Quote this code at the counter or when a friend books with KeyGo.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <Button label="Copy / share" variant="highlight" size="sm" icon={(c) => <Copy size={14} color={c} />} onPress={() => shareText(me.customerCode, () => showToast('Code copied'))} />
      </View>
      <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.12 }}>
        <Award size={120} color={colors.onPrimary} />
      </View>
    </Card>
  );
}

function CodeBody() {
  return <CodeCard />;
}

function ReferBody() {
  const { me, showToast } = useMe();
  const styles = useThemedStyles(makeStyles);
  const message = `I rent cars with KeyGo. Use my customer code ${me.customerCode} when you book: https://keygo.upgrowa.cloud`;
  return (
    <View style={{ gap: 14 }}>
      <CodeCard />
      <Card>
        <Text style={styles.itemTitle}>How it works</Text>
        {['Share your code with a friend.', 'Your friend gives the code when they book.', 'KeyGo adds the referral to your account once their rental is complete.'].map((t, n) => (
          <Text key={t} style={[styles.itemSub, { marginTop: 6 }]}>
            {n + 1}. {t}
          </Text>
        ))}
        <View style={{ marginTop: 14 }}>
          <Button label="Invite a friend" icon={(c) => <Share2 size={16} color={c} />} onPress={() => shareText(message, () => showToast('Invite copied — paste it to your friend'))} />
        </View>
      </Card>
    </View>
  );
}

function RewardsBody() {
  const { me, loyaltyTiers, mine } = useMe();
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  const done = mine.filter((b) => b.status === 'Completed').length;
  const idx = loyaltyTiers.findIndex((t) => t.tier === me.loyaltyTier);
  const next = idx >= 0 ? loyaltyTiers[idx + 1] : undefined;
  return (
    <View style={{ gap: 14 }}>
      <Card tone="primary">
        <View style={styles.cardHead}>
          <Award size={22} color={colors.highlight} />
          <Text style={[styles.onPrimaryTitle, { flex: 1 }]}>{me.loyaltyTier} member</Text>
          <Text style={[styles.onPrimaryTitle, { color: colors.highlight }]}>{me.loyaltyPoints.toLocaleString('en-IN')} pts</Text>
        </View>
        <View style={{ marginTop: 12 }}>
          <ProgressBar value={next ? Math.min(1, done / Math.max(1, next.minTrips)) : 1} tone="highlight" />
        </View>
        <Text style={styles.onPrimaryText}>{next ? `${done} completed rental${done === 1 ? '' : 's'} · ${next.tier} at ${next.minTrips}` : 'Top tier reached — enjoy your rewards'}</Text>
      </Card>
      {loyaltyTiers.length ? (
        <List>
          {loyaltyTiers.map((t) => (
            <View key={t.id} style={styles.item}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.itemTitle}>{t.tier}</Text>
                <Text style={styles.itemSub}>
                  From {t.minTrips} rental{t.minTrips === 1 ? '' : 's'} · {t.reward}
                </Text>
              </View>
              {t.tier === me.loyaltyTier ? <Badge label="You" tone="success" icon={(c) => <CheckCircle2 size={11} color={c} />} /> : null}
            </View>
          ))}
        </List>
      ) : null}
    </View>
  );
}

function OffersBody() {
  const { vehicles, me, loyaltyTiers } = useMe();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const rentable = vehicles.filter((v) => v.status !== 'Sold');
  const best = (term: 'weekly' | 'monthly') => {
    let pct = 0;
    for (const v of rentable) {
      const r = ratesFor(v);
      const full = r.daily * (term === 'weekly' ? 7 : 30);
      if (full > 0) pct = Math.max(pct, Math.round((1 - r[term] / full) * 100));
    }
    return pct;
  };
  const weekly = best('weekly');
  const monthly = best('monthly');
  const perk = loyaltyTiers.find((t) => t.tier === me.loyaltyTier)?.reward;
  const offers = [
    weekly > 0 ? { t: `Save up to ${weekly}% on weekly rentals`, s: 'Book 7 days or more and the weekly rate applies automatically.' } : null,
    monthly > 0 ? { t: `Save up to ${monthly}% on monthly rentals`, s: 'Book 30 days or more for the lowest daily price.' } : null,
    perk ? { t: `${me.loyaltyTier} member perk`, s: perk } : null,
  ].filter(Boolean) as { t: string; s: string }[];
  if (!offers.length) return <Empty title="No offers right now" message="New offers will appear here." icon={(c) => <TicketPercent size={22} color={c} />} />;
  return (
    <View style={{ gap: 12 }}>
      {offers.map((o) => (
        <Card key={o.t}>
          <View style={styles.cardHead}>
            <View style={styles.offerIcon}>
              <TicketPercent size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{o.t}</Text>
              <Text style={styles.itemSub}>{o.s}</Text>
            </View>
          </View>
        </Card>
      ))}
      <Button label="Find a car" onPress={() => router.push('/(tabs)/explore' as never)} />
    </View>
  );
}

// ---------------------------------------------------------------- Communication

function ContactMissing() {
  return <Empty title="Contact details not set up yet" message="KeyGo hasn't added a support number yet. Please try again later." icon={(c) => <Phone size={22} color={c} />} />;
}

function WhatsAppBody() {
  const { contact, loading } = useContact();
  const { me } = useMe();
  const styles = useThemedStyles(makeStyles);
  if (loading) return <Text style={styles.note}>Loading…</Text>;
  if (!contact?.phone) return <ContactMissing />;
  const link = (text: string) => `https://wa.me/${phoneDigits(contact.phone)}?text=${encodeURIComponent(text)}`;
  const topics = ['I need help with a booking', 'I want to extend my rental', 'Question about a payment', 'My car has a problem'];
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={styles.itemTitle}>Chat with {contact.name} on WhatsApp</Text>
        <Text style={styles.itemSub}>
          {contact.phone}
          {contact.supportHours ? ` · ${contact.supportHours}` : ''}
        </Text>
        <View style={{ marginTop: 12 }}>
          <Button label="Open WhatsApp" icon={(c) => <MessageCircle size={16} color={c} />} onPress={() => Linking.openURL(link(`Hi KeyGo, this is ${me.name} (${me.customerCode}).`))} />
        </View>
      </Card>
      <List>
        {topics.map((t) => (
          <TouchableOpacity key={t} accessibilityRole="button" style={styles.item} onPress={() => Linking.openURL(link(`Hi KeyGo, this is ${me.name} (${me.customerCode}). ${t}.`))}>
            <MessageCircle size={18} color="#25D366" />
            <Text style={[styles.itemTitle, { flex: 1 }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </List>
    </View>
  );
}

function HelpBody() {
  const { contact, loading } = useContact();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  if (loading) return <Text style={styles.note}>Loading…</Text>;
  if (!contact || (!contact.phone && !contact.email)) return <ContactMissing />;
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={styles.itemTitle}>{contact.name} support</Text>
        {contact.supportHours ? <Text style={styles.itemSub}>Open {contact.supportHours}</Text> : null}
        {contact.address ? <Text style={[styles.itemSub, { marginTop: 4 }]}>{contact.address}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {contact.phone ? <Button label={`Call ${contact.phone}`} icon={(c) => <Phone size={15} color={c} />} onPress={() => Linking.openURL(`tel:${contact.phone.replace(/\s/g, '')}`)} /> : null}
          {contact.email ? <Button label="Email us" variant="outline" icon={(c) => <Mail size={15} color={c} />} onPress={() => Linking.openURL(`mailto:${contact.email}`)} /> : null}
          {contact.phone ? <Button label="WhatsApp" variant="outline" icon={(c) => <MessageCircle size={15} color={c} />} onPress={() => router.push('/account/whatsapp' as never)} /> : null}
        </View>
      </Card>
      <Card>
        <Text style={styles.itemTitle}>Breakdown or accident during a rental?</Text>
        <Text style={styles.itemSub}>Open My Bookings → your active trip → Roadside help, or call the number above.</Text>
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- Settings

function AppSettingsBody() {
  const { showToast } = useMe();
  const styles = useThemedStyles(makeStyles);
  const [checking, setChecking] = useState(false);
  const version = Constants.expoConfig?.version ?? '—';
  const check = async () => {
    if (!Updates.isEnabled) {
      showToast('Updates are installed automatically on this device');
      return;
    }
    setChecking(true);
    try {
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else showToast('You have the latest version');
    } catch {
      showToast('Could not check for updates. Try again later.');
    } finally {
      setChecking(false);
    }
  };
  return (
    <Card>
      <Row label="App version" value={version} />
      {Updates.isEnabled && Updates.updateId ? <Row label="Update" value={Updates.updateId.slice(0, 8)} /> : null}
      <Row label="Platform" value={Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iPhone' : 'Android'} />
      <View style={{ marginTop: 14 }}>
        <Button label={checking ? 'Checking…' : 'Check for updates'} disabled={checking} variant="outline" icon={(c) => <RefreshCw size={15} color={c} />} onPress={check} />
      </View>
      <Text style={styles.note}>Booking, pickup, return and payment reminders are sent by KeyGo on WhatsApp/SMS and appear under Notifications.</Text>
    </Card>
  );
}

function PrivacyBody() {
  const { me } = useMe();
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const { showToast } = useMe();
  const [confirm, setConfirm] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const nextError = next.length < 8 ? 'Use at least 8 characters' : next === current ? 'Choose a different password' : undefined;
  const againError = again !== next ? 'The two new passwords do not match' : undefined;
  const leave = () => router.replace('/login' as never);

  const savePassword = async () => {
    setTried(true);
    if (!current || nextError || againError) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      setTried(false);
      showToast('Password changed. Other devices were signed out.');
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={styles.itemTitle}>Signed in as</Text>
        <Text style={styles.itemSub}>
          {me.email || me.phone} · customer code {me.customerCode}
        </Text>
        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button label="Sign out of this device" variant="danger" onPress={() => setConfirm(true)} />
          <Button label="Sign out of all devices" variant="outline" onPress={() => setConfirmAll(true)} />
        </View>
      </Card>
      <Card>
        <Text style={[styles.itemTitle, { marginBottom: 10 }]}>Change password</Text>
        <Field label="Current password" secureTextEntry value={current} onChangeText={setCurrent} error={tried && !current ? 'Enter your current password' : undefined} />
        <Field label="New password" secureTextEntry value={next} onChangeText={setNext} error={tried ? nextError : undefined} hint="At least 8 characters." />
        <Field label="New password again" secureTextEntry value={again} onChangeText={setAgain} error={tried ? againError : undefined} />
        <Button label={saving ? 'Saving…' : 'Change password'} disabled={saving} onPress={savePassword} />
        <Text style={styles.note}>Other phones or browsers signed in to your account will be signed out.</Text>
      </Card>
      <Card>
        <Text style={styles.itemTitle}>How KeyGo uses your data</Text>
        {[
          'Your ID and licence are used only to verify you before a rental.',
          'Your Aadhaar number is stored encrypted; most staff see only the last 4 digits.',
          'Vehicle GPS location is used for safety and recovery during your rental.',
          'To change or remove your data, contact KeyGo support.',
        ].map((t) => (
          <Text key={t} style={[styles.itemSub, { marginTop: 6 }]}>
            • {t}
          </Text>
        ))}
        <View style={{ marginTop: 12 }}>
          <Button label="Contact support" variant="outline" size="sm" onPress={() => router.push('/account/help' as never)} />
        </View>
      </Card>
      <ConfirmDialog
        visible={confirm}
        title="Sign out?"
        message="You'll need your email and password to sign in again."
        confirmLabel="Sign out"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          signOut();
          leave();
        }}
      />
      <ConfirmDialog
        visible={confirmAll}
        title="Sign out of all devices?"
        message="Every phone and browser signed in to your KeyGo account, including this one, will be signed out."
        confirmLabel="Sign out everywhere"
        danger
        onCancel={() => setConfirmAll(false)}
        onConfirm={async () => {
          setConfirmAll(false);
          try {
            await signOutEverywhere();
            leave();
          } catch (e) {
            showToast((e as Error).message);
          }
        }}
      />
    </View>
  );
}

export const ACCOUNT_SECTIONS: Record<string, AccountSection> = {
  history: { eyebrow: 'Main menu', title: 'Rental History', subtitle: 'Previous bookings and rental details', Body: HistoryBody },
  quotations: { eyebrow: 'Booking & rental', title: 'My Quotations', subtitle: 'Quotes waiting for your confirmation', Body: QuotationsBody },
  agreements: { eyebrow: 'Booking & rental', title: 'Rental Agreements', subtitle: 'Signed agreements and ones to sign', Body: AgreementsBody },
  inspections: { eyebrow: 'Booking & rental', title: 'Inspection Reports', subtitle: 'Pickup and return checks', Body: InspectionsBody },
  returns: { eyebrow: 'Booking & rental', title: 'Return Details', subtitle: 'When and where to return your car', Body: ReturnsBody },
  details: { eyebrow: 'My account', title: 'My Profile', subtitle: 'Your personal details', Body: DetailsBody },
  identity: { eyebrow: 'My account', title: 'Identity Verification', Body: IdentityBody },
  licence: { eyebrow: 'My account', title: 'Driving Licence', Body: LicenceBody },
  documents: { eyebrow: 'My account', title: 'My Documents', Body: DocumentsBody },
  emergency: { eyebrow: 'My account', title: 'Emergency / C/O Details', Body: EmergencyBody },
  payments: { eyebrow: 'Payments', title: 'Payments & Transactions', Body: PaymentsBody },
  deposit: { eyebrow: 'Payments', title: 'Security Deposit', Body: DepositBody },
  invoices: { eyebrow: 'Payments', title: 'Invoices & Receipts', subtitle: 'Tap a booking to see its receipt', Body: InvoicesBody },
  charges: { eyebrow: 'Payments', title: 'Additional Charges & Fines', Body: ChargesBody },
  code: { eyebrow: 'Rewards & offers', title: 'My Customer Code', Body: CodeBody },
  refer: { eyebrow: 'Rewards & offers', title: 'Refer a Friend', Body: ReferBody },
  rewards: { eyebrow: 'Rewards & offers', title: 'Rewards & Gifts', Body: RewardsBody },
  offers: { eyebrow: 'Rewards & offers', title: 'Offers & Discounts', Body: OffersBody },
  whatsapp: { eyebrow: 'Communication', title: 'WhatsApp Support', Body: WhatsAppBody },
  help: { eyebrow: 'Communication', title: 'Help & Support', Body: HelpBody },
  'app-settings': { eyebrow: 'Settings', title: 'App Settings', Body: AppSettingsBody },
  privacy: { eyebrow: 'Settings', title: 'Privacy & Security', Body: PrivacyBody },
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
    itemTitle: { color: colors.txt, fontSize: 14.5, fontWeight: '700' },
    itemSub: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 6 },
    lineLabel: { color: colors.muted, fontSize: 13 },
    lineValue: { color: colors.txt, fontSize: 13.5, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
    strong: { fontWeight: '800', fontSize: 15 },
    amount: { color: colors.danger, fontSize: 15, fontWeight: '800' },
    note: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 12 },
    summary: { flexDirection: 'row', gap: 10 },
    summaryTile: { flex: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
    summaryLabel: { color: colors.muted, fontSize: 12 },
    summaryValue: { color: colors.txt, fontSize: 20, fontWeight: '800', marginTop: 4 },
    onPrimaryTitle: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
    onPrimaryText: { color: colors.onPrimary, opacity: 0.88, fontSize: 13, lineHeight: 19, marginTop: 6 },
    code: { color: colors.highlight, fontSize: 30, fontWeight: '900', letterSpacing: 3, marginTop: 6 },
    photoCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    offerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  });

