import React, { useState } from 'react';
import { Text } from 'react-native';
import { changePassword } from '../../services/auth';
import { useThemeColors } from '../../theme';
import { Button, Field, FormSheet } from '../kit';

/** Change your own password. Other devices are signed out; this browser stays signed in. */
export function ChangePasswordSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const colors = useThemeColors();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nextError = next.length < 8 ? 'Use at least 8 characters' : next === current ? 'Choose a different password' : undefined;
  const againError = again !== next ? 'The two new passwords do not match' : undefined;

  const save = async () => {
    setTouched(true);
    setError('');
    if (!current || nextError || againError) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title="Change password"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Saving…' : 'Change password'} disabled={saving} onPress={save} />
        </>
      }>
      <Field label="Current password" required secureTextEntry value={current} onChangeText={setCurrent} error={touched && !current ? 'Enter your current password' : undefined} />
      <Field label="New password" required secureTextEntry value={next} onChangeText={setNext} error={touched ? nextError : undefined} hint="At least 8 characters." />
      <Field label="New password again" required secureTextEntry value={again} onChangeText={setAgain} error={touched ? againError : undefined} />
      <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 4 }}>Any other browser or device signed in to your account will be signed out.</Text>
      {error ? <Text style={{ color: colors.danger, fontSize: 13, marginTop: 10 }}>{error}</Text> : null}
    </FormSheet>
  );
}
