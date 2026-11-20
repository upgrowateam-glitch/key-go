import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { CheckCircle2, FileText, Plus, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, DocumentSlot, Field, FormSheet, Grid, KeyValueGrid, Section, SimulatedNote } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { deleteFile, openFile, uploadFile } from '../../../lib/api';
import { DOCUMENT_ACCEPT, documentFileProblem, formatBytes, pickFile } from '../../../lib/filePicker';
import { formatDate } from '../../../lib/format';
import { addVehicleDocument, documentsOf, FleetExtras, removeVehicleDocument, saveVehicleDocument, VehicleDocument } from '../../../services/fleet';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Vehicle, VerificationStatus } from '../../../types';
import { makeStyles } from '../detailStyles';
import { expiryFlag, ISO_DATE } from '../shared';
import { ExpiryMeter } from '../ui';

type RenewKind = 'insurance' | 'puc';

export function DocumentsTab({ v, extras, onChanged }: { v: Vehicle; extras: FleetExtras; onChanged: () => void }) {
  const { today, showToast } = useApp();
  const { cols } = useResponsive();
  const [renewing, setRenewing] = useState<RenewKind | null>(null);
  const [review, setReview] = useState<{ doc: VehicleDocument; status: VerificationStatus } | null>(null);
  const [editing, setEditing] = useState<VehicleDocument | 'new' | null>(null);
  const [removing, setRemoving] = useState<VehicleDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isSold = v.status === 'Sold';
  const docs = documentsOf(extras, v.id);

  const upload = async (doc: VehicleDocument) => {
    const file = await pickFile(DOCUMENT_ACCEPT);
    if (!file) return;
    const problem = documentFileProblem(file);
    if (problem) {
      showToast(problem);
      return;
    }
    setBusyId(doc.id);
    try {
      const stored = await uploadFile(file);
      const replaced = doc.file?.key;
      saveVehicleDocument(v.id, doc.id, {
        status: 'Pending',
        uploadedAt: today,
        file: { key: stored.id, name: stored.name, type: stored.type, size: stored.size },
      });
      if (replaced) deleteFile(replaced).catch(() => undefined);
      onChanged();
      showToast(`${doc.name} uploaded · pending verification`);
    } catch (e) {
      showToast(`The file could not be uploaded: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const view = async (doc: VehicleDocument) => {
    if (!doc.file) return;
    try {
      const opened = await openFile(doc.file.key);
      if (!opened) showToast('The stored file was not found on the server. Upload it again.');
    } catch {
      showToast('The stored file could not be opened');
    }
  };

  const confirmRemove = async () => {
    const doc = removing;
    setRemoving(null);
    if (!doc) return;
    setBusyId(doc.id);
    try {
      if (doc.file) await deleteFile(doc.file.key);
      if (doc.custom) removeVehicleDocument(v.id, doc.id);
      else saveVehicleDocument(v.id, doc.id, { status: 'Not uploaded', uploadedAt: undefined, file: undefined });
      onChanged();
      showToast(doc.custom ? `${doc.name} removed` : `${doc.name} file removed`);
    } catch {
      showToast('The file could not be removed');
    } finally {
      setBusyId(null);
    }
  };

  const slotSubtitle = (doc: VehicleDocument) => {
    const parts = [doc.reference];
    if (doc.expiry) parts.push(`expires ${formatDate(doc.expiry)}`);
    if (doc.uploadedAt) parts.push(`uploaded ${formatDate(doc.uploadedAt)}`);
    return parts.join(' · ');
  };

  return (
    <View>
      <Grid cols={cols(1, 2, 2)}>
        <DocCard
          title="Insurance"
          icon={(c) => <ShieldCheck size={18} color={c} />}
          items={[
            { label: 'Provider', value: v.insuranceProvider },
            { label: 'Policy no.', value: v.insurancePolicyNo },
            { label: 'Expiry', value: formatDate(v.insuranceExpiry) },
          ]}
          flag={isSold ? null : expiryFlag(v.insuranceExpiry, today)}
          expiry={isSold ? undefined : v.insuranceExpiry}
          today={today}
          onRenew={isSold ? undefined : () => setRenewing('insurance')}
        />
        <DocCard
          title="Pollution under control (PUC)"
          icon={(c) => <FileText size={18} color={c} />}
          items={[
            { label: 'Certificate no.', value: v.pucCertificateNo },
            { label: 'Expiry', value: formatDate(v.pucExpiry) },
          ]}
          flag={isSold ? null : expiryFlag(v.pucExpiry, today)}
          expiry={isSold ? undefined : v.pucExpiry}
          today={today}
          onRenew={isSold ? undefined : () => setRenewing('puc')}
        />
      </Grid>

      <Section
        title="Registration & compliance"
        subtitle={`${docs.length} documents · ${docs.filter((d) => d.file).length} files stored`}
        action={isSold ? undefined : <Button label="Add document" variant="outline" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setEditing('new')} />}>
        <Card style={{ gap: 10 }}>
          {docs.map((doc) => {
            const flag = doc.expiry && !isSold ? expiryFlag(doc.expiry, today) : null;
            return (
              <View key={doc.id}>
                <DocumentSlot
                  title={doc.name}
                  subtitle={slotSubtitle(doc)}
                  meta={doc.file ? `${doc.file.name} · ${formatBytes(doc.file.size)}` : undefined}
                  status={doc.status}
                  busy={busyId === doc.id}
                  onView={doc.file ? () => view(doc) : undefined}
                  onUpload={isSold ? undefined : () => upload(doc)}
                  onRemove={isSold || !(doc.file || doc.custom) ? undefined : () => setRemoving(doc)}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  {flag ? <Badge label={flag.label} tone={flag.tone} /> : null}
                  {doc.status === 'Pending' ? (
                    <>
                      <Button label="Verify" variant="ghost" size="sm" icon={(c) => <CheckCircle2 size={14} color={c} />} onPress={() => setReview({ doc, status: 'Verified' })} />
                      <Button label="Reject" variant="ghost" size="sm" onPress={() => setReview({ doc, status: 'Rejected' })} />
                    </>
                  ) : null}
                  {!isSold ? <Button label="Edit details" variant="ghost" size="sm" onPress={() => setEditing(doc)} /> : null}
                </View>
              </View>
            );
          })}
        </Card>
      </Section>
      <SimulatedNote>Files are stored on the KeyGo server and visible to all staff. Insurer and RTO integrations are pending.</SimulatedNote>

      {renewing ? <RenewSheet v={v} kind={renewing} onClose={() => setRenewing(null)} /> : null}
      {editing ? (
        <DocumentDetailsSheet
          vehicleId={v.id}
          doc={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            onChanged();
            showToast(message);
          }}
        />
      ) : null}
      <ConfirmDialog
        visible={review !== null}
        title={review?.status === 'Verified' ? 'Verify this document?' : 'Reject this document?'}
        message={review ? `${review.doc.name} will be marked as ${review.status.toLowerCase()}.` : undefined}
        confirmLabel={review?.status === 'Verified' ? 'Verify' : 'Reject'}
        danger={review?.status === 'Rejected'}
        onConfirm={() => {
          if (review) {
            saveVehicleDocument(v.id, review.doc.id, { status: review.status });
            onChanged();
            showToast(`${review.doc.name} ${review.status.toLowerCase()}`);
          }
          setReview(null);
        }}
        onCancel={() => setReview(null)}
      />
      <ConfirmDialog
        visible={removing !== null}
        title={removing?.custom ? 'Remove this document?' : 'Remove the stored file?'}
        message={
          removing
            ? removing.custom
              ? `${removing.name} and its stored file will be deleted.`
              : `The stored file for ${removing.name} will be deleted. The document slot stays and can be uploaded again.`
            : undefined
        }
        confirmLabel="Remove"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}

/** Add a document slot, or edit the name, reference and expiry of an existing one. */
function DocumentDetailsSheet({ vehicleId, doc, onClose, onSaved }: { vehicleId: string; doc: VehicleDocument | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState(doc?.name ?? '');
  const [reference, setReference] = useState(doc && doc.reference !== 'Not recorded' ? doc.reference : '');
  const [expiry, setExpiry] = useState(doc?.expiry ?? '');
  const [errors, setErrors] = useState<{ name?: string; reference?: string; expiry?: string }>({});
  const canRename = !doc || doc.custom;

  const submit = () => {
    const e: typeof errors = {};
    if (canRename && !name.trim()) e.name = 'Enter the document name';
    if (!reference.trim()) e.reference = 'Enter the document or certificate number';
    if (expiry.trim() && !ISO_DATE.test(expiry.trim())) e.expiry = 'Use YYYY-MM-DD, or leave empty';
    setErrors(e);
    if (Object.keys(e).length) return;
    const details = { reference: reference.trim(), expiry: expiry.trim() || undefined };
    if (doc) {
      saveVehicleDocument(vehicleId, doc.id, canRename ? { ...details, name: name.trim() } : details);
      onSaved(`${canRename ? name.trim() : doc.name} details saved`);
    } else {
      addVehicleDocument(vehicleId, { name: name.trim(), ...details });
      onSaved(`${name.trim()} added · upload the file when ready`);
    }
    onClose();
  };

  return (
    <FormSheet
      visible
      title={doc ? 'Edit document details' : 'Add document'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} />
          <Button label={doc ? 'Save details' : 'Add document'} onPress={submit} />
        </>
      }>
      <Field
        label="Document name"
        required
        value={name}
        onChangeText={setName}
        editable={canRename}
        placeholder="e.g. State permit, Loan NOC"
        error={errors.name}
        hint={canRename ? undefined : 'Standard checklist documents keep their name.'}
      />
      <Field label="Reference / certificate no." required value={reference} onChangeText={setReference} error={errors.reference} />
      <Field label="Expiry" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD (optional)" error={errors.expiry} />
    </FormSheet>
  );
}

function RenewSheet({ v, kind, onClose }: { v: Vehicle; kind: RenewKind; onClose: () => void }) {
  const { today, updateVehicle, showToast } = useApp();
  const isInsurance = kind === 'insurance';
  const [provider, setProvider] = useState(v.insuranceProvider);
  const [reference, setReference] = useState(isInsurance ? v.insurancePolicyNo : v.pucCertificateNo);
  const [expiry, setExpiry] = useState('');
  const [errors, setErrors] = useState<{ reference?: string; expiry?: string }>({});

  const submit = () => {
    const e: typeof errors = {};
    if (!reference.trim()) e.reference = isInsurance ? 'Enter the policy number' : 'Enter the certificate number';
    if (!ISO_DATE.test(expiry)) e.expiry = 'Use YYYY-MM-DD';
    else if (expiry <= today) e.expiry = 'The new expiry must be in the future';
    setErrors(e);
    if (Object.keys(e).length) return;
    updateVehicle(
      v.id,
      isInsurance
        ? { insuranceProvider: provider.trim() || v.insuranceProvider, insurancePolicyNo: reference.trim(), insuranceExpiry: expiry }
        : { pucCertificateNo: reference.trim(), pucExpiry: expiry }
    );
    showToast(`${isInsurance ? 'Insurance' : 'PUC'} renewal recorded`);
    onClose();
  };

  return (
    <FormSheet
      visible
      title={isInsurance ? 'Renew insurance' : 'Renew PUC'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} />
          <Button label="Save renewal" onPress={submit} />
        </>
      }>
      {isInsurance ? <Field label="Provider" value={provider} onChangeText={setProvider} /> : null}
      <Field label={isInsurance ? 'Policy no.' : 'Certificate no.'} required value={reference} onChangeText={setReference} error={errors.reference} />
      <Field label="New expiry" required value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" error={errors.expiry} />
      <SimulatedNote>This records the renewal details here only. Insurer and RTO integrations are pending.</SimulatedNote>
    </FormSheet>
  );
}

function DocCard({
  title,
  icon,
  items,
  flag,
  expiry,
  today,
  onRenew,
}: {
  title: string;
  icon: (c: string) => React.ReactNode;
  items: { label: string; value: string }[];
  flag: ReturnType<typeof expiryFlag>;
  /** Shown as a "days left" bar. */
  expiry?: string;
  today: string;
  onRenew?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={styles.iconBox}>{icon(colors.primaryText)}</View>
        <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>{title}</Text>
        {flag ? <Badge label={flag.label} tone={flag.tone} /> : <Badge label="Valid" tone="success" />}
      </View>
      <KeyValueGrid items={items} cols={2} />
      {onRenew ? (
        <View style={{ marginBottom: 12 }}>
          <ExpiryMeter expiry={expiry} today={today} />
        </View>
      ) : null}
      {onRenew ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button label="Renew" variant={flag ? 'primary' : 'outline'} size="sm" icon={(c) => <RefreshCw size={14} color={c} />} onPress={onRenew} />
        </View>
      ) : null}
    </Card>
  );
}
