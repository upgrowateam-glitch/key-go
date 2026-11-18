import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, ChipGroup, Field, FormRow, FormSheet } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { formatDate } from '../../lib/format';
import { ActivityInput, logCustomerActivity } from '../../services/customers';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Customer } from '../../types';
import { licenceState, makeStyles, maskAadhaar, maskLicence } from './shared';

type Draft = Omit<Customer, 'id'>;

const TIERS: readonly Customer['loyaltyTier'][] = ['Bronze', 'Silver', 'Gold', 'VIP'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const blankDraft = (today: string, avatarBg: string): Draft => ({
  name: '',
  firstName: '',
  lastName: '',
  dob: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  aadhaarNo: '',
  idCardStatus: 'Not uploaded',
  faceVerification: 'Not uploaded',
  photoCaptured: false,
  dlNumber: '',
  dlState: '',
  dlExpiry: '',
  careOfName: '',
  careOfRelation: '',
  careOfPhone: '',
  customerCode: '',
  documents: [
    { id: `doc-${Date.now()}-1`, name: 'Aadhaar card (front & back)', kind: 'ID card', status: 'Not uploaded' },
    { id: `doc-${Date.now()}-2`, name: 'Driving licence', kind: 'Driving licence', status: 'Not uploaded' },
    { id: `doc-${Date.now()}-3`, name: 'Address proof', kind: 'Address proof', status: 'Not uploaded' },
  ],
  customerSince: today,
  loyaltyTier: 'Bronze',
  loyaltyPoints: 0,
  avatarBg,
  trustRating: 5,
});

const AUDITED: { key: keyof Draft; label: string; mask?: (v: string) => string }[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'dob', label: 'Date of birth' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'aadhaarNo', label: 'Aadhaar / ID number', mask: maskAadhaar },
  { key: 'dlNumber', label: 'Licence number', mask: maskLicence },
  { key: 'dlState', label: 'Licence state' },
  { key: 'dlExpiry', label: 'Licence expiry' },
  { key: 'careOfName', label: 'C/O name' },
  { key: 'careOfRelation', label: 'C/O relation' },
  { key: 'careOfPhone', label: 'C/O phone' },
  { key: 'customerCode', label: 'Customer code' },
  { key: 'loyaltyTier', label: 'Loyalty tier' },
];

/** Create or edit a customer. Mount it only while open, so each opening starts from the current record. */
export function CustomerForm({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: (id: string) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { today, addCustomer, updateCustomer, showToast } = useApp();
  const [draft, setDraft] = useState<Draft>(() => {
    if (!customer) return blankDraft(today, colors.secondarySoft);
    const { id: _id, ...rest } = customer;
    return rest;
  });
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const lic = licenceState(draft.dlExpiry, today);
  const aadhaarDigits = draft.aadhaarNo.replace(/\D/g, '');
  const aadhaarOk = !draft.aadhaarNo.trim() || aadhaarDigits.length === 12 || /^X{4}-?X{4}-?\d{4}$/i.test(draft.aadhaarNo.trim());
  const errors: Record<string, string | undefined> = {
    firstName: !draft.firstName.trim() ? 'First name is required' : undefined,
    lastName: !draft.lastName.trim() ? 'Last name is required' : undefined,
    phone: draft.phone.replace(/\D/g, '').length < 10 ? 'Enter a valid phone number (10+ digits)' : undefined,
    dlNumber: !draft.dlNumber.trim() ? 'Driving licence number is required' : undefined,
    dob: draft.dob && !DATE_RE.test(draft.dob) ? 'Use YYYY-MM-DD' : draft.dob > today ? 'Date of birth is in the future' : undefined,
    dlExpiry: draft.dlExpiry && !DATE_RE.test(draft.dlExpiry) ? 'Use YYYY-MM-DD' : undefined,
    email: draft.email && !/^\S+@\S+\.\S+$/.test(draft.email) ? 'Enter a valid email' : undefined,
    aadhaarNo: aadhaarOk ? undefined : 'Enter the 12-digit number',
  };
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      showToast('Please fix the highlighted fields');
      return;
    }
    const clean: Draft = {
      ...draft,
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      name: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(),
      phone: draft.phone.trim(),
      dlNumber: draft.dlNumber.trim().toUpperCase(),
      // Only the masked form is kept: the full Aadhaar number is never stored in the portal
      aadhaarNo: aadhaarDigits.length === 12 ? maskAadhaar(draft.aadhaarNo) : draft.aadhaarNo.trim(),
    };
    if (customer) {
      const changes: ActivityInput[] = AUDITED.filter(({ key }) => customer[key] !== clean[key]).map(({ key, label, mask }) => {
        const show = (v: unknown) => (mask ? mask(String(v)) : String(v) || '—');
        return { action: 'Profile edited', field: label, previous: show(customer[key]), next: show(clean[key]) };
      });
      if (changes.length) {
        updateCustomer(customer.id, clean);
        logCustomerActivity(customer.id, changes);
      }
      showToast(changes.length ? 'Customer profile saved' : 'No changes to save');
      onSaved(customer.id);
    } else {
      const id = `cust-${Date.now()}`;
      addCustomer({ ...clean, id });
      logCustomerActivity(id, [{ action: 'Profile created' }]);
      onSaved(id);
    }
    onClose();
  };

  return (
    <FormSheet
      visible
      title={customer ? `Edit ${customer.name}` : 'Add customer'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={customer ? 'Save changes' : 'Create customer'} onPress={save} />
        </>
      }>
      <Text style={styles.fieldLabel}>Personal details</Text>
      <FormRow>
        <Field label="First name" required value={draft.firstName} onChangeText={(v) => set('firstName', v)} error={err('firstName')} />
        <Field label="Last name" required value={draft.lastName} onChangeText={(v) => set('lastName', v)} error={err('lastName')} />
      </FormRow>
      <FormRow>
        <Field label="Date of birth" value={draft.dob} onChangeText={(v) => set('dob', v)} placeholder="YYYY-MM-DD" error={err('dob')} />
        <Field label="Phone" required value={draft.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" placeholder="+91 98xxx xxxxx" error={err('phone')} />
      </FormRow>
      <Field label="Email" value={draft.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" placeholder="name@example.com" error={err('email')} />
      <FormRow>
        <Field label="Address" value={draft.address} onChangeText={(v) => set('address', v)} placeholder="House, street, area" />
        <Field label="City" value={draft.city} onChangeText={(v) => set('city', v)} placeholder="City" />
      </FormRow>

      <Text style={styles.fieldLabel}>Identity</Text>
      <Field
        label="Aadhaar / ID number"
        value={draft.aadhaarNo}
        onChangeText={(v) => set('aadhaarNo', v)}
        placeholder="XXXX-XXXX-1234"
        hint="Saved masked: only the last 4 digits are kept"
        error={err('aadhaarNo')}
      />

      <Text style={styles.fieldLabel}>Driving licence</Text>
      <FormRow cols={3}>
        <Field label="Licence number" required value={draft.dlNumber} onChangeText={(v) => set('dlNumber', v)} placeholder="KA01 20210012345" error={err('dlNumber')} />
        <Field label="Issuing state" value={draft.dlState} onChangeText={(v) => set('dlState', v)} placeholder="Karnataka" />
        <Field
          label="Expiry date"
          value={draft.dlExpiry}
          onChangeText={(v) => set('dlExpiry', v)}
          placeholder="YYYY-MM-DD"
          error={err('dlExpiry') ?? (lic === 'Expired' ? `Expired on ${formatDate(draft.dlExpiry)}: renting is not allowed` : undefined)}
          hint={lic === 'Expiring' ? `Expires ${formatDate(draft.dlExpiry)}` : undefined}
        />
      </FormRow>

      <Text style={styles.fieldLabel}>Care-of contact</Text>
      <FormRow cols={3}>
        <Field label="C/O name" value={draft.careOfName} onChangeText={(v) => set('careOfName', v)} placeholder="Full name" />
        <Field label="Relation" value={draft.careOfRelation} onChangeText={(v) => set('careOfRelation', v)} placeholder="Father, spouse…" />
        <Field label="C/O phone" value={draft.careOfPhone} onChangeText={(v) => set('careOfPhone', v)} keyboardType="phone-pad" />
      </FormRow>

      <Text style={styles.fieldLabel}>Customer code & loyalty</Text>
      <Field
        label="Customer code"
        value={draft.customerCode}
        onChangeText={(v) => set('customerCode', v.toUpperCase())}
        placeholder="e.g. CORP-ROYAL"
        hint="Referral / commission code: percentages are managed in Customer codes"
      />
      <Text style={styles.fieldLabel}>Loyalty tier</Text>
      <View>
        <ChipGroup options={TIERS} value={draft.loyaltyTier} onChange={(t) => set('loyaltyTier', t)} />
      </View>
    </FormSheet>
  );
}
