import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Tag } from 'lucide-react-native';
import { Badge, Button, Card, ConfirmDialog, Field, FormRow, FormSheet, KeyValueGrid, StatusBadge } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { formatDate, formatINR } from '../../../lib/format';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { ISO_DATE, num } from '../shared';

export function SalePanel({ v }: { v: Vehicle }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { today, markVehicleSold } = useApp();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  if (v.saleInfo) {
    const s = v.saleInfo;
    const diff = s.salePrice - v.purchaseCost;
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <View style={styles.iconBox}>
            <Tag size={18} color={colors.primaryText} />
          </View>
          <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>Sale record</Text>
          <StatusBadge status="Sold" />
        </View>
        <KeyValueGrid
          items={[
            { label: 'Sold on', value: formatDate(s.soldDate) },
            { label: 'Sale price', value: formatINR(s.salePrice) },
            { label: 'Buyer', value: s.buyerName },
            { label: 'Buyer phone', value: s.buyerPhone || '—' },
            { label: 'Purchase cost', value: formatINR(v.purchaseCost) },
            {
              label: 'Sale vs purchase',
              value: (
                <View style={{ gap: 4 }}>
                  <Text style={styles.kValue}>{formatINR(diff, { sign: true })}</Text>
                  <Badge label={diff >= 0 ? 'Above purchase cost' : 'Below purchase cost'} tone={diff >= 0 ? 'success' : 'warning'} />
                </View>
              ),
            },
          ]}
        />
        {s.notes ? <Text style={styles.body}>Notes: {s.notes}</Text> : null}
        <Text style={[styles.hint, { marginTop: 8 }]}>Difference = sale price − purchase cost. It ignores depreciation, loan interest and running costs.</Text>
      </Card>
    );
  }

  const p = num(price);
  const diff = p > 0 ? p - v.purchaseCost : null;
  const busy = v.status === 'On Rent' || v.status === 'Reserved';
  const outstanding = v.loanDetails ? Math.max(0, v.loanDetails.tenureMonths - v.loanDetails.paidMonths) * v.loanDetails.emiAmount : 0;

  const reset = () => {
    setDate(today);
    setPrice('');
    setBuyer('');
    setPhone('');
    setNotes('');
    setConfirming(false);
    setErrors({});
  };
  const submit = () => {
    const e: Record<string, string | undefined> = {};
    if (!ISO_DATE.test(date)) e.date = 'Use YYYY-MM-DD';
    if (!(p > 0)) e.price = 'Enter the sale price';
    if (!buyer.trim()) e.buyer = 'Enter the buyer name';
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setOpen(false);
    setConfirming(true);
  };
  const finalize = () => {
    markVehicleSold(v.id, {
      soldDate: date,
      salePrice: Math.round(p),
      buyerName: buyer.trim(),
      buyerPhone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    reset();
  };

  return (
    <View>
      <Card>
        <Text style={styles.cardTitle}>Sell this vehicle</Text>
        <Text style={styles.body}>
          Record a sale to retire the vehicle from the fleet. Its status becomes Sold and it can no longer be booked.
        </Text>
        <KeyValueGrid
          cols={2}
          items={[
            { label: 'Purchase cost', value: formatINR(v.purchaseCost) },
            { label: 'Purchased on', value: formatDate(v.purchaseDate) },
            ...(v.loanDetails ? [{ label: 'Loan outstanding (estimate)', value: formatINR(outstanding) }] : []),
          ]}
        />
        {busy ? (
          <View style={{ marginBottom: 12 }}>
            <Badge label={`Currently ${v.status} — complete or cancel the booking first`} tone="warning" />
          </View>
        ) : null}
        <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <Button label="Sell vehicle" variant="danger" disabled={busy} icon={(c) => <Tag size={14} color={c} />} onPress={() => setOpen(true)} />
        </View>
      </Card>

      <FormSheet
        visible={open}
        title={`Sell ${v.name}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} />
            <Button label="Mark as sold" variant="danger" onPress={submit} />
          </>
        }>
        <FormRow>
          <Field label="Sale date" required value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={errors.date} />
          <Field label="Sale price (₹)" required value={price} onChangeText={setPrice} keyboardType="number-pad" error={errors.price} />
        </FormRow>
        <FormRow>
          <Field label="Buyer name" required value={buyer} onChangeText={setBuyer} error={errors.buyer} />
          <Field label="Buyer phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Optional" />
        </FormRow>
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Handover details, documents transferred…" />
        <Card tone="soft" style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <View>
              <Text style={styles.kLabel}>Purchase cost</Text>
              <Text style={styles.kValue}>{formatINR(v.purchaseCost)}</Text>
            </View>
            <View>
              <Text style={styles.kLabel}>Sale price</Text>
              <Text style={styles.kValue}>{p > 0 ? formatINR(p) : '—'}</Text>
            </View>
            <View>
              <Text style={styles.kLabel}>Difference</Text>
              <Text style={styles.kValue}>{diff === null ? '—' : formatINR(diff, { sign: true })}</Text>
            </View>
          </View>
          {v.loanDetails ? <Text style={[styles.hint, { marginTop: 8 }]}>Loan outstanding (estimate) {formatINR(outstanding)} should be closed with {v.loanDetails.bankName}.</Text> : null}
        </Card>
      </FormSheet>
      <ConfirmDialog
        visible={confirming}
        title={`Sell ${v.name}?`}
        message={`${v.vehicleNumber} will be sold to ${buyer.trim()} for ${p > 0 ? formatINR(p) : ''} and retired from the fleet. This cannot be undone.`}
        confirmLabel="Mark as sold"
        danger
        onConfirm={finalize}
        onCancel={() => {
          setConfirming(false);
          setOpen(true);
        }}
      />
    </View>
  );
}
