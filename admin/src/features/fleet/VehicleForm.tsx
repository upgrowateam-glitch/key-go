import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, ChipGroup, Field, FormRow, FormSheet, SegmentedControl, SimulatedNote, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { saveVehicleCategory, VehicleCategory } from '../../services/fleet';
import { activeNames, masterLists } from '../../lib/catalog';
import { branchesStore } from '../../services/settings';
import { useResource } from '../../services/mockClient';
import { useThemedStyles, type ThemeColors } from '../../theme';
import { CarKind, Vehicle, VehicleType } from '../../types';
import { ISO_DATE, num } from './shared';
import { normaliseRegistration } from '../../lib/registration';

type FuelType = string;
const NO_BRANCH = 'No branch';
const TRANSMISSIONS = ['Auto', 'Manual'] as const;

/** Drawing used for the car when it has no photo; new types look like a sedan. */
const KIND_BY_TYPE: Record<string, CarKind> = { Hatchback: 'sedan', SUV: 'suv', MUV: 'suv', Sedan: 'sedan', Electric: 'ev', Luxury: 'sport' };
const kindFor = (type: VehicleType): CarKind => KIND_BY_TYPE[type] ?? 'sedan';
/** Paint colour is vehicle content (not theme); new vehicles start with a neutral graphite until edited. */
const DEFAULT_PAINT = '#5B6770';
/** New vehicles are parked at the main hub until the GPS device reports (simulated). */
const DEFAULT_HUB_GPS = { lat: 12.9784, lng: 77.6408, area: 'KeyGo Hub, Indiranagar', speedKmh: 0, ignitionOn: false, updatedAt: 'Awaiting first fix' };
const NOT_RECORDED = 'Not recorded';

interface FormState {
  name: string;
  brand: string;
  number: string;
  type: VehicleType;
  category: VehicleCategory;
  fuel: FuelType;
  branch: string;
  transmission: (typeof TRANSMISSIONS)[number];
  seats: string;
  purchaseDate: string;
  purchaseCost: string;
  pricePerDay: string;
  hasLoan: boolean;
  bankName: string;
  accountNo: string;
  emi: string;
  tenure: string;
  paidMonths: string;
  gpsDeviceId: string;
  gpsProvider: string;
  gpsSim: string;
  fastagId: string;
  insuranceProvider: string;
  insurancePolicyNo: string;
  insuranceExpiry: string;
  pucNo: string;
  pucExpiry: string;
  odometer: string;
}

const recorded = (s: string) => (s === NOT_RECORDED ? '' : s);

const initialForm = (today: string, v?: Vehicle, category?: VehicleCategory): FormState => ({
  name: v?.name ?? '',
  brand: v?.brand ?? '',
  number: v?.vehicleNumber ?? '',
  type: v?.type ?? activeNames(masterLists().vehicleTypes)[0] ?? 'SUV',
  category: category ?? (activeNames(masterLists().categories).includes('Standard') ? 'Standard' : activeNames(masterLists().categories)[0] ?? 'Standard'),
  fuel: v?.fuel ?? activeNames(masterLists().fuelTypes)[0] ?? 'Petrol',
  branch: v?.branch ?? NO_BRANCH,
  transmission: v?.transmission ?? 'Auto',
  seats: String(v?.seats ?? 5),
  purchaseDate: v?.purchaseDate ?? today,
  purchaseCost: v ? String(v.purchaseCost) : '',
  pricePerDay: v ? String(v.pricePerDay) : '',
  hasLoan: !!v?.loanDetails,
  bankName: v?.loanDetails?.bankName ?? '',
  accountNo: v?.loanDetails?.accountNo ?? '',
  emi: v?.loanDetails ? String(v.loanDetails.emiAmount) : '',
  tenure: v?.loanDetails ? String(v.loanDetails.tenureMonths) : '',
  paidMonths: String(v?.loanDetails?.paidMonths ?? 0),
  gpsDeviceId: v?.gpsDeviceId ?? '',
  gpsProvider: v?.gpsProvider ?? '',
  gpsSim: v?.gpsSim ?? '',
  fastagId: v?.fastagId ?? '',
  insuranceProvider: recorded(v?.insuranceProvider ?? ''),
  insurancePolicyNo: recorded(v?.insurancePolicyNo ?? ''),
  insuranceExpiry: recorded(v?.insuranceExpiry ?? ''),
  pucNo: recorded(v?.pucCertificateNo ?? ''),
  pucExpiry: recorded(v?.pucExpiry ?? ''),
  odometer: String(v?.odometerKm ?? 0),
});

/** Create or edit a vehicle. Mount it only while open, so each opening starts from the current record. */
export function VehicleForm({
  vehicle,
  category,
  onClose,
  onSaved,
}: {
  vehicle?: Vehicle;
  category?: VehicleCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { vehicles, addVehicle, updateVehicle, today, showToast } = useApp();
  const [form, setForm] = useState<FormState>(() => initialForm(today, vehicle, category));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  // Offices from Settings → Branches (active ones), plus the car's current branch
  const branches = useResource(branchesStore.load);
  const branchOptions = Array.from(new Set([NO_BRANCH, ...(branches.data ?? []).filter((b) => b.active).map((b) => b.name), ...(vehicle?.branch ? [vehicle.branch] : [])]));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const plate = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = 'Enter the vehicle model name';
    if (!form.number.trim()) e.number = 'Enter the registration number';
    else if (!normaliseRegistration(form.number) && plate(form.number) !== plate(vehicle?.vehicleNumber ?? '')) e.number = 'Use the format KL 13 AB 1234 (or 22 BH 1234 AB)';
    else if (vehicles.some((v) => v.id !== vehicle?.id && plate(v.vehicleNumber) === plate(form.number))) e.number = 'A vehicle with this number already exists';
    if (!ISO_DATE.test(form.purchaseDate)) e.purchaseDate = 'Use YYYY-MM-DD';
    if (!(num(form.purchaseCost) > 0)) e.purchaseCost = 'Enter the purchase cost';
    if (!(num(form.pricePerDay) > 0)) e.pricePerDay = 'Enter the daily rental price';
    if (!(num(form.seats) > 0)) e.seats = 'Enter seats';
    if (form.odometer && !(num(form.odometer) >= 0)) e.odometer = 'Enter a number';
    if (form.hasLoan) {
      if (!form.bankName.trim()) e.bankName = 'Enter the lender';
      if (!(num(form.emi) > 0)) e.emi = 'Enter the EMI';
      if (!(num(form.tenure) > 0)) e.tenure = 'Enter tenure in months';
      const paid = num(form.paidMonths || '0');
      if (!(paid >= 0) || paid > num(form.tenure)) e.paidMonths = 'Must be between 0 and tenure';
    }
    if (form.insuranceExpiry && !ISO_DATE.test(form.insuranceExpiry)) e.insuranceExpiry = 'Use YYYY-MM-DD';
    if (form.pucExpiry && !ISO_DATE.test(form.pucExpiry)) e.pucExpiry = 'Use YYYY-MM-DD';
    setErrors(e);
    if (Object.keys(e).length) {
      showToast('Please fix the highlighted fields');
      return;
    }

    const isEV = form.fuel === 'Electric';
    const fields = {
      name: form.name.trim(),
      brand: form.brand.trim() || undefined,
      type: form.type,
      kind: kindFor(form.type),
      branch: form.branch === NO_BRANCH ? undefined : form.branch,
      pricePerDay: Math.round(num(form.pricePerDay)),
      seats: Math.round(num(form.seats)),
      transmission: form.transmission,
      fuel: form.fuel,
      vehicleNumber: normaliseRegistration(form.number) ?? form.number.trim().toUpperCase(),
      purchaseCost: Math.round(num(form.purchaseCost)),
      purchaseDate: form.purchaseDate,
      loanDetails: form.hasLoan
        ? {
            bankName: form.bankName.trim(),
            accountNo: form.accountNo.trim() || 'Pending',
            emiAmount: Math.round(num(form.emi)),
            tenureMonths: Math.round(num(form.tenure)),
            paidMonths: Math.round(num(form.paidMonths || '0')),
          }
        : undefined,
      // Left empty until the real device / tag is known (a made-up id would never match the GPS server)
      gpsDeviceId: form.gpsDeviceId.trim(),
      gpsProvider: form.gpsProvider.trim() || undefined,
      gpsSim: form.gpsSim.trim() || undefined,
      fastagId: form.fastagId.trim().toUpperCase(),
      insuranceProvider: form.insuranceProvider.trim() || NOT_RECORDED,
      insurancePolicyNo: form.insurancePolicyNo.trim() || NOT_RECORDED,
      insuranceExpiry: form.insuranceExpiry || NOT_RECORDED,
      pucCertificateNo: form.pucNo.trim() || (isEV ? 'Exempt (EV)' : NOT_RECORDED),
      pucExpiry: form.pucExpiry || NOT_RECORDED,
      odometerKm: Math.round(num(form.odometer || '0')) || 0,
    };
    if (vehicle) {
      updateVehicle(vehicle.id, fields);
      saveVehicleCategory(vehicle.id, form.category);
      showToast(`${fields.name} updated`);
    } else {
      const id = `car-${Date.now().toString(36)}`;
      addVehicle({
        ...fields,
        id,
        color: DEFAULT_PAINT,
        status: 'Available',
        gps: { ...DEFAULT_HUB_GPS },
        fastagBalance: 0,
        fuelLevelPercent: 100,
        fuelHistory: [],
        photoLabels: [],
      });
      saveVehicleCategory(id, form.category);
    }
    onSaved();
    onClose();
  };

  return (
    <FormSheet
      visible
      title={vehicle ? `Edit ${vehicle.name}` : 'Add vehicle'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} />
          <Button label={vehicle ? 'Save changes' : 'Add to fleet'} onPress={submit} />
        </>
      }>
      <Text style={[styles.formSection, { marginTop: 0, paddingTop: 0, borderTopWidth: 0 }]}>Vehicle</Text>
      <FormRow>
        <Field label="Model name" required value={form.name} onChangeText={(t) => set('name', t)} placeholder="e.g. Executive Sedan" error={errors.name} />
        <Field label="Brand" value={form.brand} onChangeText={(t) => set('brand', t)} placeholder="Optional" />
      </FormRow>
      <Field label="Registration number" required value={form.number} onChangeText={(t) => set('number', t)} placeholder="e.g. KA 01 AB 1234" error={errors.number} />
      <Text style={styles.fieldLabel}>Type</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={activeNames(masterLists().vehicleTypes, vehicle?.type)} value={form.type} onChange={(t) => set('type', t)} />
      </View>
      <Text style={styles.fieldLabel}>Category</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={activeNames(masterLists().categories, category)} value={form.category} onChange={(t) => set('category', t)} />
      </View>
      <Text style={styles.fieldLabel}>Fuel type</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={activeNames(masterLists().fuelTypes, vehicle?.fuel)} value={form.fuel} onChange={(t) => set('fuel', t)} />
      </View>
      <Text style={styles.fieldLabel}>Branch</Text>
      <View style={{ marginBottom: 14 }}>
        <ChipGroup options={branchOptions} value={form.branch} onChange={(t) => set('branch', t)} />
      </View>
      <FormRow>
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.fieldLabel}>Transmission</Text>
          <SegmentedControl options={TRANSMISSIONS} value={form.transmission} onChange={(t) => set('transmission', t)} />
        </View>
        <Field label="Seats" required value={form.seats} onChangeText={(t) => set('seats', t)} keyboardType="number-pad" error={errors.seats} />
      </FormRow>
      <FormRow>
        <Field label="Current odometer (km)" value={form.odometer} onChangeText={(t) => set('odometer', t)} keyboardType="number-pad" error={errors.odometer} />
        <Field
          label="Daily rental price (₹)"
          required
          value={form.pricePerDay}
          onChangeText={(t) => set('pricePerDay', t)}
          keyboardType="number-pad"
          placeholder="e.g. 3200"
          error={errors.pricePerDay}
        />
      </FormRow>

      <Text style={styles.formSection}>Purchase</Text>
      <FormRow>
        <Field label="Purchase date" required value={form.purchaseDate} onChangeText={(t) => set('purchaseDate', t)} placeholder="YYYY-MM-DD" error={errors.purchaseDate} />
        <Field
          label="Purchase cost (₹)"
          required
          value={form.purchaseCost}
          onChangeText={(t) => set('purchaseCost', t)}
          keyboardType="number-pad"
          placeholder="e.g. 1500000"
          error={errors.purchaseCost}
        />
      </FormRow>
      <ToggleRow label="Vehicle is on a loan" description="Record the lender and EMI to track repayments" value={form.hasLoan} onValueChange={(v) => set('hasLoan', v)} />
      {form.hasLoan ? (
        <View style={{ marginTop: 12 }}>
          <FormRow>
            <Field label="Bank / lender" required value={form.bankName} onChangeText={(t) => set('bankName', t)} error={errors.bankName} />
            <Field label="Loan account no." value={form.accountNo} onChangeText={(t) => set('accountNo', t)} placeholder="Optional" />
          </FormRow>
          <FormRow cols={3}>
            <Field label="EMI (₹/month)" required value={form.emi} onChangeText={(t) => set('emi', t)} keyboardType="number-pad" error={errors.emi} />
            <Field label="Tenure (months)" required value={form.tenure} onChangeText={(t) => set('tenure', t)} keyboardType="number-pad" error={errors.tenure} />
            <Field label="EMIs already paid" value={form.paidMonths} onChangeText={(t) => set('paidMonths', t)} keyboardType="number-pad" error={errors.paidMonths} />
          </FormRow>
        </View>
      ) : null}

      <Text style={styles.formSection}>GPS & FASTag</Text>
      <FormRow>
        <Field label="GPS device ID" value={form.gpsDeviceId} onChangeText={(t) => set('gpsDeviceId', t)} placeholder="IMEI or Traccar Client ID" hint="Must match the device in the GPS server. Leave empty if not fitted yet." />
        <Field label="GPS company" value={form.gpsProvider} onChangeText={(t) => set('gpsProvider', t)} placeholder="e.g. Traccar (test phone)" />
      </FormRow>
      <FormRow>
        <Field label="GPS SIM number" value={form.gpsSim} onChangeText={(t) => set('gpsSim', t)} keyboardType="phone-pad" placeholder="Optional" />
        <Field label="FASTag ID" value={form.fastagId} onChangeText={(t) => set('fastagId', t)} placeholder="Tag number on the windscreen" />
      </FormRow>

      <Text style={styles.formSection}>Insurance</Text>
      <FormRow cols={3}>
        <Field label="Provider" value={form.insuranceProvider} onChangeText={(t) => set('insuranceProvider', t)} placeholder="e.g. HDFC ERGO" />
        <Field label="Policy no." value={form.insurancePolicyNo} onChangeText={(t) => set('insurancePolicyNo', t)} />
        <Field label="Expiry" value={form.insuranceExpiry} onChangeText={(t) => set('insuranceExpiry', t)} placeholder="YYYY-MM-DD" error={errors.insuranceExpiry} />
      </FormRow>

      <Text style={styles.formSection}>Pollution (PUC)</Text>
      <FormRow>
        <Field label="PUC certificate no." value={form.pucNo} onChangeText={(t) => set('pucNo', t)} placeholder={form.fuel === 'Electric' ? 'Exempt (EV)' : 'Optional'} />
        <Field label="PUC expiry" value={form.pucExpiry} onChangeText={(t) => set('pucExpiry', t)} placeholder="YYYY-MM-DD" error={errors.pucExpiry} />
      </FormRow>
      {vehicle ? null : (
        <SimulatedNote>GPS and FASTag provider integrations are pending. A new vehicle starts at the Indiranagar hub with a ₹0 FASTag balance.</SimulatedNote>
      )}
    </FormSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // Each group of fields starts with a clear heading on a divider line
    formSection: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 12,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    fieldLabel: { color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  });
