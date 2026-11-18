import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RotateCcw, Save } from 'lucide-react-native';
import { Button } from '../../components/kit';
import type { ThemeColors } from '../../theme';

/** Save and discard buttons shared by the settings forms. */
export function FormActions({ dirty, onSave, onReset, saveLabel = 'Save changes' }: { dirty: boolean; onSave: () => void; onReset: () => void; saveLabel?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
      <Button label="Discard" variant="ghost" disabled={!dirty} icon={(c) => <RotateCcw size={14} color={c} />} onPress={onReset} />
      <Button label={saveLabel} disabled={!dirty} icon={(c) => <Save size={14} color={c} />} onPress={onSave} />
    </View>
  );
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isPhone = (v: string) => /^\+?\d[\d\s-]{8,}$/.test(v.trim());
export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v.trim());
export const isWholeNumber = (v: string) => /^\d{1,7}$/.test(v.trim());

export const makeSettingsStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: { color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
    title: { color: colors.txt, fontSize: 14, fontWeight: '800' },
    body: { color: colors.txt, fontSize: 13, lineHeight: 19, marginTop: 3 },
    rowHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    error: { color: colors.danger, fontSize: 12, marginTop: 6 },
    toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  });
