import { useLocalSearchParams, useRouter } from '@/shims/expo-router';
import { Download, FileText, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
    Badge,
    Button,
    Card,
    Checkbox,
    EmptyState,
    Field,
    FormRow,
    FormSheet,
    PageHeader,
    Screen,
    Section,
    SignaturePad,
    SimulatedNote,
    SplitView,
    StatusBadge,
} from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { formatDate, formatINR } from '../../lib/format';
import { activePenalties, activeTerms } from '../../services/agreements';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { AgreementFine, Booking } from '../../types';

export default function AgreementScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = decodeURIComponent(id ?? '');
  const { bookings, agreements, signAgreement, showToast } = useApp();
  const booking = bookings.find((b) => b.id === bookingId);
  const existing = agreements.find((a) => a.bookingId === bookingId);

  const [deposit, setDeposit] = useState(String(booking?.depositAmount ?? 5000));
  const [discount, setDiscount] = useState('0');
  const [fines, setFines] = useState<AgreementFine[]>(() =>
    existing?.fines.length ? existing.fines : activePenalties().map((p) => ({ id: p.id, label: p.label, amount: p.amount }))
  );
  const [terms] = useState(activeTerms);
  const [signer, setSigner] = useState(booking?.customerName ?? '');
  const [signature, setSignature] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [depositAccepted, setDepositAccepted] = useState(false);
  const [preview, setPreview] = useState(false);

  if (!booking) {
    return (
      <Screen>
        <PageHeader title="Agreement" back />
        <EmptyState title="Booking not found" message={`No booking with id ${bookingId}.`} />
      </Screen>
    );
  }

  const num = (s: string) => Math.max(0, parseInt(s.replace(/[^0-9]/g, ''), 10) || 0);
  const canSign = !existing && signature.length > 10 && accepted && depositAccepted && signer.trim().length > 1;

  const doc = existing
    ? {
        deposit: existing.securityDeposit,
        discount: existing.discount,
        fines: existing.fines,
        signer: existing.signaturePreview.replace(' (Digitally Signed)', ''),
        signature: existing.signaturePath ?? '',
        signedDate: existing.signedDate,
      }
    : { deposit: num(deposit), discount: num(discount), fines, signer, signature, signedDate: undefined as string | undefined };

  const onSign = () => {
    signAgreement(booking.id, {
      signaturePath: signature,
      signedBy: signer.trim(),
      securityDeposit: num(deposit),
      discount: num(discount),
      fines: fines.filter((f) => f.label.trim()),
    });
    router.replace(`/bookings/${encodeURIComponent(booking.id)}` as any);
  };

  const pdfActions = (
    <>
      <Button label="Preview PDF" variant="outline" icon={(c) => <FileText size={15} color={c} />} onPress={() => setPreview(true)} />
      <Button label="Download PDF" variant="outline" icon={(c) => <Download size={15} color={c} />} onPress={() => showToast('PDF download is simulated in the UI phase')} />
    </>
  );

  return (
    <Screen>
      <PageHeader
        eyebrow="Rental agreement"
        title={existing ? existing.id : `New agreement · ${booking.id}`}
        subtitle={`${booking.customerName} · ${booking.vehicleName} (${booking.vehicleNumber})`}
        back
        actions={
          <>
            {existing ? <StatusBadge status={existing.status} /> : <Badge label="Draft" tone="info" />}
            {pdfActions}
          </>
        }
      />

      <SplitView
        sideWidth={520}
        main={
          existing ? (
            <Section title="Signed agreement" style={{ marginTop: 16 }}>
              <Card>
                <Text style={styles.body}>
                  Signed by {doc.signer} on {formatDate(existing.signedDate)}. The agreement is {existing.status.toLowerCase()} and can no longer be edited.
                </Text>
                <SimulatedNote>Digital signature captured on-device. Legal e-sign / Aadhaar eSign integration is pending.</SimulatedNote>
                <Button label="Back to rental" variant="ghost" onPress={() => router.replace(`/bookings/${encodeURIComponent(booking.id)}` as any)} />
              </Card>
            </Section>
          ) : (
            <View>
              <Section title="Charges" style={{ marginTop: 16 }}>
                <Card>
                  <FormRow>
                    <Field label="Security deposit (₹)" value={deposit} onChangeText={setDeposit} keyboardType="numeric" required hint="Refundable within 48 hours of return" />
                    <Field label="Agreement discount (₹)" value={discount} onChangeText={setDiscount} keyboardType="numeric" hint={booking.discount ? `Quote already includes ${formatINR(booking.discount)} off` : 'Optional goodwill discount'} />
                  </FormRow>
                  <Text style={styles.subhead}>Fines & penalties</Text>
                  {fines.map((f, i) => (
                    <View key={f.id} style={styles.fineRow}>
                      <Field
                        style={{ flex: 1, marginBottom: 8 }}
                        label={`Fine ${i + 1}`}
                        value={f.label}
                        onChangeText={(t) => setFines((prev) => prev.map((x) => (x.id === f.id ? { ...x, label: t } : x)))}
                      />
                      <Field
                        style={{ width: 110, marginBottom: 8 }}
                        label="Amount (₹)"
                        value={String(f.amount)}
                        keyboardType="numeric"
                        onChangeText={(t) => setFines((prev) => prev.map((x) => (x.id === f.id ? { ...x, amount: num(t) } : x)))}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${f.label}`}
                        style={styles.removeBtn}
                        onPress={() => setFines((prev) => prev.filter((x) => x.id !== f.id))}>
                        <Trash2 size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <Button
                    label="Add fine"
                    size="sm"
                    variant="ghost"
                    icon={(c) => <Plus size={14} color={c} />}
                    onPress={() => setFines((prev) => [...prev, { id: `f${Date.now()}`, label: '', amount: 0 }])}
                  />
                </Card>
              </Section>

              <Section title="Terms & conditions">
                <Card>
                  {terms.map((t, i) => (
                    <Text key={t.id} style={styles.term}>
                      {i + 1}. {t.body}
                    </Text>
                  ))}
                  <View style={{ marginTop: 8 }}>
                    <Checkbox label="The customer has read and accepts the terms & conditions." checked={accepted} onChange={setAccepted} />
                    <Checkbox label={`The customer accepts the ${formatINR(num(deposit))} security deposit and listed fines.`} checked={depositAccepted} onChange={setDepositAccepted} />
                  </View>
                </Card>
              </Section>

              <Section title="Signature">
                <Card>
                  <Field label="Signer full name" value={signer} onChangeText={setSigner} required />
                  <SignaturePad value={signature} onChange={setSignature} signerName={signer} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                    <Button label="Sign & activate agreement" disabled={!canSign} onPress={onSign} />
                  </View>
                  {!canSign ? <Text style={styles.hint}>Accept both checkboxes, enter the signer name and draw a signature to continue.</Text> : null}
                </Card>
              </Section>
            </View>
          )
        }
        side={
          <Section title="Agreement preview" style={{ marginTop: 16 }}>
            <AgreementDocument booking={booking} doc={doc} />
          </Section>
        }
      />

      <FormSheet visible={preview} title="PDF preview" onClose={() => setPreview(false)} footer={<Button label="Download PDF" onPress={() => showToast('PDF download is simulated in the UI phase')} />}>
        <AgreementDocument booking={booking} doc={doc} />
        <SimulatedNote>PDF generation will be provided by the backend.</SimulatedNote>
      </FormSheet>
    </Screen>
  );
}

export interface DocData {
  deposit: number;
  discount: number;
  fines: AgreementFine[];
  signer: string;
  signature: string;
  signedDate?: string;
}

/** Paper-style contract preview. */
export function AgreementDocument({ booking, doc }: { booking: Booking; doc: DocData }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.paper}>
      <View style={[styles.paperHead, { borderBottomColor: colors.primary }]}>
        <Text style={[styles.paperBrand, { color: colors.primaryText }]}>KeyGo Car Rentals</Text>
        <Text style={styles.paperTitle}>Vehicle Rental Agreement</Text>
        <Text style={styles.docKey}>Booking {booking.id} · {formatDate(doc.signedDate ?? booking.createdAt)}</Text>
      </View>
      <Text style={styles.paperSection}>Parties & vehicle</Text>
      <DocRow k="Customer" v={`${booking.customerName} · ${booking.customerPhone}`} />
      <DocRow k="Vehicle" v={`${booking.vehicleName} · ${booking.vehicleNumber}`} />
      <DocRow k="Rental period" v={`${formatDate(booking.pickupDate, false)} ${booking.pickupTime} → ${formatDate(booking.returnDate, false)} ${booking.returnTime}`} />
      <DocRow k="Pickup location" v={booking.pickupLocation} />
      <DocRow k="Term / purpose" v={`${booking.term} · ${booking.purpose}`} />
      <Text style={styles.paperSection}>Charges</Text>
      <DocRow k="Rental amount (incl. GST)" v={formatINR(booking.totalAmount)} />
      <DocRow k="Agreement discount" v={doc.discount ? `− ${formatINR(doc.discount)}` : '—'} />
      <DocRow k="Security deposit" v={formatINR(doc.deposit)} />
      <Text style={styles.paperSection}>Fines & penalties</Text>
      {doc.fines.length ? doc.fines.map((f) => <DocRow key={f.id} k={f.label || 'Untitled fine'} v={formatINR(f.amount)} />) : <Text style={styles.docKey}>None</Text>}
      <Text style={styles.paperSection}>Signature</Text>
      <View style={styles.sigBox}>
        {doc.signature ? (
          <Svg width="100%" height={70} viewBox="0 0 520 160" preserveAspectRatio="xMinYMid meet">
            <Path d={doc.signature} stroke={colors.txt} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : (
          <Text style={[styles.docKey, { paddingVertical: 24, textAlign: 'center' }]}>{doc.signedDate ? `${doc.signer} (digitally signed)` : 'Awaiting signature'}</Text>
        )}
      </View>
      <Text style={styles.docKey}>{doc.signer || '—'}{doc.signedDate ? ` · signed ${formatDate(doc.signedDate)}` : ''}</Text>
    </View>
  );
}

function DocRow({ k, v }: { k: string; v: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.docRow}>
      <Text style={styles.docKey}>{k}</Text>
      <Text style={styles.docVal}>{v}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    body: {
      color: colors.txt,
      fontSize: 14,
      lineHeight: 20,
    },
    subhead: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
      marginBottom: 8,
    },
    fineRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    removeBtn: {
      width: 40,
      height: 44,
      marginBottom: 8,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerGlow,
    },
    term: {
      color: colors.txt,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 6,
    },
    hint: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 8,
    },
    paper: {
      backgroundColor: '#FFFFFF',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    paperHead: {
      borderBottomWidth: 3,
      paddingBottom: 10,
      marginBottom: 6,
    },
    paperBrand: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    paperTitle: {
      color: colors.txt,
      fontSize: 18,
      fontWeight: '800',
      marginVertical: 2,
    },
    paperSection: {
      color: colors.txt,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 4,
    },
    docRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 3,
    },
    docKey: {
      color: colors.muted,
      fontSize: 12,
      flexShrink: 1,
    },
    docVal: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'right',
      flexShrink: 1,
    },
    sigBox: {
      borderBottomWidth: 1,
      borderBottomColor: colors.lineStrong,
      marginBottom: 4,
    },
  });
