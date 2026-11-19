import React, { useState } from 'react';
import { Text } from 'react-native';
import { Button, ChipGroup, Field, FormRow, FormSheet } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { saveStaffProfile, type StaffProfile } from '../../services/people';
import { useThemeColors } from '../../theme';
import type { StaffPunch } from '../../types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+?[0-9\s-]{10,16}$/;
const EMPLOYMENT: StaffProfile['employment'][] = ['Full time', 'Part time', 'Contract'];

/**
 * Add a staff member who does not need to sign in (cleaner, mechanic, washer…), or edit anyone's HR details.
 * For people with a sign-in account, name, role and phone are managed in Settings → Users & Roles.
 */
export function StaffForm({ staff, profile, onClose, onSaved }: { staff?: StaffPunch; profile?: StaffProfile; onClose: () => void; onSaved: () => void }) {
  const colors = useThemeColors();
  const { addStaff, updateStaff, today, showToast } = useApp();
  const linked = !!staff?.userId;
  const [f, setF] = useState({
    name: staff?.staffName ?? '',
    role: staff?.role ?? '',
    phone: staff?.phone ?? '',
    shift: staff?.shift ?? '09:00 – 18:00',
    baseSalary: staff ? String(staff.baseSalary) : '',
    tripAllowance: staff ? String(staff.tripAllowance) : '0',
    employeeCode: profile?.employeeCode ?? '',
    email: profile?.email ?? '',
    branch: profile?.branch ?? '',
    joinedOn: profile?.joinedOn ?? today,
    employment: profile?.employment ?? ('Full time' as StaffProfile['employment']),
    emergencyContact: profile?.emergencyContact ?? '',
  });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const errors = {
    name: !f.name.trim() ? 'Enter the name' : undefined,
    role: !f.role.trim() ? 'Enter the job, e.g. Mechanic' : undefined,
    phone: f.phone.trim() && !PHONE.test(f.phone.trim()) ? 'Enter a valid phone number' : undefined,
    baseSalary: f.baseSalary.trim() && !/^\d{1,7}$/.test(f.baseSalary.trim()) ? 'Whole rupees' : undefined,
    tripAllowance: f.tripAllowance.trim() && !/^\d{1,7}$/.test(f.tripAllowance.trim()) ? 'Whole rupees' : undefined,
    joinedOn: !ISO.test(f.joinedOn) ? 'Use YYYY-MM-DD' : undefined,
    email: f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? 'Enter a valid email' : undefined,
  };
  const err = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const save = async () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    const id = staff?.id ?? `stf-m${Date.now().toString(36)}`;
    const salary = Number(f.baseSalary || 0);
    const allowance = Number(f.tripAllowance || 0);
    const punch = {
      // Linked accounts keep the name, role and phone from Users & Roles
      ...(linked ? {} : { staffName: f.name.trim(), role: f.role.trim(), phone: f.phone.trim() }),
      shift: f.shift.trim() || '09:00 – 18:00',
      baseSalary: salary,
      tripAllowance: allowance,
      netPayable: salary + allowance - (staff?.deductions ?? 0),
    };
    if (staff) updateStaff(staff.id, punch);
    else
      addStaff({
        id,
        staffName: f.name.trim(),
        role: f.role.trim(),
        phone: f.phone.trim(),
        shift: punch.shift,
        punchIn: '',
        hoursWorked: 0,
        hoursThisMonth: 0,
        overtimeHours: 0,
        baseSalary: salary,
        tripAllowance: allowance,
        deductions: 0,
        netPayable: salary + allowance,
        status: 'Punched Out',
        attendance: [],
      });
    try {
      await saveStaffProfile({
        staffId: id,
        employeeCode: f.employeeCode.trim() || id.toUpperCase(),
        email: f.email.trim(),
        branch: f.branch.trim(),
        joinedOn: f.joinedOn,
        employment: f.employment,
        emergencyContact: f.emergencyContact.trim(),
        documents: profile?.documents ?? [],
      });
      showToast(staff ? `${f.name.trim()} updated` : `${f.name.trim()} added to staff`);
      onSaved();
      onClose();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible
      title={staff ? `Edit ${staff.staffName}` : 'Add staff member'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button label={saving ? 'Saving…' : staff ? 'Save changes' : 'Add staff'} disabled={saving} onPress={save} />
        </>
      }>
      {linked ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 12 }}>This person signs in to KeyGo. Change their name, role or phone in Settings → Users & Roles.</Text>
      ) : !staff ? (
        <Text style={{ color: colors.muted, fontSize: 12.5, marginBottom: 12 }}>For people who don’t sign in, like cleaners or mechanics. People with a sign-in appear here automatically from Settings → Users & Roles.</Text>
      ) : null}
      <FormRow>
        <Field label="Full name" required value={f.name} onChangeText={set('name')} editable={!linked} error={err('name')} />
        <Field label="Job / role" required value={f.role} onChangeText={set('role')} editable={!linked} placeholder="e.g. Mechanic" error={err('role')} />
      </FormRow>
      <FormRow>
        <Field label="Phone" value={f.phone} onChangeText={set('phone')} editable={!linked} keyboardType="phone-pad" error={err('phone')} />
        <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" error={err('email')} />
      </FormRow>
      <FormRow>
        <Field label="Employee code" value={f.employeeCode} onChangeText={set('employeeCode')} placeholder="Optional, e.g. KG-012" />
        <Field label="Branch" value={f.branch} onChangeText={set('branch')} placeholder="Optional" />
      </FormRow>
      <FormRow>
        <Field label="Joined on" required value={f.joinedOn} onChangeText={set('joinedOn')} placeholder="YYYY-MM-DD" error={err('joinedOn')} />
        <Field label="Shift" value={f.shift} onChangeText={set('shift')} placeholder="09:00 – 18:00" />
      </FormRow>
      <FormRow>
        <Field label="Monthly salary (₹)" value={f.baseSalary} onChangeText={set('baseSalary')} keyboardType="number-pad" placeholder="0" error={err('baseSalary')} />
        <Field label="Trip allowance (₹)" value={f.tripAllowance} onChangeText={set('tripAllowance')} keyboardType="number-pad" error={err('tripAllowance')} />
      </FormRow>
      <Text style={{ color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>Employment</Text>
      <ChipGroup options={EMPLOYMENT} value={f.employment} onChange={(v) => setF((p) => ({ ...p, employment: v }))} />
      <Field label="Emergency contact" value={f.emergencyContact} onChangeText={set('emergencyContact')} placeholder="Name and phone" style={{ marginTop: 12 }} />
    </FormSheet>
  );
}
