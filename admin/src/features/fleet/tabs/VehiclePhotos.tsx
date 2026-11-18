import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Button, Card, Field, FormSheet, PhotoCaptureGrid, SimulatedNote } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';

const STANDARD_PHOTO_SLOTS = ['Front', 'Rear', 'Left side', 'Right side', 'Interior', 'Dashboard'];

export function VehiclePhotos({ v }: { v: Vehicle }) {
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const { updateVehicle, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string>();

  const slots = Array.from(new Set([...STANDARD_PHOTO_SLOTS, ...v.photoLabels]));
  const toggle = (slot: string) => {
    const has = v.photoLabels.includes(slot);
    updateVehicle(v.id, { photoLabels: has ? v.photoLabels.filter((p) => p !== slot) : [...v.photoLabels, slot] });
    showToast(has ? `${slot} photo removed` : `${slot} photo captured (simulated)`);
  };
  const addCustom = () => {
    const l = label.trim();
    if (!l) return setError('Enter a label, e.g. "Boot" or "Spare wheel"');
    if (slots.some((s) => s.toLowerCase() === l.toLowerCase())) return setError('A photo with this label already exists');
    updateVehicle(v.id, { photoLabels: [...v.photoLabels, l] });
    showToast(`${l} photo added (simulated)`);
    setLabel('');
    setError(undefined);
    setOpen(false);
  };

  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={styles.cardTitle}>Vehicle photos</Text>
            <Text style={styles.hint}>
              {v.photoLabels.length} of {slots.length} angles on file. Tap a tile to capture or remove.
            </Text>
          </View>
          <Button label="Add photo" variant="outline" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setOpen(true)} />
        </View>
        <PhotoCaptureGrid slots={slots} captured={v.photoLabels} onToggle={toggle} columns={cols(2, 3, 3)} />
      </Card>
      <SimulatedNote>No camera access in the UI phase — photos are placeholders labelled by angle.</SimulatedNote>
      <FormSheet
        visible={open}
        title="Add photo"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} />
            <Button label="Add photo" onPress={addCustom} />
          </>
        }>
        <Field label="Photo label" required value={label} onChangeText={(t) => { setLabel(t); setError(undefined); }} placeholder="e.g. Boot, Spare wheel, Odometer" error={error} />
        <SimulatedNote>The photo is simulated; only the label is saved.</SimulatedNote>
      </FormSheet>
    </View>
  );
}
