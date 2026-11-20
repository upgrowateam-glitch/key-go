'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSearchParams } from 'next/navigation';
import { Camera, CheckCircle2, CircleAlert, FileUp, ShieldCheck } from 'lucide-react-native';
import { Button, StatusBadge } from '../../components/kit';
import { PhotoEditor } from '../../components/portal/PhotoEditor';
import { KeyGoLogo } from '../../components/ui/KeyGoLogo';
import type { ApiError } from '../../lib/api';
import { formatBytes, pickFile, PHOTO_MAX_INPUT_BYTES } from '../../lib/filePicker';
import { fetchIdentityLink, uploadViaIdentityLink, type IdentityLinkInfo } from '../../services/identity';
import { useThemeColors } from '../../theme';

const MAX_BYTES = 10 * 1024 * 1024;
type Slot = IdentityLinkInfo['slots'][number];

/**
 * Opened on a phone: from the QR code staff show at the counter, or from "Upload documents" in the customer app.
 * Takes or chooses each document, crops and rotates it, and uploads it (encrypted on the server). It never shows
 * documents already on file, only whether each one is there.
 */
function VerifyPage() {
  const colors = useThemeColors();
  const token = useSearchParams().get('token') ?? '';
  const [info, setInfo] = useState<IdentityLinkInfo | null>(null);
  const [fatal, setFatal] = useState('');
  const [editing, setEditing] = useState<{ slot: Slot; file: File } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    if (!token) return setFatal('This link is incomplete. Open it again from the KeyGo app or scan the QR code again.');
    fetchIdentityLink(token).then(setInfo, (e: ApiError) => setFatal(e.message));
  }, [token]);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const upload = async (slot: Slot, file: File) => {
    if (file.size > MAX_BYTES) return setNote(`The file is ${formatBytes(file.size)}. The limit is 10 MB.`);
    setBusy(slot.kind);
    setNote('');
    try {
      await uploadViaIdentityLink(token, slot.kind, file);
      setDone((d) => ({ ...d, [slot.kind]: true }));
      setNote(`${slot.label} uploaded. KeyGo will check it.`);
      load();
    } catch (e) {
      if ((e as ApiError).status === 410) setFatal((e as Error).message);
      else setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const choose = async (slot: Slot, camera: boolean) => {
    setNote('');
    const file = await pickFile(camera || slot.photoOnly ? 'image/*' : 'image/*,application/pdf', camera ? slot.camera : undefined);
    if (!file) return;
    if (file.type === 'application/pdf') return upload(slot, file);
    if (file.type && !file.type.startsWith('image/')) return setNote(slot.photoOnly ? 'Choose a photo.' : 'Choose a photo or a PDF.');
    if (file.size > PHOTO_MAX_INPUT_BYTES) return setNote(`That photo is ${formatBytes(file.size)}. Choose one under 40 MB.`);
    setEditing({ slot, file });
  };

  if (fatal) {
    return (
      <Page>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
          <CircleAlert size={36} color={colors.danger} />
          <Text style={{ color: colors.txt, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Link not available</Text>
          <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>{fatal}</Text>
        </View>
      </Page>
    );
  }
  if (!info) {
    return (
      <Page>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </Page>
    );
  }

  const minutes = Math.max(0, Math.ceil((new Date(info.expiresAt).getTime() - Date.now()) / 60000));
  const self = info.via === 'customer-link';

  return (
    <Page>
      <View style={{ gap: 4, marginBottom: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>{self ? 'YOUR DOCUMENTS' : info.ownerType === 'driver' ? 'DRIVER DOCUMENTS' : 'CUSTOMER DOCUMENTS'}</Text>
        <Text style={{ color: colors.txt, fontSize: 22, fontWeight: '800' }}>{self ? `Hi ${info.firstName}` : info.firstName}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
          {self ? 'Add your ID card, driving licence and a selfie. KeyGo checks them before your first pickup.' : 'Take or choose each document, crop it and upload.'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4 }}>
          This page works for {minutes} more minute{minutes === 1 ? '' : 's'}.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 }}>
        <ShieldCheck size={18} color={colors.success} />
        <Text style={{ color: colors.txt, fontSize: 12.5, flex: 1 }}>Documents are encrypted. Only KeyGo managers can open them, and every opening is recorded.</Text>
      </View>
      {note ? (
        <View style={{ backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <Text style={{ color: colors.txt, fontSize: 14 }}>{note}</Text>
        </View>
      ) : null}
      <View style={{ gap: 12 }}>
        {info.slots.map((s) => (
          <View key={s.kind} style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: s.status === 'Rejected' ? colors.danger : colors.line, padding: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: colors.txt, fontSize: 16, fontWeight: '700' }}>{s.label}</Text>
                  {done[s.kind] ? <CheckCircle2 size={16} color={colors.success} /> : null}
                </View>
                {s.status === 'Rejected' && s.rejectReason ? <Text style={{ color: colors.danger, fontSize: 12.5, marginTop: 2 }}>Please send again: {s.rejectReason}</Text> : null}
                {s.kind === 'selfie' ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Face the camera in good light, no cap or sunglasses.</Text> : null}
              </View>
              {busy === s.kind ? <ActivityIndicator color={colors.primary} /> : <StatusBadge status={s.status} />}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label={s.kind === 'selfie' ? 'Take selfie' : 'Take photo'} size="sm" fullWidth disabled={!!busy} icon={(c) => <Camera size={14} color={c} />} onPress={() => choose(s, true)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={s.photoOnly ? 'Gallery' : 'Gallery / PDF'} size="sm" variant="outline" fullWidth disabled={!!busy} icon={(c) => <FileUp size={14} color={c} />} onPress={() => choose(s, false)} />
              </View>
            </View>
          </View>
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 18 }}>{self ? 'When you are done, go back to the KeyGo app.' : 'When you are done, press Done on the computer.'}</Text>

      {editing ? (
        <PhotoEditor
          file={editing.file}
          title={editing.slot.label}
          defaultShape="original"
          onCancel={() => setEditing(null)}
          onDone={(edited) => {
            const slot = editing.slot;
            setEditing(null);
            return upload(slot, edited);
          }}
        />
      ) : null}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <View style={{ marginBottom: 16 }}>
        <KeyGoLogo textColor={colors.txt} accentColor={colors.primaryText} />
      </View>
      {children}
    </ScrollView>
  );
}

export default function VerifyRoute() {
  return (
    <Suspense fallback={null}>
      <VerifyPage />
    </Suspense>
  );
}
