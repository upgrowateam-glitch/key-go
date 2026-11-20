import React, { useState } from 'react';
import { Button, Field, FormRow, FormSheet } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { checkLicence } from '../../lib/licence';
import type { Driver } from '../../types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+?[0-9\s-]{10,16}$/;

/** Add a driver, or edit one's details. Mount only while open. */
export function DriverForm({ driver, onClose, onSaved }: { driver?: Driver; onClose: () => void; onSaved?: (d: Driver) => void }) {
  const { drivers, addDriver, updateDriver, today, showToast } = useApp();
  const [f, setF] = useState({
    name: driver?.name ?? '',
    phone: driver?.phone ?? '',
    licenseNo: driver?.licenseNo ?? '',
    licenseState: driver?.licenseState ?? '',
    licenseExpiry: driver?.licenseExpiry ?? '',
    joinedOn: driver?.joinedOn ?? today,
    monthlySalary: driver ? String(driver.monthlySalary) : '',
    commissionPercent: driver ? String(driver.commissionPercent) : '10',
  });
  const [touched, setTouched] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const lic = (s: string) => s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  // Numbers already on file are left alone; new or changed ones must be in the standard format
  const licenceUnchanged = !!driver && lic(driver.licenseNo) === lic(f.licenseNo);
  const licence = checkLicence(f.licenseNo);
  const errors = {
    name: !f.name.trim() ? 'Enter the driver’s name' : undefined,
    phone: !PHONE.test(f.phone.trim()) ? 'Enter a valid phone number' : undefined,
    licenseNo: !f.licenseNo.trim()
      ? 'Enter the licence number'
      : drivers.some((d) => d.id !== driver?.id && lic(d.licenseNo) === lic(f.licenseNo))
        ? 'Another driver has this licence number'
        : !licenceUnchanged && 'error' in licence
          ? licence.error
          : undefined,
    licenseState: !f.licenseState.trim() ? 'Enter the state' : undefined,
    licenseExpiry: !ISO.test(f.licenseExpiry) ? 'Use YYYY-MM-DD' : undefined,
    joinedOn: !ISO.test(f.joinedOn) ? 'Use YYYY-MM-DD' : undefined,
    monthlySalary: f.monthlySalary.trim() && !/^\d{1,7}$/.test(f.monthlySalary.trim()) ? 'Whole rupees' : undefined,
    commissionPercent: !/^\d{1,2}(\.\d)?$|^100$/.test(f.commissionPercent.trim()) ? '0 to 100' : undefined,
  };
  const bad = Object.values(errors).some(Boolean);
  const err = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const save = () => {
    setTouched(true);
    if (bad) return;
    const fields = {
      name: f.name.trim(),
      phone: f.phone.trim(),
      licenseNo: !licenceUnchanged && 'number' in licence ? licence.number : f.licenseNo.trim().toUpperCase(),
      licenseState: f.licenseState.trim(),
      licenseExpiry: f.licenseExpiry,
      joinedOn: f.joinedOn,
      monthlySalary: Number(f.monthlySalary || 0),
      commissionPercent: Number(f.commissionPercent),
    };
    if (driver) {
      updateDriver(driver.id, fields);
      showToast(`${fields.name} updated`);
      onSaved?.({ ...driver, ...fields });
    } else {
      const created: Driver = {
        ...fields,
        id: `drv-${Date.now().toString(36)}`,
        dutyStatus: 'Off Duty',
        rating: 5,
        tripsThisMonth: 0,
        tripRevenueThisMonth: 0,
        documents: [],
        assignments: [],
        avatarBg: '#DCE8DE',
      };
      addDriver(created);
      showToast(`${fields.name} added. To let them sign in, add a Driver account in Settings → Users & Roles.`);
      onSaved?.(created);
    }
    onClose();
  };

  return (
    <FormSheet
      visible
      title={driver ? `Edit ${driver.name}` : 'Add driver'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={driver ? 'Save changes' : 'Add driver'} onPress={save} />
        </>
      }>
      <FormRow>
        <Field label="Full name" required value={f.name} onChangeText={set('name')} error={err('name')} />
        <Field label="Phone" required value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+91 98765 43210" error={err('phone')} />
      </FormRow>
      <FormRow>
        <Field label="Driving licence number" required value={f.licenseNo} onChangeText={(v) => {
            set('licenseNo')(v);
            const ok = checkLicence(v);
            if ('state' in ok && !f.licenseState.trim()) set('licenseState')(ok.state);
          }} placeholder="e.g. KL13 20190012345" error={err('licenseNo')} />
        <Field label="Licence state" required value={f.licenseState} onChangeText={set('licenseState')} placeholder="e.g. Kerala" error={err('licenseState')} />
      </FormRow>
      <FormRow>
        <Field label="Licence valid till" required value={f.licenseExpiry} onChangeText={set('licenseExpiry')} placeholder="YYYY-MM-DD" error={err('licenseExpiry')} />
        <Field label="Joined on" required value={f.joinedOn} onChangeText={set('joinedOn')} placeholder="YYYY-MM-DD" error={err('joinedOn')} />
      </FormRow>
      <FormRow>
        <Field label="Monthly salary (₹)" value={f.monthlySalary} onChangeText={set('monthlySalary')} keyboardType="number-pad" placeholder="0" error={err('monthlySalary')} />
        <Field label="Commission on trips (%)" value={f.commissionPercent} onChangeText={set('commissionPercent')} keyboardType="decimal-pad" error={err('commissionPercent')} />
      </FormRow>
    </FormSheet>
  );
}
