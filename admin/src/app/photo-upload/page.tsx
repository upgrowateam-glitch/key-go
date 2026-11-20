'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { useSearchParams } from 'next/navigation';
import { Camera, CheckCircle2, CircleAlert, ImagePlus } from 'lucide-react-native';
import { Button } from '../../components/kit';
import { PhotoEditor } from '../../components/portal/PhotoEditor';
import { KeyGoLogo } from '../../components/ui/KeyGoLogo';
import { ApiError } from '../../lib/api';
import { formatBytes, pickFile, PHOTO_ACCEPT, PHOTO_MAX_INPUT_BYTES } from '../../lib/filePicker';
import { photoName, vehiclePhotoUri } from '../../features/fleet/tabs/VehiclePhotos';
import { fetchPhotoLink, uploadViaPhotoLink, type PhotoLinkInfo } from '../../services/photoLinks';
import { useThemeColors } from '../../theme';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Opened on a phone by scanning the QR code on a car's Photos tab. No sign-in: the link itself allows uploading
 * photos of that one car for 30 minutes. Each photo is taken with the camera or chosen from the gallery, cropped
 * and rotated, then uploaded; the computer shows it a few seconds later.
 */
function PhonePhotos() {
  const colors = useThemeColors();
  const token = useSearchParams().get('token') ?? '';
  const [info, setInfo] = useState<PhotoLinkInfo | null>(null);
  const [fatal, setFatal] = useState('');
  const [editing, setEditing] = useState<{ slot: string; label: string; file: File } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    if (!token) {
      setFatal('This link is incomplete. Scan the QR code on the computer again.');
      return;
    }
    fetchPhotoLink(token).then(setInfo, (e: ApiError) => setFatal(e.message));
  }, [token]);

  useEffect(() => {
    load();
    // Notice when staff press Done on the computer or the 30 minutes run out
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const choose = async (slot: string, label: string, camera: boolean) => {
    setNote('');
    const file = await pickFile(PHOTO_ACCEPT, camera ? 'environment' : undefined);
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) return setNote('Choose a photo.');
    if (file.size > PHOTO_MAX_INPUT_BYTES) return setNote(`That photo is ${formatBytes(file.size)}. Choose one under 40 MB.`);
    setEditing({ slot, label, file });
  };

  const upload = async (slot: string, label: string, file: File) => {
    if (file.size > MAX_BYTES) return setNote(`The edited photo is ${formatBytes(file.size)}. The limit is 10 MB.`);
    setBusy(slot);
    try {
      const saved = await uploadViaPhotoLink(token, slot, file);
      setInfo((i) => (i ? { ...i, slots: i.slots.map((s) => (s.slot === slot ? { ...s, fileId: saved.fileId } : s)) } : i));
      setDone((d) => ({ ...d, [slot]: true }));
      setNote(`${photoName(label)} uploaded.`);
    } catch (e) {
      if ((e as ApiError).status === 410) setFatal((e as Error).message);
      else setNote((e as Error).message);
    } finally {
      setBusy(null);
    }
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

  const uploaded = info.slots.filter((s) => s.fileId).length;
  const minutes = Math.max(0, Math.ceil((new Date(info.expiresAt).getTime() - Date.now()) / 60000));

  return (
    <Page>
      <View style={{ gap: 4, marginBottom: 14 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>CAR PHOTOS</Text>
        <Text style={{ color: colors.txt, fontSize: 22, fontWeight: '800' }}>{info.name}</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{[info.code, info.vehicleNumber].filter(Boolean).join(' · ')}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
          {uploaded} of {info.slots.length} photos on file · link works for {minutes} more minute{minutes === 1 ? '' : 's'}
        </Text>
      </View>
      {note ? (
        <View style={{ backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <Text style={{ color: colors.txt, fontSize: 14 }}>{note}</Text>
        </View>
      ) : null}
      <View style={{ gap: 12 }}>
        {info.slots.map((s) => {
          const isMain = s.slot === 'main';
          return (
            <View
              key={s.slot}
              style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: isMain ? 2 : 1, borderColor: isMain ? colors.highlight : colors.line, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}>
                <View style={{ width: 96, height: 72, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' }}>
                  {busy === s.slot ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : s.fileId ? (
                    <Image source={{ uri: vehiclePhotoUri(info.vehicleId, s.fileId) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={photoName(s.label)} />
                  ) : (
                    <Camera size={22} color={colors.muted} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: colors.txt, fontSize: 16, fontWeight: '700' }}>{s.label}</Text>
                    {done[s.slot] ? <CheckCircle2 size={16} color={colors.success} /> : null}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {isMain ? 'Customers see this first' : s.fileId ? 'On file — take again to replace' : 'Not taken yet'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Take photo" size="sm" fullWidth disabled={!!busy} icon={(c) => <Camera size={14} color={c} />} onPress={() => choose(s.slot, s.label, true)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Gallery" size="sm" variant="outline" fullWidth disabled={!!busy} icon={(c) => <ImagePlus size={14} color={c} />} onPress={() => choose(s.slot, s.label, false)} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 18 }}>When you are finished, press Done on the computer.</Text>

      {editing ? (
        <PhotoEditor
          file={editing.file}
          title={photoName(editing.label)}
          onCancel={() => setEditing(null)}
          onDone={(edited) => {
            const { slot, label } = editing;
            setEditing(null);
            return upload(slot, label, edited);
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

export default function PhotoUploadPage() {
  return (
    <Suspense fallback={null}>
      <PhonePhotos />
    </Suspense>
  );
}
