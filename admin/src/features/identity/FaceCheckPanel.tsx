import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { CheckCircle2, Eye, ScanFace, XCircle } from 'lucide-react-native';
import { Button, Card, Field, FormSheet, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { faceCheck, openIdentity } from '../../services/identity';
import { useThemeColors } from '../../theme';
import type { Customer, IdentityDoc } from '../../types';
import type { IdentityState } from './useIdentity';

/**
 * Staff compare the customer's photo (or selfie) with the photo on the ID card and press Match or Not a match.
 * The decision, who made it and when go into the audit log. Photos are only loaded when staff ask to see them.
 */
export function FaceCheckPanel({ customer: c, state, onChanged }: { customer: Customer; state: IdentityState; onChanged: () => void }) {
  const colors = useThemeColors();
  const { isPhone } = useResponsive();
  const { showToast } = useApp();
  const docs = state.data?.documents ?? [];
  const faces = docs.filter((d) => d.kind === 'photo' || d.kind === 'selfie');
  const idFront = docs.find((d) => d.kind === 'id_front');
  const [faceKind, setFaceKind] = useState<string>('');
  const face = faces.find((d) => d.kind === faceKind) ?? faces[0];
  const [images, setImages] = useState<{ face?: string; id?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Forget loaded pictures when the documents change or the panel closes
  useEffect(
    () => () => {
      if (images?.face) URL.revokeObjectURL(images.face);
      if (images?.id) URL.revokeObjectURL(images.id);
    },
    [images]
  );
  useEffect(() => setImages(null), [face?.id, idFront?.id]);

  if (!state.data) return null;
  const { canOpen, canReview } = state.data;
  const ready = !!face && !!idFront;

  const show = async () => {
    if (!face || !idFront) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([openIdentity(face.id), openIdentity(idFront.id)]);
      setImages({ face: a.url, id: b.url });
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const decide = async (result: 'match' | 'no_match', why?: string) => {
    setSaving(true);
    try {
      await faceCheck(c.id, result, why);
      showToast(result === 'match' ? 'Face check recorded: Match' : 'Face check recorded: Not a match');
      setNoMatch(false);
      onChanged();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const picture = (label: string, doc: IdentityDoc | undefined, uri: string | undefined) => (
    <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <View style={{ aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: colors.bg2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={label} />
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', padding: 8 }}>{doc ? 'Press "Show photos"' : 'Not uploaded yet'}</Text>
        )}
      </View>
    </View>
  );

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <ScanFace size={18} color={colors.primaryText} />
        <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '800', flex: 1 }}>Face check</Text>
        <StatusBadge status={c.faceVerification} />
      </View>
      {!ready ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Needs {!face ? 'a customer photo or selfie' : ''}
          {!face && !idFront ? ' and ' : ''}
          {!idFront ? 'the front of the ID card' : ''}. Add them below.
        </Text>
      ) : !canOpen ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>Only Owner, Admin and Manager can do the face check.</Text>
      ) : (
        <>
          {faces.length > 1 ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {faces.map((f) => (
                <Pressable
                  key={f.kind}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: face?.kind === f.kind }}
                  onPress={() => setFaceKind(f.kind)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: face?.kind === f.kind ? colors.primary : colors.line, backgroundColor: face?.kind === f.kind ? colors.primarySoft : colors.card }}>
                  <Text style={{ color: colors.txt, fontSize: 12, fontWeight: '700' }}>Compare {f.label.toLowerCase()}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 12 }}>
            {picture(face?.label ?? 'Customer photo', face, images?.face)}
            {picture('ID card photo (front)', idFront, images?.id)}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {!images ? <Button label={loading ? 'Opening…' : 'Show photos'} size="sm" variant="outline" disabled={loading} icon={(col) => (loading ? <ActivityIndicator size="small" color={col} /> : <Eye size={14} color={col} />)} onPress={show} /> : null}
            {canReview && images ? (
              <>
                <Button label="Match" size="sm" variant="secondary" disabled={saving} icon={(col) => <CheckCircle2 size={14} color={col} />} onPress={() => decide('match')} />
                <Button
                  label="Not a match"
                  size="sm"
                  variant="danger"
                  disabled={saving}
                  icon={(col) => <XCircle size={14} color={col} />}
                  onPress={() => {
                    setNote('');
                    setNoMatch(true);
                  }}
                />
              </>
            ) : null}
            {canReview && !images ? <Text style={{ color: colors.muted, fontSize: 12 }}>Look at both photos before deciding.</Text> : null}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11.5 }}>Your name, the date, time and result are saved in the audit log.</Text>
        </>
      )}

      <FormSheet
        visible={noMatch}
        title="Face does not match?"
        onClose={() => setNoMatch(false)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setNoMatch(false)} />
            <Button label="Record: Not a match" variant="danger" disabled={!note.trim() || saving} onPress={() => decide('no_match', note.trim())} />
          </>
        }>
        <Field label="What is different?" required value={note} onChangeText={setNote} placeholder="e.g. Different person, photo too old to compare" />
      </FormSheet>
    </Card>
  );
}
