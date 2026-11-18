import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Download, FileText } from 'lucide-react-native';
import { useApp } from '../../../context/AppContext';
import { boxShadow, useThemeColors, useThemedStyles, type ThemeColors } from '../../../theme';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  FormSheet,
  PageHeader,
  Screen,
  Section,
  SignaturePad,
  SimulatedNote,
  SplitView,
  StatusBadge,
} from '../../../components/kit';
import { AgreementFine, Booking } from '../../../types';
import { formatDate, formatINR } from '../../../lib/format';

const TERMS = [
  'The vehicle must be returned at the agreed date, time and location with the same fuel/charge level as at pickup.',
  'FASTag toll charges incurred during the rental are billed to the customer and may be deducted from the security deposit.',
  'The customer is responsible for traffic violations and challans during the rental period.',
  'The vehicle must not be used for racing, towing, commercial ride-hailing or driven by anyone not listed on this agreement.',
  'Damage beyond the pickup inspection record is assessed at return and charged as per the inspection report.',
  'The security deposit is refunded within 48 hours of return after deducting applicable charges.',
  'Speed limits and all applicable laws of India must be followed at all times.',
];

export default function AgreementScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = decodeURIComponent(id ?? '');
  const { bookings, agreements, signAgreement, showToast, currentCustomerId, standardFines } = useApp();
  const booking = bookings.find((b) => b.id === bookingId && b.customerId === currentCustomerId);
  const existing = agreements.find((a) => a.bookingId === bookingId);

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

  const fines = existing?.fines ?? standardFines;
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
    : { deposit: booking.depositAmount, discount: booking.discount, fines, signer, signature, signedDate: undefined as string | undefined };

  const onSign = () => {
    signAgreement(booking.id, { signaturePath: signature, signedBy: signer.trim() });
    router.replace(`/rental/${encodeURIComponent(booking.id)}` as any);
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
                <Button label="Back to rental" variant="ghost" onPress={() => router.replace(`/rental/${encodeURIComponent(booking.id)}` as any)} />
              </Card>
            </Section>
          ) : (
            <View>
              <Section title="Charges" subtitle="Set by KeyGo for this booking" style={{ marginTop: 16 }}>
                <Card>
                  <Text style={styles.term}>Refundable security deposit: {formatINR(booking.depositAmount)}</Text>
                  {booking.discount ? <Text style={styles.term}>Discount applied: {formatINR(booking.discount)}</Text> : null}
                  <Text style={styles.subhead}>Fines & penalties</Text>
                  {fines.map((f) => (
                    <Text key={f.id} style={styles.term}>
                      {f.label}: {formatINR(f.amount)}
                    </Text>
                  ))}
                </Card>
              </Section>

              <Section title="Terms & conditions">
                <Card>
                  {TERMS.map((t, i) => (
                    <Text key={i} style={styles.term}>
                      {i + 1}. {t}
                    </Text>
                  ))}
                  <View style={{ marginTop: 8 }}>
                    <Checkbox label="I have read and accept the terms & conditions." checked={accepted} onChange={setAccepted} />
                    <Checkbox label={`I accept the ${formatINR(booking.depositAmount)} security deposit and listed fines.`} checked={depositAccepted} onChange={setDepositAccepted} />
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

interface DocData {
  deposit: number;
  discount: number;
  fines: AgreementFine[];
  signer: string;
  signature: string;
  signedDate?: string;
}

/** Paper-style contract preview. */
function AgreementDocument({ booking, doc }: { booking: Booking; doc: DocData }) {
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
      ...boxShadow(colors.shadow, { y: 4, blur: 12, opacity: 0.08 }),
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
