import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ChipGroup, Field, FormRow, FormSheet, SegmentedControl } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { formatKm } from '../../lib/format';
import { useThemeColors } from '../../theme';
import type { MaintenanceRecord, MaintenanceReminderType } from '../../types';
import { ISO_DATE, useCommonStyles } from '../agreements/listTools';

export const REMINDER_TYPES: MaintenanceReminderType[] = ['Oil change', 'Brake pad', 'Service', 'Insurance renewal', 'Emission renewal'];
const RECORD_STATUSES = ['Scheduled', 'In Progress', 'Completed'] as const;

interface LogForm {
  vehicleId: string;
  category: MaintenanceReminderType;
  serviceType: string;
  vendorName: string;
  date: string;
  cost: string;
  status: (typeof RECORD_STATUSES)[number];
  nextServiceKm: string;
}

export function LogMaintenanceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useThemeColors();
  const styles = useCommonStyles();
  const { vehicles, addMaintenanceRecord, today } = useApp();
  const fleet = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const blankForm = (): LogForm => ({
    vehicleId: fleet[0]?.id ?? '',
    category: 'Service',
    serviceType: '',
    vendorName: '',
    date: today,
    cost: '',
    status: 'Completed',
    nextServiceKm: '',
  });
  const [form, setForm] = useState<LogForm>(blankForm);
  const [errors, setErrors] = useState<Partial<Record<keyof LogForm, string>>>({});

  useEffect(() => {
    if (visible) {
      setForm(blankForm());
      setErrors({});
    }
    // Reset only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setField = <K extends keyof LogForm>(k: K, val: LogForm[K]) => {
    setForm((f) => ({ ...f, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const submit = () => {
    const e: Partial<Record<keyof LogForm, string>> = {};
    const vehicle = vehicleById.get(form.vehicleId);
    const cost = parseFloat(form.cost.replace(/[^\d.]/g, ''));
    const nextKm = form.nextServiceKm ? parseFloat(form.nextServiceKm.replace(/[^\d.]/g, '')) : 0;
    if (!vehicle) e.vehicleId = 'Select a vehicle';
    if (!form.serviceType.trim()) e.serviceType = 'Describe the work done';
    if (!form.vendorName.trim()) e.vendorName = 'Enter the vendor / workshop';
    if (!ISO_DATE.test(form.date)) e.date = 'Use YYYY-MM-DD';
    if (!(cost >= 0) || form.cost.trim() === '') e.cost = 'Enter the cost (0 if free)';
    if (!(nextKm >= 0)) e.nextServiceKm = 'Enter a number';
    setErrors(e);
    if (Object.keys(e).length || !vehicle) return;
    const rec: MaintenanceRecord = {
      id: `MNT-${Math.floor(500 + Math.random() * 9000)}`,
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      vehicleNumber: vehicle.vehicleNumber,
      serviceType: form.serviceType.trim(),
      category: form.category,
      cost: Math.round(cost),
      vendorName: form.vendorName.trim(),
      date: form.date,
      status: form.status,
      nextServiceKm: Math.round(nextKm) || 0,
    };
    addMaintenanceRecord(rec);
    onClose();
  };

  return (
    <FormSheet
      visible={visible}
      title="Log maintenance"
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} />
          <Button label="Save record" onPress={submit} />
        </>
      }>
      <Text style={styles.label}>
        Vehicle <Text style={{ color: colors.danger }}>*</Text>
      </Text>
      <View style={{ marginBottom: 14 }}>
        {fleet.length ? (
          <ChipGroup
            options={fleet.map((v) => v.id)}
            value={form.vehicleId}
            onChange={(id) => setField('vehicleId', id)}
            labels={Object.fromEntries(fleet.map((v) => [v.id, `${v.name} · ${v.vehicleNumber}`]))}
            scroll
          />
        ) : (
          <Text style={styles.sub}>No active vehicles in the fleet.</Text>
        )}
        {errors.vehicleId ? <Text style={styles.error}>{errors.vehicleId}</Text> : null}
      </View>
      <Text style={styles.label}>Category</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={REMINDER_TYPES} value={form.category} onChange={(c) => setField('category', c)} />
      </View>
      <Field label="Work done" required value={form.serviceType} onChangeText={(t) => setField('serviceType', t)} placeholder="e.g. Engine oil & filter change" error={errors.serviceType} />
      <FormRow>
        <Field label="Vendor / workshop" required value={form.vendorName} onChangeText={(t) => setField('vendorName', t)} error={errors.vendorName} />
        <Field label="Date" required value={form.date} onChangeText={(t) => setField('date', t)} placeholder="YYYY-MM-DD" error={errors.date} />
      </FormRow>
      <FormRow>
        <Field label="Cost (₹)" required value={form.cost} onChangeText={(t) => setField('cost', t)} keyboardType="number-pad" error={errors.cost} />
        <Field
          label="Next service at (km)"
          value={form.nextServiceKm}
          onChangeText={(t) => setField('nextServiceKm', t)}
          keyboardType="number-pad"
          placeholder="Optional"
          hint={vehicleById.get(form.vehicleId) ? `Current odometer ${formatKm(vehicleById.get(form.vehicleId)!.odometerKm)}` : undefined}
          error={errors.nextServiceKm}
        />
      </FormRow>
      <Text style={styles.label}>Status</Text>
      <SegmentedControl options={RECORD_STATUSES} value={form.status} onChange={(s) => setField('status', s)} />
      <Text style={[styles.sub, { marginTop: 12 }]}>The cost is also added to Finance as a maintenance expense.</Text>
    </FormSheet>
  );
}
