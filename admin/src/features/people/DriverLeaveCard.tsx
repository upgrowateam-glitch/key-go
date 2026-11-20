import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarOff, Plus, Trash2 } from 'lucide-react-native';
import { Button, Card, EmptyState, Field, FormRow, FormSheet, ListRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { formatDate } from '../../lib/format';
import { useThemeColors } from '../../theme';
import type { Driver } from '../../types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Leave and days off. A driver on leave is not offered for bookings on those dates (the server refuses it too). */
export function DriverLeaveCard({ driver: d }: { driver: Driver }) {
  const colors = useThemeColors();
  const { today, bookings, updateDriver, showToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);

  const leaves = (d.leaves ?? []).filter((l) => l.to >= today).sort((a, b) => a.from.localeCompare(b.from));
  const past = (d.leaves ?? []).filter((l) => l.to < today).length;
  const clash = ISO.test(from) && ISO.test(to)
    ? bookings.find((b) => b.driverId === d.id && (b.status === 'Confirmed' || b.status === 'Active') && b.pickupDate <= to && b.returnDate >= from)
    : undefined;
  const error = !ISO.test(from) || !ISO.test(to)
    ? 'Use YYYY-MM-DD'
    : to < from
      ? 'The last day is before the first day'
      : clash
        ? `${d.name} drives booking ${clash.id} on these dates. Assign another driver to it first.`
        : undefined;

  const save = () => {
    setTouched(true);
    if (error) return;
    updateDriver(d.id, { leaves: [...(d.leaves ?? []), { id: `LV-${Date.now()}`, from, to, note: note.trim() || undefined }] });
    showToast(`Leave added for ${d.name}`);
    setAdding(false);
    setNote('');
    setTouched(false);
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.txt, fontSize: 15, fontWeight: '800', flex: 1 }}>Leave & days off</Text>
        <Button label="Add leave" size="sm" variant="outline" icon={(c) => <Plus size={14} color={c} />} onPress={() => setAdding(true)} />
      </View>
      <View style={{ marginTop: 6 }}>
        {leaves.length === 0 ? (
          <EmptyState compact title="No leave planned" message="Add leave so this driver is not booked on those days." icon={(c) => <CalendarOff size={22} color={c} />} />
        ) : (
          leaves.map((l) => (
            <ListRow
              key={l.id}
              title={l.from === l.to ? formatDate(l.from) : `${formatDate(l.from)} → ${formatDate(l.to)}`}
              subtitle={l.note || (l.from <= today ? 'On leave now' : 'Planned')}
              right={
                <Button
                  label="Remove"
                  size="sm"
                  variant="ghost"
                  icon={(c) => <Trash2 size={13} color={colors.danger} />}
                  onPress={() => {
                    updateDriver(d.id, { leaves: (d.leaves ?? []).filter((x) => x.id !== l.id) });
                    showToast('Leave removed');
                  }}
                />
              }
            />
          ))
        )}
        {past ? <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 6 }}>{past} earlier leave period{past === 1 ? '' : 's'} on record.</Text> : null}
      </View>
      <FormSheet
        visible={adding}
        title={`Add leave for ${d.name}`}
        onClose={() => setAdding(false)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setAdding(false)} />
            <Button label="Add leave" onPress={save} />
          </>
        }>
        <FormRow>
          <Field label="First day" required value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
          <Field label="Last day" required value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
        </FormRow>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Weekly off, sick leave, family function" />
        {touched && error ? <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{error}</Text> : null}
      </FormSheet>
    </Card>
  );
}
