import { useRouter } from '@/shims/expo-router';
import { Settings2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, FormRow, Section, SimulatedNote, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { notificationPrefsStore, type NotificationPreferences } from '../../services/settings';
import { WithStore } from '../notifications/listControls';
import { FormActions, isEmail, isPhone, isTime } from './formParts';

export default function NotificationSettingsTab() {
  return <WithStore store={notificationPrefsStore}>{(prefs, save) => <PrefsForm prefs={prefs} save={save} />}</WithStore>;
}

function PrefsForm({ prefs, save }: { prefs: NotificationPreferences; save: (p: NotificationPreferences) => void }) {
  const { notificationSettings, toggleNotificationChannel, showToast } = useApp();
  const router = useRouter();
  const [form, setForm] = useState(prefs);
  const [touched, setTouched] = useState(false);
  const patch = (p: Partial<NotificationPreferences>) => setForm((f) => ({ ...f, ...p }));

  const errors = {
    quietStart: form.quietHours && !isTime(form.quietStart) ? 'Use 24-hour HH:MM' : undefined,
    quietEnd: form.quietHours && !isTime(form.quietEnd) ? 'Use 24-hour HH:MM' : undefined,
    opsEmail: !isEmail(form.opsEmail) ? 'Enter a valid email address' : undefined,
    accountsEmail: !isEmail(form.accountsEmail) ? 'Enter a valid email address' : undefined,
    escalationPhone: !isPhone(form.escalationPhone) ? 'Enter a valid phone number' : undefined,
  };
  const err = (k: keyof typeof errors) => (touched ? errors[k] : undefined);
  const dirty = JSON.stringify(form) !== JSON.stringify(prefs);

  return (
    <View>
      <SimulatedNote>Real WhatsApp, SMS and email integration is pending. These settings are saved here and no message is sent.</SimulatedNote>
      <Section
        title="Reminder channels"
        subtitle="The same switches as Notifications, WhatsApp & SMS Settings"
        action={<Button label="Providers and templates" size="sm" variant="outline" icon={(c) => <Settings2 size={14} color={c} />} onPress={() => router.push('/notifications?tab=whatsapp-and-sms-settings')} />}>
        <Card>
          {notificationSettings.flatMap((s) => [
            <ToggleRow key={`${s.type}-wa`} label={`${s.label}: WhatsApp`} description={s.leadTime} value={s.whatsapp} onValueChange={() => toggleNotificationChannel(s.type, 'whatsapp')} />,
            <ToggleRow key={`${s.type}-sms`} label={`${s.label}: SMS`} description={s.leadTime} value={s.sms} onValueChange={() => toggleNotificationChannel(s.type, 'sms')} />,
          ])}
        </Card>
      </Section>
      <Section title="Quiet hours" subtitle="Hold customer messages overnight">
        <Card>
          <ToggleRow label="Use quiet hours" description="Messages due in this window wait until it ends" value={form.quietHours} onValueChange={(quietHours) => patch({ quietHours })} />
          {form.quietHours ? (
            <FormRow>
              <Field label="From" value={form.quietStart} placeholder="HH:MM" onChangeText={(quietStart) => patch({ quietStart })} error={err('quietStart')} />
              <Field label="To" value={form.quietEnd} placeholder="HH:MM" onChangeText={(quietEnd) => patch({ quietEnd })} error={err('quietEnd')} />
            </FormRow>
          ) : null}
          <ToggleRow label="Let customers opt out" description="Adds a stop option to marketing messages" value={form.customerOptOut} onValueChange={(customerOptOut) => patch({ customerOptOut })} />
          <ToggleRow label="Daily digest for managers" description="One summary of open reminders each morning" value={form.dailyDigest} onValueChange={(dailyDigest) => patch({ dailyDigest })} />
        </Card>
      </Section>
      <Section title="Internal recipients" subtitle="Who gets operations and accounts alerts">
        <Card>
          <FormRow>
            <Field label="Operations email" required value={form.opsEmail} keyboardType="email-address" onChangeText={(opsEmail) => patch({ opsEmail })} error={err('opsEmail')} />
            <Field label="Accounts email" required value={form.accountsEmail} keyboardType="email-address" onChangeText={(accountsEmail) => patch({ accountsEmail })} error={err('accountsEmail')} />
          </FormRow>
          <Field label="Escalation phone" required value={form.escalationPhone} keyboardType="phone-pad" hint="For overdue returns" onChangeText={(escalationPhone) => patch({ escalationPhone })} error={err('escalationPhone')} />
          <FormActions
            dirty={dirty}
            onSave={() => {
              setTouched(true);
              if (Object.values(errors).some(Boolean)) return;
              save(form);
              setTouched(false);
              showToast('Notification settings saved');
            }}
            onReset={() => {
              setForm(prefs);
              setTouched(false);
            }}
          />
        </Card>
      </Section>
    </View>
  );
}
