import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Unplug } from 'lucide-react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, Field, FormRow, Section, SimulatedNote, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemedStyles } from '../../theme';
import { paymentStore, type PaymentSettings } from '../../services/settings';
import { WithStore } from '../notifications/listControls';
import { FormActions, isWholeNumber, makeSettingsStyles } from './formParts';

const GATEWAYS = ['Razorpay', 'PayU', 'Cashfree'] as const;

export default function PaymentSettingsTab() {
  return <WithStore store={paymentStore}>{(settings, save) => <PaymentForm settings={settings} save={save} />}</WithStore>;
}

function PaymentForm({ settings, save }: { settings: PaymentSettings; save: (s: PaymentSettings) => void }) {
  const { showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const [form, setForm] = useState(settings);
  const [touched, setTouched] = useState(false);
  const [clearing, setClearing] = useState(false);
  const patch = (p: Partial<PaymentSettings>) => setForm((f) => ({ ...f, ...p }));

  const noMethod = !form.cash && !form.upi && !form.card && !form.bankTransfer;
  const errors = {
    upiId: form.upi && !/^[\w.-]+@[\w.-]+$/.test(form.upiId.trim()) ? 'Enter a valid UPI ID, e.g. keygo@okhdfcbank' : undefined,
    accountName: form.bankTransfer && !form.accountName.trim() ? 'Account name is required' : undefined,
    accountNumber: form.bankTransfer && !/^\d{9,18}$/.test(form.accountNumber.trim()) ? 'Enter 9 to 18 digits' : undefined,
    ifsc: form.bankTransfer && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim()) ? 'Enter an 11-character IFSC, e.g. HDFC0001234' : undefined,
    invoicePrefix: !/^[A-Z0-9-]{2,10}$/.test(form.invoicePrefix.trim()) ? '2 to 10 capital letters, numbers or hyphens' : undefined,
    refundDays: !isWholeNumber(form.refundDays) ? 'Enter a whole number of days' : undefined,
  };
  const invalid = noMethod || Object.values(errors).some(Boolean);
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const err = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const saveGateway = () => {
    setTouched(true);
    if (!form.merchantId.trim()) return;
    const next = { ...settings, gateway: form.gateway, merchantId: form.merchantId.trim(), gatewayConfigured: true };
    save(next);
    setForm((f) => ({ ...f, merchantId: next.merchantId, gatewayConfigured: true }));
    showToast('Gateway details saved (simulated: nothing is connected)');
  };

  return (
    <View>
      <Section title="Payment methods" subtitle="What staff can record against a booking" style={{ marginTop: 0 }}>
        <Card>
          <ToggleRow label="Cash" description="Collected at the branch" value={form.cash} onValueChange={(cash) => patch({ cash })} />
          <ToggleRow label="UPI" description="Shared UPI ID or QR code" value={form.upi} onValueChange={(upi) => patch({ upi })} />
          <ToggleRow label="Card" description="Card machine at the branch" value={form.card} onValueChange={(card) => patch({ card })} />
          <ToggleRow label="Bank transfer" description="NEFT or IMPS to the company account" value={form.bankTransfer} onValueChange={(bankTransfer) => patch({ bankTransfer })} />
          {noMethod ? <Text style={styles.error}>Keep at least one payment method on</Text> : null}
        </Card>
      </Section>

      <Section title="Payment gateway" subtitle="Online payments and refunds">
        <SimulatedNote>Real payment gateway integration is pending. No payment is taken and no connection is made.</SimulatedNote>
        <Card style={{ marginTop: 8 }}>
          <View style={styles.rowHead}>
            <Text style={[styles.title, { flex: 1 }]}>{form.gateway}</Text>
            <Badge label={settings.gatewayConfigured ? 'Details saved — not connected' : 'Not connected — simulated'} tone="warning" />
          </View>
          <ChipGroup options={GATEWAYS} value={form.gateway} onChange={(gateway) => patch({ gateway })} />
          <View style={{ height: 14 }} />
          <Field
            label="Merchant ID"
            value={form.merchantId}
            onChangeText={(merchantId) => patch({ merchantId })}
            placeholder="From your gateway dashboard"
            error={touched && !form.merchantId.trim() && !settings.gatewayConfigured ? 'Merchant ID is required to save gateway details' : undefined}
          />
          <View style={styles.actions}>
            <Button label="Save gateway details" size="sm" onPress={saveGateway} />
            {settings.gatewayConfigured ? <Button label="Clear" size="sm" variant="ghost" icon={(c) => <Unplug size={14} color={c} />} onPress={() => setClearing(true)} /> : null}
          </View>
        </Card>
      </Section>

      <Section title="Collection details" subtitle="Printed on invoices and payment requests">
        <Card>
          <Field label="UPI ID" required={form.upi} value={form.upiId} onChangeText={(upiId) => patch({ upiId })} error={err('upiId')} />
          <FormRow>
            <Field label="Account name" required={form.bankTransfer} value={form.accountName} onChangeText={(accountName) => patch({ accountName })} error={err('accountName')} />
            <Field label="Account number" required={form.bankTransfer} value={form.accountNumber} keyboardType="number-pad" onChangeText={(accountNumber) => patch({ accountNumber })} error={err('accountNumber')} />
          </FormRow>
          <FormRow>
            <Field label="IFSC" required={form.bankTransfer} value={form.ifsc} onChangeText={(v) => patch({ ifsc: v.toUpperCase() })} error={err('ifsc')} />
            <Field label="Invoice prefix" required value={form.invoicePrefix} onChangeText={(v) => patch({ invoicePrefix: v.toUpperCase() })} error={err('invoicePrefix')} />
          </FormRow>
          <Field label="Deposit refund time (days)" required value={form.refundDays} keyboardType="number-pad" onChangeText={(refundDays) => patch({ refundDays })} error={err('refundDays')} />
          <FormActions
            dirty={dirty}
            onSave={() => {
              setTouched(true);
              if (invalid) return;
              save({ ...form, gatewayConfigured: settings.gatewayConfigured });
              setTouched(false);
              showToast('Payment settings saved');
            }}
            onReset={() => {
              setForm(settings);
              setTouched(false);
            }}
          />
        </Card>
      </Section>

      <ConfirmDialog
        visible={clearing}
        title="Clear gateway details?"
        message="The saved merchant ID is removed from this page."
        confirmLabel="Clear details"
        danger
        onCancel={() => setClearing(false)}
        onConfirm={() => {
          save({ ...settings, merchantId: '', gatewayConfigured: false });
          setForm((f) => ({ ...f, merchantId: '', gatewayConfigured: false }));
          setClearing(false);
        }}
      />
    </View>
  );
}
