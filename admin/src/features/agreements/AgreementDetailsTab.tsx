import { useLocalSearchParams, useRouter } from '@/shims/expo-router';
import { Download, FileCheck, FileText, Send } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import {
    Badge,
    Button,
    Card,
    ChipGroup,
    ConfirmDialog,
    Divider,
    EmptyState,
    Field,
    FormSheet,
    Grid,
    KeyValueGrid,
    Section,
    SegmentedControl,
    SimulatedNote,
    SplitView,
    StatusBadge,
    Stepper,
} from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR } from '../../lib/format';
import { ESignStatus, loadAgreementDetail, logAgreementActivity, sendForESign, setESignStatus } from '../../services/agreements';
import { useResource } from '../../services/mockClient';
import type { Agreement, Booking } from '../../types';
import { AgreementDocument, DocData } from '../rental/AgreementScreen';
import { downloadFile, useCommonStyles } from './listTools';

const CHANNELS = ['WhatsApp', 'SMS', 'Email'] as const;
type Channel = (typeof CHANNELS)[number];
const ESIGN_STEPS = [
  { key: 'draft', label: 'Prepared' },
  { key: 'sent', label: 'Sent to customer' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'signed', label: 'E-signed' },
];

const docFor = (a: Agreement): DocData => ({
  deposit: a.securityDeposit,
  discount: a.discount,
  fines: a.fines,
  signer: a.signaturePreview.replace(' (Digitally Signed)', ''),
  signature: a.signaturePath ?? '',
  signedDate: a.signedDate,
});

function agreementText(a: Agreement, b: Booking | undefined) {
  return [
    'KeyGo Car Rentals: Vehicle Rental Agreement',
    `Agreement: ${a.id}`,
    `Booking: ${a.bookingId}`,
    `Customer: ${a.customerName}${b ? ` (${b.customerPhone})` : ''}`,
    `Vehicle: ${b ? `${b.vehicleName} ` : ''}${a.vehicleNumber}`,
    b ? `Rental period: ${b.pickupDate} ${b.pickupTime} to ${b.returnDate} ${b.returnTime}` : '',
    `Rental amount: Rs ${a.rentalAmount}`,
    `Security deposit: Rs ${a.securityDeposit}`,
    `Discount: Rs ${a.discount}`,
    'Fines and penalties:',
    ...(a.fines.length ? a.fines.map((f) => `  ${f.label}: Rs ${f.amount}`) : ['  None']),
    `Signature: ${a.signaturePreview || 'Not signed'} on ${a.signedDate}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function AgreementDetailsTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { isPhone } = useResponsive();
  const params = useLocalSearchParams<{ id?: string }>();
  const { agreements, bookings, showToast } = useApp();
  const detail = useResource(loadAgreementDetail);

  const [preview, setPreview] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState<string>();
  const [pendingStatus, setPendingStatus] = useState<ESignStatus | null>(null);

  const agreement = agreements.find((a) => a.id === params.id) ?? agreements[0];

  if (agreements.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No agreements yet"
          message="Agreements are created from confirmed bookings."
          icon={(c) => <FileCheck size={22} color={c} />}
          action={<Button label="View agreement list" variant="outline" size="sm" onPress={() => router.replace('/agreements?tab=agreement-list')} />}
        />
      </Card>
    );
  }
  if (detail.error || (detail.loading && !detail.data)) {
    return <ResourceState loading={detail.loading} error={detail.error} onRetry={detail.reload} />;
  }
  if (!detail.data) return null;

  const a = agreement;
  const b = bookings.find((x) => x.id === a.bookingId);
  const data = detail.data;
  const request = data.esign.find((e) => e.agreementId === a.id);
  const signedOnDevice = !request && !!a.signaturePreview;
  const stepCurrent = !request ? (signedOnDevice ? ESIGN_STEPS.length : 1) : request.status === 'Sent' ? 2 : request.status === 'Viewed' ? 3 : ESIGN_STEPS.length;
  const appliedTotal = data.applied.filter((d) => d.agreementId === a.id).reduce((s, d) => s + d.amount, 0);
  const released = data.deposits.filter((d) => d.agreementId === a.id).reduce((s, d) => s + d.amount, 0);
  const fines = data.assessed.filter((f) => f.agreementId === a.id);
  const history = data.activity.filter((x) => x.agreementId === a.id);
  const fail = (e: Error) => showToast(e.message);

  const openSend = () => {
    setChannel('WhatsApp');
    setRecipient(b?.customerPhone ?? '');
    setRecipientError(undefined);
    setSendOpen(true);
  };
  const submitSend = () => {
    const value = recipient.trim();
    const valid = channel === 'Email' ? /^\S+@\S+\.\S+$/.test(value) : value.replace(/\D/g, '').length >= 10;
    if (!valid) {
      setRecipientError(channel === 'Email' ? 'Enter a valid email address' : 'Enter a 10-digit phone number');
      return;
    }
    sendForESign({ agreementId: a.id, channel, recipient: value }).then((d) => {
      detail.setData(d);
      setSendOpen(false);
      showToast('E-signature request queued (simulated)');
    }, fail);
  };
  const confirmStatus = () => {
    if (!pendingStatus) return;
    setESignStatus(a.id, pendingStatus).then(detail.setData, fail);
    setPendingStatus(null);
  };
  const download = () => {
    downloadFile(`${a.id}.txt`, agreementText(a, b));
    logAgreementActivity(a.id, 'Agreement copy downloaded').then(detail.setData, fail);
    showToast('Saved a text copy. PDF output is pending the backend.');
  };

  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>Agreement</Text>
        <ChipGroup
          options={agreements.map((x) => x.id)}
          value={a.id}
          onChange={(id) => router.replace(`/agreements?tab=agreement-details&id=${encodeURIComponent(id)}`)}
          scroll={isPhone || agreements.length > 6}
        />
      </View>

      <SplitView
        sideWidth={480}
        main={
          <View>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <Text style={styles.cardTitle}>{a.id}</Text>
                  <Text style={styles.sub}>
                    {a.customerName} · {b?.vehicleName ? `${b.vehicleName} · ` : ''}
                    {a.vehicleNumber}
                  </Text>
                </View>
                <StatusBadge status={a.status} />
              </View>
              <KeyValueGrid
                cols={2}
                items={[
                  { label: 'Booking', value: a.bookingId },
                  { label: 'Signed on', value: formatDate(a.signedDate) },
                  { label: 'Rental amount', value: formatINR(a.rentalAmount) },
                  { label: 'Security deposit', value: formatINR(a.securityDeposit) },
                  { label: 'Deposit still held', value: formatINR(Math.max(0, a.securityDeposit - released)) },
                  { label: 'Discounts', value: a.discount + appliedTotal ? formatINR(a.discount + appliedTotal) : '—' },
                ]}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button label="Preview PDF" variant="outline" size="sm" icon={(c) => <FileText size={14} color={c} />} onPress={() => setPreview(true)} />
                <Button label="Download PDF" variant="outline" size="sm" icon={(c) => <Download size={14} color={c} />} onPress={download} />
                <Button label="Open booking" variant="ghost" size="sm" onPress={() => router.push(`/bookings/${encodeURIComponent(a.bookingId)}`)} />
                <Button label="Open signing page" variant="ghost" size="sm" onPress={() => router.push(`/bookings/${encodeURIComponent(a.bookingId)}/agreement`)} />
              </View>
            </Card>

            <Section title="E-signature" subtitle={signedOnDevice ? `Signed on device: ${a.signaturePreview}` : request ? `Sent by ${request.channel} to ${request.recipient}` : 'Not yet signed'}>
              <Stepper steps={ESIGN_STEPS} current={stepCurrent} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <Button label={request ? 'Resend request' : 'Send for e-signature'} size="sm" icon={(c) => <Send size={14} color={c} />} onPress={openSend} />
                {request?.status === 'Sent' ? <Button label="Mark viewed" size="sm" variant="outline" onPress={() => setPendingStatus('Viewed')} /> : null}
                {request && request.status !== 'Signed' ? <Button label="Mark e-signed" size="sm" variant="outline" onPress={() => setPendingStatus('Signed')} /> : null}
              </View>
              <SimulatedNote>Digital signature is captured on-device. Aadhaar eSign integration is pending, so status changes here are recorded by hand.</SimulatedNote>
            </Section>

            <Section title="Fines on this agreement" subtitle={`${a.fines.length} on the fine schedule · ${fines.length} assessed`}>
              <Card>
                {a.fines.length === 0 && fines.length === 0 ? (
                  <EmptyState compact title="No fines" message="Assess a fine from the Fines & Penalties tab." />
                ) : (
                  <View style={{ gap: 8 }}>
                    {a.fines.map((f) => (
                      <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Badge label="Schedule" tone="neutral" />
                        <Text style={[styles.body, { flex: 1 }]}>{f.label}</Text>
                        <Text style={styles.strong}>{formatINR(f.amount)}</Text>
                      </View>
                    ))}
                    {fines.length && a.fines.length ? <Divider style={{ marginVertical: 4 }} /> : null}
                    {fines.map((f) => (
                      <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Badge label={f.status} tone={f.status === 'Pending' ? 'warning' : f.status === 'Collected' ? 'success' : 'neutral'} />
                        <Text style={[styles.body, { flex: 1 }]}>{f.label}</Text>
                        <Text style={styles.strong}>{formatINR(f.amount)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </Section>

            <Section title="Activity">
              <Card>
                {history.length === 0 ? (
                  <EmptyState compact title="No activity yet" message="Changes made in this session are listed here." />
                ) : (
                  <Grid cols={1} gap={8}>
                    {history.map((x) => (
                      <View key={x.id}>
                        <Text style={styles.body}>{x.text}</Text>
                        <Text style={styles.sub}>{formatDate(x.date)}</Text>
                      </View>
                    ))}
                  </Grid>
                )}
              </Card>
            </Section>
          </View>
        }
        side={
          <Section title="Agreement preview" style={{ marginTop: 0 }}>
            {b ? <AgreementDocument booking={b} doc={docFor(a)} /> : <EmptyState compact title="Booking not found" message={`Booking ${a.bookingId} is not available.`} />}
          </Section>
        }
      />

      <FormSheet visible={preview} title="PDF preview" onClose={() => setPreview(false)} footer={<Button label="Download PDF" onPress={download} />}>
        {b ? <AgreementDocument booking={b} doc={docFor(a)} /> : <EmptyState compact title="Booking not found" />}
        <SimulatedNote>PDF generation will be provided by the backend. Download saves a text copy for now.</SimulatedNote>
      </FormSheet>

      <FormSheet
        visible={sendOpen}
        title="Send for e-signature"
        onClose={() => setSendOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setSendOpen(false)} />
            <Button label="Send request" onPress={submitSend} />
          </>
        }>
        <Text style={styles.label}>Channel</Text>
        <SegmentedControl
          options={CHANNELS}
          value={channel}
          onChange={(c) => {
            setChannel(c);
            setRecipient(c === 'Email' ? '' : (b?.customerPhone ?? ''));
            setRecipientError(undefined);
          }}
          style={{ marginBottom: 14 }}
        />
        <Field
          label={channel === 'Email' ? 'Email address' : 'Phone number'}
          required
          value={recipient}
          onChangeText={(t) => {
            setRecipient(t);
            setRecipientError(undefined);
          }}
          error={recipientError}
        />
        <SimulatedNote>Nothing is sent. Real e-sign delivery is pending integration.</SimulatedNote>
      </FormSheet>

      <ConfirmDialog
        visible={!!pendingStatus}
        title={pendingStatus === 'Signed' ? 'Mark as e-signed?' : 'Mark as viewed?'}
        message={`This records the e-signature status of ${a.id} by hand, because the e-sign provider is not connected yet.`}
        confirmLabel={pendingStatus === 'Signed' ? 'Mark e-signed' : 'Mark viewed'}
        onConfirm={confirmStatus}
        onCancel={() => setPendingStatus(null)}
      />
    </View>
  );
}
