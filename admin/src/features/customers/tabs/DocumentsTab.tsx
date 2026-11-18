import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Camera, CheckCircle2, FilePlus2, ScanFace, ScanLine } from 'lucide-react-native';
import { Avatar, Badge, Button, Card, ChipGroup, ConfirmDialog, DocumentSlot, EmptyState, Field, FormSheet, Grid, Section, SimulatedNote, StatusBadge } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate } from '../../../lib/format';
import type { ActivityInput } from '../../../services/customers';
import { useThemeColors, useThemedStyles } from '../../../theme';
import type { Customer, CustomerDocument, VerificationStatus } from '../../../types';
import { makeStyles } from '../shared';

const DOC_KINDS: readonly CustomerDocument['kind'][] = ['ID card', 'Driving licence', 'Address proof', 'Photo', 'Other'];
const FACE_MATCH_MS = 1500;

function FaceFrame({ status }: { status: VerificationStatus }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const tint = status === 'Verified' ? colors.success : status === 'Pending' ? colors.warmText : status === 'Rejected' ? colors.danger : colors.secondaryText;
  const corner = { position: 'absolute' as const, width: 26, height: 26, borderColor: tint };
  return (
    <View style={styles.faceFrame} accessibilityLabel={`Face verification frame, status ${status}`}>
      <View style={[corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 }]} />
      <View style={[corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 }]} />
      <View style={[corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 }]} />
      <View style={[corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 }]} />
      <View style={[styles.faceOval, { borderColor: tint }]}>
        {/* eyes + mouth hint */}
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 38 }}>
          <View style={[styles.faceDot, { backgroundColor: tint }]} />
          <View style={[styles.faceDot, { backgroundColor: tint }]} />
        </View>
        <View style={[styles.faceMouth, { borderColor: tint }]} />
      </View>
      {status === 'Pending' ? <View style={[styles.scanLine, { backgroundColor: colors.highlight }]} /> : null}
      {status === 'Verified' ? (
        <View style={[styles.faceCheck, { backgroundColor: colors.card }]}>
          <CheckCircle2 size={22} color={colors.success} />
        </View>
      ) : null}
    </View>
  );
}

type Review = { title: string; message: string; status: VerificationStatus; apply: () => void };

export function DocumentsTab({ customer: c, applyChange }: { customer: Customer; applyChange: (patch: Partial<Customer>, entries: ActivityInput[]) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isPhone } = useResponsive();
  const { today, showToast } = useApp();
  const [docSheet, setDocSheet] = useState(false);
  const [docName, setDocName] = useState('');
  const [docKind, setDocKind] = useState<CustomerDocument['kind']>('Other');
  const [docError, setDocError] = useState<string>();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  const setIdStatus = (status: VerificationStatus, action: string, msg: string) => {
    applyChange(
      { idCardStatus: status, documents: c.documents.map((doc) => (doc.kind === 'ID card' ? { ...doc, status, uploadedAt: today } : doc)) },
      [{ action, field: 'ID card', previous: c.idCardStatus, next: status }]
    );
    showToast(msg);
  };

  const startFaceMatch = () => {
    if (!c.photoCaptured) {
      showToast('Capture the customer photo first');
      return;
    }
    const previous = c.faceVerification;
    applyChange({ faceVerification: 'Pending' }, [{ action: 'Face match started', field: 'Face match', previous, next: 'Pending' }]);
    showToast('Face match started (simulated)');
    // Not cancelled on unmount: the result belongs to the customer, whichever tab is open by then
    setTimeout(() => {
      applyChange({ faceVerification: 'Verified' }, [{ action: 'Face match completed (simulated)', field: 'Face match', previous: 'Pending', next: 'Verified' }]);
      showToast('Face matched with ID photo (simulated)');
    }, FACE_MATCH_MS);
  };

  const togglePhoto = () => {
    const next = !c.photoCaptured;
    applyChange({ photoCaptured: next, faceVerification: next ? c.faceVerification : 'Not uploaded' }, [
      { action: next ? 'Photo captured (simulated)' : 'Photo cleared', field: 'Customer photo', previous: c.photoCaptured ? 'On file' : 'None', next: next ? 'On file' : 'None' },
    ]);
    showToast(next ? 'Photo captured (simulated)' : 'Photo cleared · capture again');
  };

  const uploadDoc = (doc: CustomerDocument, verb: 'uploaded' | 'scanned') => {
    applyChange(
      {
        documents: c.documents.map((x) => (x.id === doc.id ? { ...x, status: 'Pending' as const, uploadedAt: today } : x)),
        ...(doc.kind === 'ID card' ? { idCardStatus: 'Pending' as const } : {}),
      },
      [{ action: `Document ${verb} (simulated)`, field: doc.name, previous: doc.status, next: 'Pending' }]
    );
    showToast(`Document ${verb} (simulated) · pending verification`);
  };

  const reviewDoc = (doc: CustomerDocument, status: VerificationStatus) =>
    setReview({
      title: `${status === 'Verified' ? 'Verify' : 'Reject'} this document?`,
      message: `${doc.name} will be marked as ${status.toLowerCase()}.`,
      status,
      apply: () =>
        applyChange(
          {
            documents: c.documents.map((x) => (x.id === doc.id ? { ...x, status } : x)),
            ...(doc.kind === 'ID card' ? { idCardStatus: status } : {}),
          },
          [{ action: 'Document reviewed', field: doc.name, previous: doc.status, next: status }]
        ),
    });

  const closeDocSheet = () => {
    setDocSheet(false);
    setDocName('');
    setDocKind('Other');
    setDocError(undefined);
  };
  const addDocument = () => {
    if (!docName.trim()) {
      setDocError('Enter the document name');
      return;
    }
    applyChange({ documents: [...c.documents, { id: `doc-${Date.now()}`, name: docName.trim(), kind: docKind, status: 'Pending', uploadedAt: today }] }, [
      { action: 'Document added (simulated)', field: docName.trim(), previous: '—', next: 'Pending' },
    ]);
    closeDocSheet();
    showToast('Document added (simulated upload) · pending verification');
  };

  return (
    <View>
      <Section title="Photo & face verification" subtitle="Customer photo is matched against the ID card photo" style={{ marginTop: 0 }}>
        <Grid cols={isPhone ? 1 : 2}>
          <Card style={{ alignItems: 'center', gap: 10, minHeight: 250 }}>
            <Text style={styles.cardTitle}>Customer photo</Text>
            <View style={[styles.photoCircle, c.photoCaptured && { borderStyle: 'solid', borderColor: colors.secondary, backgroundColor: colors.secondarySoft }]}>
              {c.photoCaptured ? <Avatar name={c.name} bg={c.avatarBg} size={104} /> : <Camera size={32} color={colors.muted} />}
            </View>
            <Badge label={c.photoCaptured ? 'Photo on file' : 'No photo'} tone={c.photoCaptured ? 'success' : 'neutral'} />
            <Button label={c.photoCaptured ? 'Retake photo' : 'Capture photo'} variant="outline" size="sm" disabled={c.faceVerification === 'Pending'} icon={(col) => <Camera size={14} color={col} />} onPress={togglePhoto} />
          </Card>
          <Card style={{ alignItems: 'center', gap: 10, minHeight: 250 }}>
            <Text style={styles.cardTitle}>Face verification</Text>
            <FaceFrame status={c.faceVerification} />
            <StatusBadge status={c.faceVerification} />
            <Button
              label={c.faceVerification === 'Pending' ? 'Matching…' : c.faceVerification === 'Verified' ? 'Run again' : 'Start face match'}
              size="sm"
              disabled={c.faceVerification === 'Pending'}
              icon={(col) => <ScanFace size={14} color={col} />}
              onPress={startFaceMatch}
            />
          </Card>
        </Grid>
        <SimulatedNote>Camera and face matching are simulated: no image is captured or sent. The ID verification provider integration is pending.</SimulatedNote>
      </Section>

      <Section title="Identity (ID card)">
        <Card style={{ gap: 12 }}>
          <DocumentSlot
            title="Government ID card"
            subtitle="Aadhaar, passport or voter ID: front and back"
            status={c.idCardStatus}
            onUpload={() => setIdStatus('Pending', 'ID card uploaded (simulated)', 'ID card uploaded (simulated) · pending verification')}
            onScan={() => setScannerOpen((s) => !s)}
          />
          {scannerOpen ? (
            <View style={styles.scanner}>
              <View style={styles.scanCard}>
                <ScanLine size={28} color={colors.secondaryText} />
                <Text style={styles.sub}>Align the ID card inside the frame</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  label="Capture scan"
                  size="sm"
                  icon={(col) => <ScanLine size={14} color={col} />}
                  onPress={() => {
                    setScannerOpen(false);
                    setIdStatus('Pending', 'ID card scanned (simulated)', 'ID scanned (simulated) · pending verification');
                  }}
                />
                <Button label="Cancel" variant="ghost" size="sm" onPress={() => setScannerOpen(false)} />
              </View>
            </View>
          ) : null}
          {c.idCardStatus === 'Pending' ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                label="Mark ID verified"
                variant="secondary"
                size="sm"
                icon={(col) => <CheckCircle2 size={14} color={col} />}
                onPress={() =>
                  setReview({
                    title: 'Mark ID card as verified?',
                    message: `Confirm you have checked ${c.name}'s ID card.`,
                    status: 'Verified',
                    apply: () => setIdStatus('Verified', 'KYC reviewed', 'ID card marked as verified'),
                  })
                }
              />
              <Button
                label="Reject"
                variant="danger"
                size="sm"
                onPress={() =>
                  setReview({
                    title: 'Reject this ID card?',
                    message: 'The customer will need to upload it again.',
                    status: 'Rejected',
                    apply: () => setIdStatus('Rejected', 'KYC reviewed', 'ID card rejected · ask the customer to re-upload'),
                  })
                }
              />
            </View>
          ) : null}
          <SimulatedNote>Upload and scanning are simulated: no file is stored. ID verification integration is pending.</SimulatedNote>
        </Card>
      </Section>

      <Section
        title="Documents"
        subtitle={`${c.documents.length} on file`}
        action={<Button label="Add document" variant="outline" size="sm" icon={(col) => <FilePlus2 size={14} color={col} />} onPress={() => setDocSheet(true)} />}>
        <Card style={{ gap: 10 }}>
          {c.documents.length === 0 ? (
            <EmptyState compact title="No documents" message="Add the ID card, licence and address proof." />
          ) : (
            c.documents.map((doc) => (
              <View key={doc.id}>
                <DocumentSlot
                  title={doc.name}
                  subtitle={`${doc.kind}${doc.uploadedAt ? ` · uploaded ${formatDate(doc.uploadedAt)}` : ''}`}
                  status={doc.status}
                  onUpload={() => uploadDoc(doc, 'uploaded')}
                  onScan={() => uploadDoc(doc, 'scanned')}
                />
                {doc.status === 'Pending' ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <Button label="Verify" variant="ghost" size="sm" icon={(col) => <CheckCircle2 size={14} color={col} />} onPress={() => reviewDoc(doc, 'Verified')} />
                    <Button label="Reject" variant="ghost" size="sm" onPress={() => reviewDoc(doc, 'Rejected')} />
                  </View>
                ) : null}
              </View>
            ))
          )}
        </Card>
      </Section>

      <FormSheet
        visible={docSheet}
        title="Add document"
        onClose={closeDocSheet}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={closeDocSheet} />
            <Button label="Add (simulated upload)" icon={(col) => <FilePlus2 size={14} color={col} />} onPress={addDocument} />
          </>
        }>
        <Field
          label="Document name"
          required
          value={docName}
          onChangeText={(t) => {
            setDocName(t);
            setDocError(undefined);
          }}
          placeholder="e.g. Passport (front page)"
          error={docError}
        />
        <Text style={styles.fieldLabel}>Type</Text>
        <ChipGroup options={DOC_KINDS} value={docKind} onChange={setDocKind} />
        <SimulatedNote>No file is uploaded: the document is recorded as pending verification.</SimulatedNote>
      </FormSheet>

      <ConfirmDialog
        visible={review !== null}
        title={review?.title ?? ''}
        message={review?.message}
        confirmLabel={review?.status === 'Rejected' ? 'Reject' : 'Verify'}
        danger={review?.status === 'Rejected'}
        onConfirm={() => {
          review?.apply();
          setReview(null);
        }}
        onCancel={() => setReview(null)}
      />
    </View>
  );
}
