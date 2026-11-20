import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Camera, Star, Trash2, Upload } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, Grid } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { API_URL, deleteFile, uploadFile } from '../../../lib/api';
import { formatBytes, pickFile } from '../../../lib/filePicker';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';

const SLOTS = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'left', label: 'Left side' },
  { key: 'right', label: 'Right side' },
  { key: 'interior', label: 'Interior' },
  { key: 'dashboard', label: 'Dashboard' },
] as const;
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

/** Where a car photo is served from (only photos attached to the car are served). */
export const vehiclePhotoUri = (vehicleId: string, fileId: string) => `${API_URL}/public/vehicles/${encodeURIComponent(vehicleId)}/photos/${encodeURIComponent(fileId)}`;

/** Real photos of the car by position. The main photo is what customers see in the app. */
export function VehiclePhotos({ v }: { v: Vehicle }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const { updateVehicle, showToast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  // Photos just picked show from the device at once, before the server has them
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<string | null>(null);

  const photos = v.photos ?? {};
  const main = v.mainPhoto && photos[v.mainPhoto] ? v.mainPhoto : photos.front ? 'front' : Object.keys(photos)[0];
  const count = Object.keys(photos).length;

  const save = (nextPhotos: Record<string, string>, nextMain?: string) => {
    const mainKey = nextMain && nextPhotos[nextMain] ? nextMain : nextPhotos.front ? 'front' : Object.keys(nextPhotos)[0];
    updateVehicle(v.id, {
      photos: nextPhotos,
      mainPhoto: mainKey,
      imageAsset: mainKey ? { uri: previews[mainKey] ?? vehiclePhotoUri(v.id, nextPhotos[mainKey]) } : v.imageAsset,
    });
  };

  const upload = async (slot: string, label: string) => {
    const file = await pickFile(IMAGE_ACCEPT);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return showToast('Choose a JPG, PNG or WebP photo');
    if (file.size > MAX_BYTES) return showToast(`That photo is ${formatBytes(file.size)}. The limit is 10 MB.`);
    setBusy(slot);
    try {
      const stored = await uploadFile(file);
      const preview = URL.createObjectURL(file);
      setPreviews((p) => ({ ...p, [slot]: preview }));
      const old = photos[slot];
      save({ ...photos, [slot]: stored.id }, main ?? slot);
      if (old) deleteFile(old).catch(() => undefined);
      showToast(`${label} photo saved`);
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
        <View style={{ marginBottom: 12 }}>
          <Text style={styles.cardTitle}>Vehicle photos</Text>
          <Text style={styles.hint}>
            {count} of {SLOTS.length} photos on file. The ★ main photo is shown to customers in the app. JPG, PNG or WebP up to 10 MB.
          </Text>
        </View>
        <Grid cols={cols(2, 3, 3)} gap={12}>
          {SLOTS.map((s) => {
            const fileId = photos[s.key];
            const uri = previews[s.key] ?? (fileId ? vehiclePhotoUri(v.id, fileId) : undefined);
            const isMain = main === s.key && !!fileId;
            return (
              <View key={s.key} style={{ borderWidth: 1, borderColor: isMain ? colors.highlight : colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${fileId ? 'Replace' : 'Upload'} ${s.label} photo`}
                  onPress={() => upload(s.key, s.label)}
                  style={{ aspectRatio: 4 / 3, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' }}>
                  {busy === s.key ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : uri ? (
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`${s.label} photo of ${v.name}`} />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <Camera size={22} color={colors.muted} />
                      <Text style={styles.hint}>Upload {s.label.toLowerCase()}</Text>
                    </View>
                  )}
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, flexWrap: 'wrap' }}>
                  <Text style={[styles.cardTitle, { fontSize: 13, flex: 1 }]}>{s.label}</Text>
                  {isMain ? <Badge label="★ Main" tone="highlight" /> : null}
                  {fileId && !isMain ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Use ${s.label} as main photo`} onPress={() => save(photos, s.key)} hitSlop={6} style={{ padding: 4 }}>
                      <Star size={15} color={colors.muted} />
                    </Pressable>
                  ) : null}
                  {fileId ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.label} photo`} onPress={() => setRemoving(s.key)} hitSlop={6} style={{ padding: 4 }}>
                      <Trash2 size={15} color={colors.danger} />
                    </Pressable>
                  ) : (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Upload ${s.label} photo`} onPress={() => upload(s.key, s.label)} hitSlop={6} style={{ padding: 4 }}>
                      <Upload size={15} color={colors.primaryText} />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </Grid>
        {count === 0 ? (
          <View style={{ marginTop: 12 }}>
            <Button label="Upload front photo" size="sm" icon={(c) => <Upload size={14} color={c} />} onPress={() => upload('front', 'Front')} />
          </View>
        ) : null}
      </Card>
      <ConfirmDialog
        visible={!!removing}
        title="Remove this photo?"
        message="It is deleted from KeyGo. Customers see the next photo, or the standard picture if none is left."
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
