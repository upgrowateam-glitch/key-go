import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Text, View } from 'react-native';
import QRCode from 'qrcode';
import { Camera, CheckCircle2, Eye, FileText, ImagePlus, Lock, Smartphone, Trash2, XCircle } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, Field, FormSheet, Grid, StatusBadge } from '../../components/kit';
import { PhotoEditor } from '../../components/portal/PhotoEditor';
import { WebcamCapture } from '../../components/portal/WebcamCapture';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatBytes, pickFile, PHOTO_MAX_INPUT_BYTES } from '../../lib/filePicker';
import { formatDate } from '../../lib/format';
import { closeIdentityLink, deleteIdentity, openIdentity, openIdentityLink, reviewIdentity, uploadIdentity, type OwnerType } from '../../services/identity';
import { useThemeColors } from '../../theme';
import type { IdentityDoc } from '../../types';
import type { IdentityState, SlotDef } from './useIdentity';

const MAX_BYTES = 10 * 1024 * 1024;
const VIA: Record<string, string> = { staff: 'by staff', 'staff-phone': 'by staff (phone)', 'customer-link': 'by the customer' };

/**
 * Identity documents of a customer or driver: upload (choose a file, use the camera, or a phone via QR code), crop
 * and rotate, open, verify or reject. Files are encrypted on the server; opening one is recorded in the audit log.
 */
export function IdentityPanel({ ownerType, ownerId, ownerName, slots, state, onChanged }: { ownerType: OwnerType; ownerId: string; ownerName: string; slots: SlotDef[]; state: IdentityState; onChanged: () => void }) {
  const colors = useThemeColors();
  const { cols } = useResponsive();
  const { showToast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ slot: SlotDef; file: File } | null>(null);
  const [camera, setCamera] = useState<SlotDef | null>(null);
  const [viewing, setViewing] = useState<{ doc: IdentityDoc; url: string; type: string } | null>(null);
  const [rejecting, setRejecting] = useState<IdentityDoc | null>(null);
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState<IdentityDoc | null>(null);
  const [phone, setPhone] = useState(false);
  const { data, error } = state;

  const changed = async () => {
    await state.reload();
    onChanged();
  };

  const upload = async (slot: SlotDef, file: File) => {
    if (file.size > MAX_BYTES) return showToast(`The file is ${formatBytes(file.size)}. The limit is 10 MB.`);
    setBusy(slot.kind);
    try {
      await uploadIdentity(ownerType, ownerId, slot.kind, file);
      showToast(`${slot.label} saved · waiting for review`);
      await changed();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const choose = async (slot: SlotDef) => {
    const file = await pickFile(slot.photoOnly ? 'image/*' : 'image/*,application/pdf');
    if (!file) return;
    if (file.type === 'application/pdf') return upload(slot, file);
    if (!file.type.startsWith('image/')) return showToast(slot.photoOnly ? 'Choose a photo' : 'Choose a photo or a PDF');
    if (file.size > PHOTO_MAX_INPUT_BYTES) return showToast(`That photo is ${formatBytes(file.size)}. Choose one under 40 MB.`);
    setEditing({ slot, file });
  };

  const view = async (doc: IdentityDoc) => {
    try {
      const opened = await openIdentity(doc.id);
      if (opened.type === 'application/pdf') {
        Linking.openURL(opened.url);
        return;
      }
      setViewing({ doc, ...opened });
    } catch (e) {
      showToast((e as Error).message);
    }
  };
  const closeViewer = () => {
    if (viewing) URL.revokeObjectURL(viewing.url);
    setViewing(null);
  };

  const review = async (doc: IdentityDoc, status: 'Verified' | 'Rejected', why?: string) => {
    try {
      await reviewIdentity(doc.id, status, why);
      showToast(`${doc.label} ${status === 'Verified' ? 'verified' : 'rejected'}`);
      await changed();
    } catch (e) {
      showToast((e as Error).message);
    }
  };

  if (error) return <Card><Text style={{ color: colors.danger }}>{error}</Text></Card>;
  if (!data) return <Card><ActivityIndicator color={colors.primary} /></Card>;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ color: colors.muted, fontSize: 12, flex: 1, minWidth: 220 }}>
          Files are encrypted on the server. {data.canOpen ? 'Opening a document is recorded with your name.' : 'Only Owner, Admin and Manager can open documents; you can add them and see their status.'}
        </Text>
        {data.canUpload ? <Button label="Phone (QR)" size="sm" variant="outline" icon={(c) => <Smartphone size={14} color={c} />} onPress={() => setPhone(true)} /> : null}
      </View>
      <Grid cols={cols(1, 2, 3)} gap={12}>
        {slots.map((slot) => {
          const doc = data.documents.find((d) => d.kind === slot.kind);
          return (
            <Card key={slot.kind} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '800' }}>{slot.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 2 }}>{slot.hint}</Text>
                </View>
                {busy === slot.kind ? <ActivityIndicator color={colors.primary} /> : <StatusBadge status={doc?.status ?? 'Not uploaded'} />}
              </View>
              {doc ? (
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                    {doc.mimeType === 'application/pdf' ? 'PDF' : 'Photo'} · added {formatDate(doc.uploadedAt.slice(0, 10))} {VIA[doc.uploadedVia ?? ''] ?? ''}
                    {doc.uploadedBy ? ` (${doc.uploadedBy})` : ''}
                  </Text>
                  {doc.reviewedBy ? (
                    <Text style={{ color: colors.muted, fontSize: 11.5 }}>
                      {doc.status} by {doc.reviewedBy}
                      {doc.reviewedAt ? ` on ${formatDate(doc.reviewedAt.slice(0, 10))}` : ''}
                    </Text>
                  ) : null}
                  {doc.rejectReason ? <Text style={{ color: colors.danger, fontSize: 12 }}>Reason: {doc.rejectReason}</Text> : null}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {data.canUpload ? (
                  <>
                    <Button label={doc ? 'Replace' : 'Choose'} size="sm" variant="outline" icon={(c) => <ImagePlus size={13} color={c} />} onPress={() => choose(slot)} disabled={!!busy} />
                    <Button label="Camera" size="sm" variant="outline" icon={(c) => <Camera size={13} color={c} />} onPress={() => setCamera(slot)} disabled={!!busy} />
                  </>
                ) : null}
                {doc && data.canOpen ? <Button label="Open" size="sm" variant="ghost" icon={(c) => <Eye size={13} color={c} />} onPress={() => view(doc)} /> : null}
                {doc && !data.canOpen ? <Badge label="Locked" tone="neutral" icon={(c) => <Lock size={11} color={c} />} /> : null}
              </View>
              {doc && data.canReview ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
                  {doc.status !== 'Verified' ? <Button label="Verify" size="sm" variant="secondary" icon={(c) => <CheckCircle2 size={13} color={c} />} onPress={() => review(doc, 'Verified')} /> : null}
                  {doc.status !== 'Rejected' ? (
                    <Button
                      label="Reject"
                      size="sm"
                      variant="danger"
                      icon={(c) => <XCircle size={13} color={c} />}
                      onPress={() => {
                        setReason('');
                        setRejecting(doc);
                      }}
                    />
                  ) : null}
                  <Button label="Delete" size="sm" variant="ghost" icon={(c) => <Trash2 size={13} color={colors.danger} />} onPress={() => setRemoving(doc)} />
                </View>
              ) : null}
            </Card>
          );
        })}
      </Grid>

      {camera ? (
        <WebcamCapture
          title={camera.label}
          facing={camera.camera}
          guide={camera.guide}
          onCancel={() => setCamera(null)}
          onCapture={(file) => {
            const slot = camera;
            setCamera(null);
            setEditing({ slot, file });
          }}
        />
      ) : null}
      {editing ? (
        <PhotoEditor
          file={editing.file}
          title={`${editing.slot.label} · ${ownerName}`}
          defaultShape="original"
          onCancel={() => setEditing(null)}
          onDone={(edited) => {
            const slot = editing.slot;
            setEditing(null);
            return upload(slot, edited);
          }}
        />
      ) : null}

      <FormSheet visible={!!viewing} title={viewing ? `${viewing.doc.label} · ${ownerName}` : ''} onClose={closeViewer} footer={<Button label="Close" onPress={closeViewer} />}>
        {viewing ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Image source={{ uri: viewing.url }} style={{ width: '100%', aspectRatio: 1.4, backgroundColor: colors.bg2, borderRadius: 8 }} resizeMode="contain" accessibilityLabel={viewing.doc.label} />
            <Text style={{ color: colors.muted, fontSize: 11.5 }}>Your opening of this document has been recorded.</Text>
          </View>
        ) : null}
      </FormSheet>

      <FormSheet
        visible={!!rejecting}
        title={rejecting ? `Reject ${rejecting.label}?` : ''}
        onClose={() => setRejecting(null)}
        footer={
          <>
            <Button label="Keep as is" variant="ghost" onPress={() => setRejecting(null)} />
            <Button
              label="Reject"
              variant="danger"
              disabled={!reason.trim()}
              onPress={() => {
                const doc = rejecting!;
                setRejecting(null);
                review(doc, 'Rejected', reason.trim());
              }}
            />
          </>
        }>
        <Field label="Reason (the customer sees this)" required value={reason} onChangeText={setReason} placeholder="e.g. Photo is blurred, name not readable" />
      </FormSheet>

      <ConfirmDialog
        visible={!!removing}
        title={removing ? `Delete ${removing.label}?` : ''}
        message="The file is deleted from KeyGo. This is recorded in the audit log."
        confirmLabel="Delete"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const doc = removing!;
          setRemoving(null);
          try {
            await deleteIdentity(doc.id);
            showToast(`${doc.label} deleted`);
            await changed();
          } catch (e) {
            showToast((e as Error).message);
          }
        }}
      />

      <IdentityQrSheet ownerType={ownerType} ownerId={ownerId} ownerName={ownerName} visible={phone} onClose={() => setPhone(false)} onPoll={changed} />
    </View>
  );
}

/** QR code for adding this person's documents from a phone at the counter. The list refreshes every 3 seconds. */
function IdentityQrSheet({ ownerType, ownerId, ownerName, visible, onClose, onPoll }: { ownerType: OwnerType; ownerId: string; ownerName: string; visible: boolean; onClose: () => void; onPoll: () => Promise<void> }) {
  const colors = useThemeColors();
  const [qr, setQr] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const poll = useRef(onPoll);
  poll.current = onPoll;

  useEffect(() => {
    if (!visible) return;
    setQr('');
    setError('');
    openIdentityLink(ownerType, ownerId).then(
      async (link) => {
        setUrl(link.url);
        setNow(Date.now());
        setExpiresAt(new Date(link.expiresAt).getTime());
        setQr(await QRCode.toDataURL(link.url, { margin: 1, width: 560, errorCorrectionLevel: 'M' }));
      },
      (e: Error) => setError(e.message)
    );
    const t = setInterval(() => {
      setNow(Date.now());
      poll.current().catch(() => undefined);
    }, 3000);
    return () => clearInterval(t);
  }, [visible, ownerType, ownerId]);

  const done = () => {
    closeIdentityLink(ownerType, ownerId).catch(() => undefined);
    onClose();
  };
  const minutes = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 60000)) : 0;

  return (
    <FormSheet visible={visible} title={`Add ${ownerName}'s documents from a phone`} onClose={done} footer={<Button label="Done" onPress={done} />}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
          Scan with the phone camera. On the phone, take each photo (or choose it), crop and upload. Documents appear here as they arrive. The phone page never shows documents already on file.
        </Text>
        <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF' }}>
          {qr ? <Image source={{ uri: qr }} style={{ width: 240, height: 240 }} accessibilityLabel="QR code for the phone document page" /> : error ? null : <ActivityIndicator color={colors.primary} />}
        </View>
        {error ? <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text> : null}
        {qr ? (
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>
            Works for {minutes} more minute{minutes === 1 ? '' : 's'}, only for {ownerName}. Press Done to close it sooner.
          </Text>
        ) : null}
        {url ? (
          <Text selectable style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }} numberOfLines={2}>
            No camera app? Open this on the phone: {url}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <FileText size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>Each upload is recorded with your name.</Text>
        </View>
      </View>
    </FormSheet>
  );
}
