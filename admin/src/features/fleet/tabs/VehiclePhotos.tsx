import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import QRCode from 'qrcode';
import { Camera, ImagePlus, Smartphone, Trash2 } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, FormSheet, Grid } from '../../../components/kit';
import { PhotoEditor } from '../../../components/portal/PhotoEditor';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { API_URL, deleteFile, uploadFile } from '../../../lib/api';
import { formatBytes, pickFile, PHOTO_ACCEPT, PHOTO_MAX_INPUT_BYTES } from '../../../lib/filePicker';
import { closePhotoLink, openPhotoLink, photoLinkStatus, photoLinkUrl } from '../../../services/photoLinks';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';

const SLOTS = [
  { key: 'main', label: 'Main photo' },
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left side' },
  { key: 'right', label: 'Right side' },
  { key: 'interior', label: 'Interior' },
  { key: 'dashboard', label: 'Dashboard' },
] as const;
const MAX_BYTES = 10 * 1024 * 1024;

/** Where a car photo is served from (only photos attached to the car are served). */
export const vehiclePhotoUri = (vehicleId: string, fileId: string) => `${API_URL}/public/vehicles/${encodeURIComponent(vehicleId)}/photos/${encodeURIComponent(fileId)}`;

/** "Front" → "Front photo", "Main photo" stays as it is. */
export const photoName = (label: string) => (/photo$/i.test(label) ? label : `${label} photo`);

const mainKeyOf = (photos: Record<string, string>, preferred?: string) =>
  photos.main ? 'main' : preferred && photos[preferred] ? preferred : photos.front ? 'front' : Object.keys(photos)[0];

/**
 * Real photos of the car. The Main photo is what customers see first (car lists and the top of the car's page);
 * without one, the Front photo is used. Customers swipe through all the views on the car's page in the app.
 * Photos chosen here go through a crop and rotate step; "Take with phone" shows a QR code for the phone camera.
 */
export function VehiclePhotos({ v }: { v: Vehicle }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const { updateVehicle, showToast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  // Photos just picked show from the device at once, before the server has them
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ slot: string; label: string; file: File } | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);

  const photos = v.photos ?? {};
  const main = mainKeyOf(photos, v.mainPhoto);
  const count = Object.keys(photos).length;

  const save = (nextPhotos: Record<string, string>, nextMain?: string) => {
    const mainKey = mainKeyOf(nextPhotos, nextMain);
    updateVehicle(v.id, {
      photos: nextPhotos,
      mainPhoto: mainKey,
      imageAsset: mainKey ? { uri: previews[mainKey] ?? vehiclePhotoUri(v.id, nextPhotos[mainKey]) } : v.imageAsset,
    });
  };

  /** Step 1: choose a photo; step 2 (the editor) crops and rotates it; step 3 uploads it. */
  const choose = async (slot: string, label: string) => {
    const file = await pickFile(PHOTO_ACCEPT);
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Choose a photo (JPG, PNG or WebP)');
    if (file.size > PHOTO_MAX_INPUT_BYTES) return showToast(`That photo is ${formatBytes(file.size)}. Choose one under 40 MB.`);
    setEditing({ slot, label, file });
  };

  const upload = async (slot: string, label: string, file: File) => {
    if (file.size > MAX_BYTES) return showToast(`The edited photo is ${formatBytes(file.size)}. The limit is 10 MB.`);
    setBusy(slot);
    try {
      const stored = await uploadFile(file);
      const preview = URL.createObjectURL(file);
      setPreviews((p) => ({ ...p, [slot]: preview }));
      const old = photos[slot];
      save({ ...photos, [slot]: stored.id }, main ?? slot);
      if (old) deleteFile(old).catch(() => undefined);
      showToast(`${photoName(label)} saved`);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = (slot: string) => {
    const old = photos[slot];
    const next = { ...photos };
    delete next[slot];
    save(next, main === slot ? undefined : main);
    setPreviews((p) => {
      const n = { ...p };
      delete n[slot];
      return n;
    });
    if (old) deleteFile(old).catch(() => undefined);
    showToast('Photo removed');
  };

  return (
    <View>
      <Card>
        <View style={{ marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <Text style={styles.cardTitle}>Vehicle photos</Text>
            <Text style={styles.hint}>
              {count} of {SLOTS.length} photos on file. Customers see the ★ Main photo first, then swipe through all the views on the car's page. You can crop and rotate each photo before it is saved.
            </Text>
          </View>
          <Button label="Take with phone" size="sm" variant="outline" icon={(c) => <Smartphone size={14} color={c} />} onPress={() => setPhoneOpen(true)} />
        </View>
        <Grid cols={cols(2, 3, 3)} gap={12}>
          {SLOTS.map((s) => {
            const fileId = photos[s.key];
            const uri = previews[s.key] ?? (fileId ? vehiclePhotoUri(v.id, fileId) : undefined);
            const isMain = main === s.key && !!fileId;
            const isMainSlot = s.key === 'main';
            return (
              <View key={s.key} style={{ borderWidth: isMainSlot ? 2 : 1, borderColor: isMain || isMainSlot ? colors.highlight : colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${fileId ? 'Replace' : 'Choose'} ${photoName(s.label).toLowerCase()}`}
                  onPress={() => choose(s.key, s.label)}
                  style={{ aspectRatio: 4 / 3, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' }}>
                  {busy === s.key ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : uri ? (
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`${photoName(s.label)} of ${v.name}`} />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 6, padding: 6 }}>
                      <Camera size={22} color={colors.muted} />
                      <Text style={[styles.hint, { textAlign: 'center' }]}>{isMainSlot ? 'Choose main photo' : `Choose ${s.label.toLowerCase()}`}</Text>
                      {isMainSlot ? <Text style={[styles.hint, { fontSize: 11 }]}>Customers see this first</Text> : null}
                    </View>
                  )}
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, flexWrap: 'wrap' }}>
                  <Text style={[styles.cardTitle, { fontSize: 13, flex: 1 }]}>{s.label}</Text>
                  {isMain ? <Badge label="★ Main" tone="highlight" /> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${photoName(s.label).toLowerCase()}`} onPress={() => choose(s.key, s.label)} hitSlop={6} style={{ padding: 4 }}>
                    <ImagePlus size={15} color={colors.primaryText} />
                  </Pressable>
                  {fileId ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${photoName(s.label).toLowerCase()}`} onPress={() => setRemoving(s.key)} hitSlop={6} style={{ padding: 4 }}>
                      <Trash2 size={15} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Grid>
        {count === 0 ? (
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="Choose main photo" size="sm" icon={(c) => <ImagePlus size={14} color={c} />} onPress={() => choose('main', 'Main photo')} />
            <Button label="Take with phone" size="sm" variant="outline" icon={(c) => <Smartphone size={14} color={c} />} onPress={() => setPhoneOpen(true)} />
          </View>
        ) : null}
      </Card>

      {editing ? (
        <PhotoEditor
          file={editing.file}
          title={`${photoName(editing.label)} · ${v.name}`}
          onCancel={() => setEditing(null)}
          onDone={(edited) => {
            const { slot, label } = editing;
            setEditing(null);
            return upload(slot, label, edited);
          }}
        />
      ) : null}

      <PhoneQrSheet v={v} visible={phoneOpen} onClose={() => setPhoneOpen(false)} />

      <ConfirmDialog
        visible={!!removing}
        title="Remove this photo?"
        message="It is deleted from KeyGo. If it was the main photo, customers see the Front photo first instead (or the standard picture if none is left)."
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const slot = removing;
          setRemoving(null);
          if (slot) remove(slot);
        }}
      />
    </View>
  );
}

/**
 * Shows a QR code; scanning it opens a page on the phone for taking or choosing this car's photos. Photos the phone
 * uploads appear here within a few seconds. The link works for 30 minutes, or until Done is pressed.
 */
function PhoneQrSheet({ v, visible, onClose }: { v: Vehicle; visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { showVehicleChange, showToast } = useApp();
  const [qr, setQr] = useState('');
  const [url, setUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [received, setReceived] = useState(0);
  const known = useRef<Record<string, string>>({});

  const start = async () => {
    setError('');
    setQr('');
    try {
      const link = await openPhotoLink(v.id);
      const address = photoLinkUrl(link.token);
      setUrl(address);
      setNow(Date.now());
      setExpiresAt(new Date(link.expiresAt).getTime());
      setQr(await QRCode.toDataURL(address, { margin: 1, width: 560, errorCorrectionLevel: 'M' }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!visible) return;
    known.current = { ...(v.photos ?? {}) };
    setReceived(0);
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Pick up photos the phone sends (every 3 seconds while the QR code is open)
  useEffect(() => {
    if (!visible || !expiresAt) return;
    const timer = setInterval(async () => {
      setNow(Date.now());
      try {
        const s = await photoLinkStatus(v.id);
        const changed = Object.keys(s.photos).filter((k) => known.current[k] !== s.photos[k]);
        if (changed.length) {
          known.current = { ...s.photos };
          const mainKey = mainKeyOf(s.photos, s.mainPhoto);
          showVehicleChange(v.id, {
            photos: s.photos,
            mainPhoto: mainKey,
            imageAsset: mainKey ? { uri: vehiclePhotoUri(v.id, s.photos[mainKey]) } : undefined,
          });
          setReceived((n) => n + changed.length);
          showToast(changed.length === 1 ? 'Photo received from phone' : `${changed.length} photos received from phone`);
        }
        if (!s.open) setExpiresAt(0);
      } catch {
        // A missed check is retried 3 seconds later
      }
    }, 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, expiresAt, v.id]);

  const done = () => {
    closePhotoLink(v.id).catch(() => undefined);
    setExpiresAt(0);
    onClose();
  };

  const minutesLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 60000)) : 0;
  const expired = !!qr && !expiresAt;

  return (
    <FormSheet
      visible={visible}
      title="Take photos with your phone"
      onClose={done}
      footer={
        <>
          {expired ? <Button label="New QR code" variant="outline" onPress={start} /> : null}
          <Button label="Done" onPress={done} />
        </>
      }>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Text style={[styles.hint, { textAlign: 'center' }]}>
          Scan this code with your phone camera. A page opens where you can take each photo of {v.name} or choose it from the phone's gallery, crop and rotate it, and upload it. Photos appear here automatically.
        </Text>
        <View style={{ width: 260, height: 260, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', opacity: expired ? 0.25 : 1 }}>
          {qr ? <Image source={{ uri: qr }} style={{ width: 240, height: 240 }} accessibilityLabel="QR code for the phone photo page" /> : error ? null : <ActivityIndicator color={colors.primary} />}
        </View>
        {error ? <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text> : null}
        {expired ? (
          <Text style={{ color: colors.danger, textAlign: 'center', fontWeight: '700' }}>This QR code has expired. Press New QR code.</Text>
        ) : qr ? (
          <Text style={[styles.hint, { textAlign: 'center' }]}>Works for {minutesLeft} more minute{minutesLeft === 1 ? '' : 's'}, only for this car's photos. Press Done to close it sooner.</Text>
        ) : null}
        {received ? (
          <Badge label={`${received} photo${received === 1 ? '' : 's'} received`} tone="success" />
        ) : null}
        {url && !expired ? (
          <Text selectable style={[styles.hint, { fontSize: 11, textAlign: 'center' }]} numberOfLines={2}>
            No camera app? Open this on the phone: {url}
          </Text>
        ) : null}
      </View>
    </FormSheet>
  );
}
