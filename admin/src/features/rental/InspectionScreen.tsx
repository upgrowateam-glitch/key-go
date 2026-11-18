import { useLocalSearchParams, useRouter } from '@/shims/expo-router';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    Badge,
    Button,
    Card,
    CarDamageDiagram,
    Checkbox,
    ChipGroup,
    EmptyState,
    Field,
    FormRow,
    FormSheet,
    FuelLevelPicker,
    KeyValueGrid,
    PageHeader,
    PhotoCaptureGrid,
    ProgressBar,
    Screen,
    Section,
    SegmentedControl,
    SimulatedNote,
    SplitView,
    Tone,
} from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatINR, formatKm } from '../../lib/format';
import { CHECKLIST_ITEMS, getChecklist, saveChecklist, SUGGESTED_COST } from '../../services/inspections';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { CarZone, DamageMark, InspectionRecord } from '../../types';

const PHOTO_SLOTS = ['Front', 'Rear', 'Left side', 'Right side', 'Interior', 'Odometer', 'Boot', 'Tyres'];
const REQUIRED_PHOTOS = ['Front', 'Rear', 'Left side', 'Right side'];
const KINDS = ['Scratch', 'Dent', 'Crack', 'Paint chip'] as const;
const SEVERITIES = ['Minor', 'Moderate', 'Major'] as const;
const severityTone = (s: DamageMark['severity']): Tone => (s === 'Major' ? 'danger' : s === 'Moderate' ? 'warning' : 'highlight');

export default function InspectionScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { cols } = useResponsive();
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const bookingId = decodeURIComponent(params.id ?? '');
  const type: InspectionRecord['type'] = params.type === 'Return' ? 'Return' : 'Pickup';
  const { bookings, vehicles, inspections, recordInspection } = useApp();

  const booking = bookings.find((b) => b.id === bookingId);
  const vehicle = vehicles.find((v) => v.id === booking?.vehicleId);
  const existing = inspections.find((i) => i.bookingId === bookingId && i.type === type);
  const pickupRecord = inspections.find((i) => i.bookingId === bookingId && i.type === 'Pickup');

  const [inspector, setInspector] = useState('Vikram Singh');
  const [odometer, setOdometer] = useState(String(vehicle?.odometerKm ?? ''));
  const [fuel, setFuel] = useState(vehicle?.fuelLevelPercent ?? 100);
  const [photos, setPhotos] = useState<string[]>([]);
  const [marks, setMarks] = useState<DamageMark[]>([]);
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [editingZone, setEditingZone] = useState<CarZone | null>(null);
  const [kind, setKind] = useState<DamageMark['kind']>('Scratch');
  const [severity, setSeverity] = useState<DamageMark['severity']>('Minor');
  const [cost, setCost] = useState(String(SUGGESTED_COST.Minor));
  const [triedSave, setTriedSave] = useState(false);

  if (!booking || !vehicle) {
    return (
      <Screen>
        <PageHeader title="Inspection" back />
        <EmptyState title="Booking not found" message={`No booking with id ${bookingId}.`} />
      </Screen>
    );
  }

  const odoNum = parseInt(odometer.replace(/[^0-9]/g, ''), 10) || 0;
  const startOdo = booking.startOdometerKm ?? pickupRecord?.odometerKm;
  const odoError =
    !odoNum ? 'Enter the odometer reading' : type === 'Return' && startOdo && odoNum < startOdo ? `Must be at least ${formatKm(startOdo)} (pickup reading)` : undefined;
  const missingPhotos = REQUIRED_PHOTOS.filter((p) => !photos.includes(p));
  const totalCost = marks.reduce((s, m) => s + m.estimatedCost, 0);
  const canSave = !odoError && missingPhotos.length === 0 && inspector.trim().length > 1;

  const openZone = (zone: CarZone) => {
    setEditingZone(zone);
    setKind('Scratch');
    setSeverity('Minor');
    setCost(String(SUGGESTED_COST.Minor));
  };

  const addMark = () => {
    if (!editingZone) return;
    setMarks((prev) => [
      ...prev,
      { id: `dm-${Date.now()}`, zone: editingZone, kind, severity, estimatedCost: parseInt(cost.replace(/[^0-9]/g, ''), 10) || 0 },
    ]);
    setEditingZone(null);
  };

  const save = () => {
    setTriedSave(true);
    if (!canSave) return;
    const saved = recordInspection(booking.id, type, {
      inspectorName: inspector.trim(),
      fuelPercent: fuel,
      odometerKm: odoNum,
      damageMarks: marks,
      photosCaptured: photos,
      notes: notes.trim() || undefined,
      // Pre-existing damage at pickup is recorded but not charged
      estimatedDamageCost: type === 'Return' ? totalCost : 0,
    });
    saveChecklist(saved.id, checklist);
    router.replace(`/bookings/${encodeURIComponent(booking.id)}` as any);
  };

  // ---------------- Read-only view of a saved inspection
  if (existing) {
    const savedChecklist = getChecklist(existing.id);
    return (
      <Screen>
        <PageHeader
          eyebrow={`${type} inspection`}
          title={`${existing.id} · ${vehicle.name}`}
          subtitle={`${booking.id} · ${booking.customerName} · ${existing.date}`}
          back
          actions={<Badge label={`${type} · saved`} tone={type === 'Pickup' ? 'violet' : 'warning'} />}
        />
        <SplitView
          sideWidth={300}
          main={
            <View>
              <Section title="Readings" style={{ marginTop: 16 }}>
                <Card>
                  <KeyValueGrid
                    cols={cols(2, 4, 4)}
                    items={[
                      { label: 'Inspector', value: existing.inspectorName },
                      { label: 'Odometer', value: formatKm(existing.odometerKm) },
                      { label: 'Fuel level', value: `${existing.fuelPercent}%` },
                      { label: type === 'Return' ? 'Est. damage charge' : 'Pre-existing damage', value: type === 'Return' ? formatINR(existing.estimatedDamageCost) : `${existing.damageMarks.length} mark(s)` },
                    ]}
                  />
                  <ProgressBar value={existing.fuelPercent / 100} tone="primary" />
                </Card>
              </Section>
              <Section title="Condition checklist">
                <Card>
                  {savedChecklist ? (
                    CHECKLIST_ITEMS.map((item) => (
                      <View key={item} style={styles.checkRow}>
                        <Text style={[styles.muted, { flex: 1 }]}>{item}</Text>
                        <Badge label={savedChecklist[item] ? 'OK' : 'Issue'} tone={savedChecklist[item] ? 'success' : 'danger'} />
                      </View>
                    ))
                  ) : (
                    <Text style={styles.muted}>No checklist was recorded with this report.</Text>
                  )}
                </Card>
              </Section>
              <Section title="Damage report">
                <Card padded={false}>
                  {existing.damageMarks.length === 0 ? (
                    <EmptyState title="No damage recorded" compact />
                  ) : (
                    existing.damageMarks.map((m) => <MarkRow key={m.id} mark={m} />)
                  )}
                </Card>
              </Section>
              <Section title={`Photos (${existing.photosCaptured.length})`}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {existing.photosCaptured.map((p) => (
                    <Badge key={p} label={p} tone="success" />
                  ))}
                </View>
                {existing.notes ? <Text style={[styles.muted, { marginTop: 12 }]}>Notes: {existing.notes}</Text> : null}
              </Section>
            </View>
          }
          side={
            <Section title="Damage map" style={{ marginTop: 16 }}>
              <Card>
                <CarDamageDiagram marks={existing.damageMarks} readOnly width={200} />
              </Card>
            </Section>
          }
        />
      </Screen>
    );
  }

  // ---------------- New inspection form
  return (
    <Screen>
      <PageHeader
        eyebrow={`${type} inspection`}
        title={vehicle.name}
        subtitle={`${vehicle.vehicleNumber} · ${booking.id} · ${booking.customerName}`}
        back
        actions={<Badge label={type === 'Pickup' ? 'Before handover' : 'At return'} tone={type === 'Pickup' ? 'violet' : 'warning'} />}
      />

      <SplitView
        sideWidth={340}
        main={
          <View>
            <Section title="Readings" style={{ marginTop: 16 }}>
              <Card>
                <FormRow>
                  <Field label="Inspector" value={inspector} onChangeText={setInspector} required />
                  <Field
                    label="Odometer (km)"
                    value={odometer}
                    onChangeText={setOdometer}
                    keyboardType="numeric"
                    required
                    error={triedSave ? odoError : undefined}
                    hint={type === 'Return' && startOdo ? `Pickup reading ${formatKm(startOdo)}${odoNum > startOdo ? ` · ${formatKm(odoNum - startOdo)} driven` : ''}` : undefined}
                  />
                </FormRow>
                <Text style={styles.label}>Fuel level</Text>
                <FuelLevelPicker value={fuel} onChange={setFuel} />
                {type === 'Return' && pickupRecord ? (
                  <Text style={[styles.muted, { marginTop: 8 }]}>
                    Pickup fuel {pickupRecord.fuelPercent}%
                    {pickupRecord.fuelPercent > fuel ? ` · returned ${pickupRecord.fuelPercent - fuel}% lower` : ' · matches or exceeds pickup'}
                  </Text>
                ) : null}
              </Card>
            </Section>

            <Section title="Condition checklist" subtitle={`Tick each item in good condition · ${CHECKLIST_ITEMS.filter((i) => checklist[i]).length}/${CHECKLIST_ITEMS.length} OK. Unticked items are saved as issues.`}>
              <Card>
                {CHECKLIST_ITEMS.map((item) => (
                  <Checkbox key={item} label={item} checked={!!checklist[item]} onChange={(v) => setChecklist((prev) => ({ ...prev, [item]: v }))} />
                ))}
              </Card>
            </Section>

            <Section title="Photos" subtitle={`Front, rear and both sides are required · ${photos.length}/${PHOTO_SLOTS.length} captured`}>
              <PhotoCaptureGrid
                slots={PHOTO_SLOTS}
                captured={photos}
                columns={cols(2, 4, 4)}
                onToggle={(s) => setPhotos((prev) => (prev.includes(s) ? prev.filter((p) => p !== s) : [...prev, s]))}
              />
              {triedSave && missingPhotos.length ? <Text style={styles.error}>Missing photos: {missingPhotos.join(', ')}</Text> : null}
              <SimulatedNote>Camera capture is simulated — tapping a slot marks it as captured.</SimulatedNote>
            </Section>

            <Section title="Damage report" subtitle={type === 'Pickup' ? 'Record existing damage — it will not be charged to this customer.' : 'Record new damage found at return.'}>
              <Card padded={false}>
                {marks.length === 0 ? (
                  <EmptyState title="No damage marked" message="Tap a panel on the car diagram to add a scratch, dent or crack." compact />
                ) : (
                  marks.map((m) => <MarkRow key={m.id} mark={m} onRemove={() => setMarks((prev) => prev.filter((x) => x.id !== m.id))} />)
                )}
                {marks.length ? (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{type === 'Return' ? 'Estimated damage cost' : 'Pre-existing damage (not charged)'}</Text>
                    <Text style={styles.totalValue}>{formatINR(totalCost)}</Text>
                  </View>
                ) : null}
              </Card>
              <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Anything else to note (cleanliness, accessories, spare tyre…)" style={{ marginTop: 14 }} />
            </Section>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
              <Button label={`Save ${type.toLowerCase()} inspection`} size="lg" onPress={save} />
              <Button label="Cancel" size="lg" variant="ghost" onPress={() => router.back()} />
            </View>
            {triedSave && !canSave ? <Text style={styles.error}>Complete the highlighted fields to save.</Text> : null}
          </View>
        }
        side={
          <Section title="Mark damage" subtitle="Tap a panel · front is at the top" style={{ marginTop: 16 }}>
            <Card>
              <CarDamageDiagram marks={marks} onZonePress={openZone} width={230} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' }}>
                <Badge label="Minor" tone="highlight" />
                <Badge label="Moderate" tone="warning" />
                <Badge label="Major" tone="danger" />
              </View>
              {type === 'Return' && pickupRecord?.damageMarks.length ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.label}>Already present at pickup</Text>
                  {pickupRecord.damageMarks.map((m) => (
                    <Text key={m.id} style={styles.muted}>
                      • {m.zone} — {m.kind} ({m.severity})
                    </Text>
                  ))}
                </View>
              ) : null}
            </Card>
          </Section>
        }
      />

      <FormSheet
        visible={!!editingZone}
        title={`Add damage · ${editingZone ?? ''}`}
        onClose={() => setEditingZone(null)}
        footer={
          <>
            <Button label="Cancel" variant="ghost" onPress={() => setEditingZone(null)} />
            <Button label="Add mark" onPress={addMark} />
          </>
        }>
        <Text style={styles.label}>Type</Text>
        <ChipGroup options={KINDS} value={kind} onChange={setKind} />
        <Text style={[styles.label, { marginTop: 14 }]}>Severity</Text>
        <SegmentedControl
          options={SEVERITIES}
          value={severity}
          onChange={(s) => {
            setSeverity(s);
            setCost(String(SUGGESTED_COST[s]));
          }}
        />
        <Field
          style={{ marginTop: 14 }}
          label="Estimated repair cost (₹)"
          value={cost}
          onChangeText={setCost}
          keyboardType="numeric"
          hint="Suggested amount — adjust to the workshop estimate."
        />
      </FormSheet>
    </Screen>
  );
}

function MarkRow({ mark, onRemove }: { mark: DamageMark; onRemove?: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.markRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.markTitle}>{mark.zone}</Text>
        <Text style={styles.muted}>{mark.kind}</Text>
      </View>
      <Badge label={mark.severity} tone={severityTone(mark.severity)} />
      <Text style={styles.markCost}>{formatINR(mark.estimatedCost)}</Text>
      {onRemove ? (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${mark.zone} damage`} onPress={onRemove} style={{ padding: 6 }}>
          <Trash2 size={16} color={colors.danger} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8,
    },
    muted: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
    },
    markRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    markTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    markCost: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
      minWidth: 70,
      textAlign: 'right',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: colors.secondarySoft,
    },
    totalLabel: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    totalValue: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
  });
