import React, { useState } from 'react';
import { View } from 'react-native';
import { Card, Field, FormRow, Section } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { companyStore, type CompanyProfile } from '../../services/settings';
import { WithStore } from '../notifications/listControls';
import { FormActions, isEmail, isPhone } from './formParts';

export default function CompanyProfileTab() {
  return <WithStore store={companyStore}>{(profile, save) => <ProfileForm profile={profile} save={save} />}</WithStore>;
}

function ProfileForm({ profile, save }: { profile: CompanyProfile; save: (p: CompanyProfile) => void }) {
  const { showToast } = useApp();
  const [form, setForm] = useState(profile);
  const [touched, setTouched] = useState(false);
  const set = (key: keyof CompanyProfile) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const errors: Partial<Record<keyof CompanyProfile, string>> = {
    name: !form.name.trim() ? 'Display name is required' : undefined,
    legalName: !form.legalName.trim() ? 'Legal name is required' : undefined,
    gstin: !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin.trim()) ? 'Enter a 15-character GSTIN, e.g. 29AAKCK1234F1Z5' : undefined,
    pan: !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan.trim()) ? 'Enter a 10-character PAN, e.g. AAKCK1234F' : undefined,
    phone: !isPhone(form.phone) ? 'Enter a valid phone number' : undefined,
    email: !isEmail(form.email) ? 'Enter a valid email address' : undefined,
    website: !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(form.website.trim()) ? 'Enter a full https:// URL' : undefined,
    address: !form.address.trim() ? 'Address is required' : undefined,
  };
  const err = (key: keyof CompanyProfile) => (touched ? errors[key] : undefined);
  const dirty = JSON.stringify(form) !== JSON.stringify(profile);

  const submit = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    save(form);
    setTouched(false);
    showToast('Company profile saved');
  };

  return (
    <View>
      <Section title="Business details" subtitle="Shown on agreements, invoices and customer messages" style={{ marginTop: 0 }}>
        <Card>
          <FormRow>
            <Field label="Display name" required value={form.name} onChangeText={set('name')} error={err('name')} />
            <Field label="Legal name" required value={form.legalName} onChangeText={set('legalName')} error={err('legalName')} />
          </FormRow>
          <FormRow>
            <Field label="GSTIN" required value={form.gstin} onChangeText={(v) => set('gstin')(v.toUpperCase())} error={err('gstin')} />
            <Field label="PAN" required value={form.pan} onChangeText={(v) => set('pan')(v.toUpperCase())} error={err('pan')} />
          </FormRow>
        </Card>
      </Section>
      <Section title="Contact" subtitle="How customers reach you">
        <Card>
          <FormRow>
            <Field label="Phone" required value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={err('phone')} />
            <Field label="Email" required value={form.email} onChangeText={set('email')} keyboardType="email-address" error={err('email')} />
          </FormRow>
          <FormRow>
            <Field label="Website" required value={form.website} onChangeText={set('website')} keyboardType="url" error={err('website')} />
            <Field label="Support hours" value={form.supportHours} onChangeText={set('supportHours')} />
          </FormRow>
          <Field label="Registered address" required multiline value={form.address} onChangeText={set('address')} error={err('address')} />
          <FormActions
            dirty={dirty}
            onSave={submit}
            onReset={() => {
              setForm(profile);
              setTouched(false);
            }}
          />
        </Card>
      </Section>
    </View>
  );
}
