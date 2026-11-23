import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Card, ChipGroup, Field, FormRow, Section, SimulatedNote, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemedStyles } from '../../theme';
import { bookingRulesStore, DEFAULT_BOOKING_RULES, policiesStore, type BookingPolicies, type BookingRulesSetting } from '../../services/settings';
import { SelectField } from '../../components/portal/SelectField';
import { WithStore } from '../notifications/listControls';
import { FormActions, isWholeNumber, makeSettingsStyles } from './formParts';

const FUEL_POLICIES = ['Same to same', 'Full to full', 'Prepaid'] as const;
type NumberKey = 'minDriverAge' | 'minAdvanceHours' | 'freeCancelHours' | 'cancellationFeePercent' | 'lateGraceMinutes' | 'lateFeePerHour' | 'kmLimitPerDay' | 'extraKmCharge';

export default function BookingPoliciesTab() {
  return (
    <View>
      <WithStore store={bookingRulesStore}>{(rules, save) => <BookingRulesForm rules={rules} save={save} />}</WithStore>
      <WithStore store={policiesStore}>{(policies, save) => <PoliciesForm policies={policies} save={save} />}</WithStore>
    </View>
  );
}

const VALIDITY = ['12 hours', '24 hours', '48 hours', '72 hours', '7 days'] as const;
const VALIDITY_HOURS: Record<(typeof VALIDITY)[number], number> = { '12 hours': 12, '24 hours': 24, '48 hours': 48, '72 hours': 72, '7 days': 168 };
const DAYS_BEFORE = ['1 day', '2 days', '3 days', '5 days', '7 days'] as const;
/** Reminder times offered, 6 AM to 9 PM on the hour and half hour (saved as 24-hour "HH:MM"). */
const REMINDER_TIMES = Array.from({ length: 31 }, (_, i) => {
  const h = 6 + Math.floor(i / 2);
  const m = i % 2 ? '30' : '00';
  return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}` };
});

/** Quotation validity and the automatic pickup reminder (the server applies these). */
function BookingRulesForm({ rules, save }: { rules: BookingRulesSetting; save: (r: BookingRulesSetting) => void }) {
  const { showToast } = useApp();
  const start = { ...DEFAULT_BOOKING_RULES, ...rules, reminder: { ...DEFAULT_BOOKING_RULES.reminder, ...(rules?.reminder ?? {}) } };
  const [form, setForm] = useState<BookingRulesSetting>(start);
  const dirty = JSON.stringify(form) !== JSON.stringify(start);
  const validity = (Object.keys(VALIDITY_HOURS) as (typeof VALIDITY)[number][]).find((k) => VALIDITY_HOURS[k] === form.quoteValidHours) ?? '48 hours';
  const before = (DAYS_BEFORE.find((d) => parseInt(d, 10) === form.reminder.daysBefore) ?? '2 days') as (typeof DAYS_BEFORE)[number];
  const timeLabel = REMINDER_TIMES.find((t) => t.value === form.reminder.time)?.label ?? '9:00 AM';
  const setReminder = (p: Partial<BookingRulesSetting['reminder']>) => setForm((f) => ({ ...f, reminder: { ...f.reminder, ...p } }));
  return (
    <Section title="Quotations and pickup reminder" subtitle="Used by the server for every booking">
      <Card>
        <SelectField
          label="A quotation can be confirmed for"
          value={validity}
          options={VALIDITY}
          onChange={(v) => setForm((f) => ({ ...f, quoteValidHours: VALIDITY_HOURS[v] }))}
          hint="After that it shows as Expired; staff can renew it."
        />
        <ToggleRow
          label="Pickup reminder"
          description="Sent to the customer before pickup: in the app, and by WhatsApp below"
          value={form.reminder.enabled}
          onValueChange={(enabled) => setReminder({ enabled })}
        />
        {form.reminder.enabled ? (
          <>
            <FormRow>
              <SelectField label="Send it" value={before} options={DAYS_BEFORE} onChange={(v) => setReminder({ daysBefore: parseInt(v, 10) })} hint="Before the pickup day" />
              <SelectField
                label="At"
                value={timeLabel}
                options={REMINDER_TIMES.map((t) => t.label)}
                onChange={(label) => setReminder({ time: REMINDER_TIMES.find((t) => t.label === label)?.value ?? '09:00' })}
                hint="India time"
              />
            </FormRow>
            <ToggleRow
              label="Also send by WhatsApp"
              description="From KeyGo's linked number (System → WhatsApp & SMS)"
              value={form.reminder.whatsapp}
              onValueChange={(whatsapp) => setReminder({ whatsapp })}
            />
          </>
        ) : null}
        <FormActions
          dirty={dirty}
          onSave={() => {
            save(form);
            showToast('Quotation and reminder settings saved');
          }}
          onReset={() => setForm(start)}
        />
      </Card>
    </Section>
  );
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
