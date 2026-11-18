import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, ChipGroup, Field, FormRow, Section, SimulatedNote, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemedStyles } from '../../theme';
import { policiesStore, type BookingPolicies } from '../../services/settings';
import { WithStore } from '../notifications/listControls';
import { FormActions, isWholeNumber, makeSettingsStyles } from './formParts';

const FUEL_POLICIES = ['Same to same', 'Full to full', 'Prepaid'] as const;
type NumberKey = 'minDriverAge' | 'minAdvanceHours' | 'freeCancelHours' | 'cancellationFeePercent' | 'lateGraceMinutes' | 'lateFeePerHour' | 'kmLimitPerDay' | 'extraKmCharge';

export default function BookingPoliciesTab() {
  return <WithStore store={policiesStore}>{(policies, save) => <PoliciesForm policies={policies} save={save} />}</WithStore>;
}

function PoliciesForm({ policies, save }: { policies: BookingPolicies; save: (p: BookingPolicies) => void }) {
  const { showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const [form, setForm] = useState(policies);
  const [touched, setTouched] = useState(false);
  const patch = (p: Partial<BookingPolicies>) => setForm((f) => ({ ...f, ...p }));

  const errors: Partial<Record<NumberKey, string>> = {};
  (['minAdvanceHours', 'freeCancelHours', 'lateGraceMinutes', 'lateFeePerHour', 'kmLimitPerDay', 'extraKmCharge'] as NumberKey[]).forEach((k) => {
    if (!isWholeNumber(form[k])) errors[k] = 'Enter a whole number';
  });
  const age = Number(form.minDriverAge);
  if (!isWholeNumber(form.minDriverAge) || age < 18 || age > 80) errors.minDriverAge = 'Enter an age from 18 to 80';
  if (!isWholeNumber(form.cancellationFeePercent) || Number(form.cancellationFeePercent) > 100) errors.cancellationFeePercent = 'Enter a percentage from 0 to 100';

  const dirty = JSON.stringify(form) !== JSON.stringify(policies);
  const number = (key: NumberKey, label: string, hint?: string) => (
    <Field label={label} required value={form[key]} keyboardType="number-pad" hint={hint} onChangeText={(v) => patch({ [key]: v })} error={touched ? errors[key] : undefined} />
  );

  return (
    <View>
      <SimulatedNote>Policies are saved on this page. The booking flow starts applying them when the backend exists.</SimulatedNote>
      <Section title="Eligibility and lead time" subtitle="Who can book, and how early">
        <Card>
          <FormRow>
            {number('minDriverAge', 'Minimum driver age')}
            {number('minAdvanceHours', 'Minimum notice (hours)', 'Before pickup')}
          </FormRow>
          <ToggleRow label="Driving licence required" description="Verified before the agreement is signed" value={form.requireLicence} onValueChange={(requireLicence) => patch({ requireLicence })} />
          <ToggleRow label="Aadhaar required" description="ID proof on the customer profile" value={form.requireAadhaar} onValueChange={(requireAadhaar) => patch({ requireAadhaar })} />
          <ToggleRow label="Face verification required" description="Photo check at pickup" value={form.requireFaceCheck} onValueChange={(requireFaceCheck) => patch({ requireFaceCheck })} />
          <ToggleRow label="Allow outstation trips" description="Travel outside the branch's state" value={form.allowOutstation} onValueChange={(allowOutstation) => patch({ allowOutstation })} />
        </Card>
      </Section>
      <Section title="Cancellation and late return" subtitle="Applied when a booking changes">
        <Card>
          <FormRow>
            {number('freeCancelHours', 'Free cancellation (hours)', 'Before pickup')}
            {number('cancellationFeePercent', 'Cancellation fee %')}
          </FormRow>
          <FormRow>
            {number('lateGraceMinutes', 'Grace period (minutes)')}
            {number('lateFeePerHour', 'Late fee per hour (₹)')}
          </FormRow>
        </Card>
      </Section>
      <Section title="Mileage and fuel" subtitle="Included distance and fuel handling">
        <Card>
          <FormRow>
            {number('kmLimitPerDay', 'Km limit per day')}
            {number('extraKmCharge', 'Extra km charge (₹)')}
          </FormRow>
          <Text style={styles.label}>Fuel policy</Text>
          <ChipGroup options={FUEL_POLICIES} value={form.fuelPolicy} onChange={(fuelPolicy) => patch({ fuelPolicy })} />
          <FormActions
            dirty={dirty}
            onSave={() => {
              setTouched(true);
              if (Object.keys(errors).length > 0) return;
              save(form);
              setTouched(false);
              showToast('Booking policies saved');
            }}
            onReset={() => {
              setForm(policies);
              setTouched(false);
            }}
          />
        </Card>
      </Section>
    </View>
  );
}
