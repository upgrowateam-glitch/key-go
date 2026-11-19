import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Section, type Column } from '../../components/kit';
import { allNames, effectiveRates, masterLists } from '../../lib/catalog';
import { useApp } from '../../context/AppContext';
import { useThemeColors, useThemedStyles } from '../../theme';
import { formatINR } from '../../lib/format';
import { pricingStore, type PricingSettings } from '../../services/settings';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import type { RentalTerm, Vehicle } from '../../types';
import { FormActions, isWholeNumber, makeSettingsStyles } from './formParts';

const TERMS: RentalTerm[] = ['Daily', 'Weekly', 'Monthly'];
/** Car types from Settings → Master data, plus any type a car already uses. */
const typeNames = (vehicles: Vehicle[] = []) => Array.from(new Set([...allNames(masterLists().vehicleTypes), ...vehicles.map((v) => v.type)]));

export default function RentalPricingTab() {
  return (
    <View>
      <VehicleRates />
      <WithStore store={pricingStore}>{(settings, save) => <PricingRules settings={settings} save={save} />}</WithStore>
    </View>
  );
}

// ---------------------------------------------------------------- vehicle rates

function VehicleRates() {
  const { vehicles, updateVehicle, showToast } = useApp();
  const [filter, setFilter] = useState<string>('All');
  const typeFilters = useMemo(() => ['All', ...typeNames(vehicles)], [vehicles]);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const rows = useMemo(() => vehicles.filter((v) => v.status !== 'Sold' && (filter === 'All' || v.type === filter)), [vehicles, filter]);
  const list = useListControls(rows, {
    search: (v) => `${v.name} ${v.vehicleNumber} ${v.type}`,
    sorts: {
      Name: (a, b) => a.name.localeCompare(b.name),
      'Highest rate': (a, b) => b.pricePerDay - a.pricePerDay,
      'Lowest rate': (a, b) => a.pricePerDay - b.pricePerDay,
    },
  });
  const columns: Column<Vehicle>[] = [
    { key: 'name', label: 'Vehicle', flex: 2, minWidth: 170 },
    { key: 'vehicleNumber', label: 'Number', minWidth: 130 },
    { key: 'type', label: 'Type', minWidth: 90 },
    { key: 'pricePerDay', label: 'Per day', minWidth: 90, align: 'right', value: (v) => formatINR(v.pricePerDay) },
    { key: 'weekly', label: 'Week (7 days)', minWidth: 120, align: 'right', value: (v) => `${formatINR(effectiveRates(v).weekly)}${v.customRates?.weekly ? ' ★' : ''}` },
    { key: 'monthly', label: 'Month (30 days)', minWidth: 130, align: 'right', value: (v) => `${formatINR(effectiveRates(v).monthly)}${v.customRates?.monthly ? ' ★' : ''}` },
    { key: 'deposit', label: 'Deposit', minWidth: 100, align: 'right', value: (v) => `${formatINR(effectiveRates(v).deposit)}${v.customRates?.deposit ? ' ★' : ''}` },
    { key: 'actions', label: 'Action', minWidth: 110, align: 'right', render: (v) => <Button label="Edit rate" size="sm" variant="outline" icon={(c) => <Pencil size={12} color={c} />} onPress={() => setEditing(v)} /> },
  ];

  return (
    <Section title="Vehicle rates" subtitle="Used for every new quote in this portal and the customer app. ★ = this car's own price; the others follow the pricing rules below." style={{ marginTop: 0 }}>
      <ListToolbar controls={list} placeholder="Search vehicle or number" filters={<ChipGroup options={typeFilters} value={filter} onChange={setFilter} scroll />} />
      <DataTable columns={columns} rows={list.pageRows} rowKey={(v) => v.id} empty={<EmptyState title="No vehicles" message="Nothing matches this search or category." compact />} />
      <Pager controls={list} />
      {editing ? (
        <RateSheet
          vehicle={editing}
          onClose={() => setEditing(null)}
          onSave={(rate, customRates) => {
            updateVehicle(editing.id, { pricePerDay: rate, customRates });
            showToast(`${editing.name}: prices saved`);
            setEditing(null);
          }}
        />
      ) : null}
    </Section>
  );
}

type CustomRates = NonNullable<Vehicle['customRates']>;

function RateSheet({ vehicle, onClose, onSave }: { vehicle: Vehicle; onClose: () => void; onSave: (rate: number, custom: CustomRates) => void }) {
  const colors = useThemeColors();
  const [rate, setRate] = useState(String(vehicle.pricePerDay));
  const own = vehicle.customRates ?? {};
  const [weekly, setWeekly] = useState(own.weekly ? String(own.weekly) : '');
  const [monthly, setMonthly] = useState(own.monthly ? String(own.monthly) : '');
  const [deposit, setDeposit] = useState(own.deposit ? String(own.deposit) : '');
  const [touched, setTouched] = useState(false);
  const error = !/^[1-9]\d{0,6}$/.test(rate.trim()) ? 'Enter a whole rupee amount above 0' : undefined;
  const optional = (v: string) => (v.trim() && !/^[1-9]\d{0,7}$/.test(v.trim()) ? 'Whole rupees, or leave empty' : undefined);
  // What the automatic prices would be with the daily rate typed above
  const auto = effectiveRates({ ...vehicle, pricePerDay: Number(rate) || vehicle.pricePerDay, rates: undefined, customRates: {} });
  const bad = !!error || !!optional(weekly) || !!optional(monthly) || !!optional(deposit);
  const num = (v: string) => (v.trim() ? Number(v) : undefined);
  return (
    <FormSheet
      visible
      title={`Rate for ${vehicle.name}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button
            label="Save rate"
            onPress={() => {
              setTouched(true);
              if (!bad) onSave(Number(rate), { weekly: num(weekly), monthly: num(monthly), deposit: num(deposit) });
            }}
          />
        </>
      }>
      <Field label="Rate per day (₹)" required value={rate} onChangeText={setRate} keyboardType="number-pad" error={touched ? error : undefined} hint={`Current rate ${formatINR(vehicle.pricePerDay)}. Existing bookings keep their price.`} />
      <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 10 }}>Own prices (optional). Leave a box empty to use the automatic price from the pricing rules.</Text>
      <FormRow>
        <Field label="Price for 7 days (₹)" value={weekly} onChangeText={setWeekly} keyboardType="number-pad" placeholder={`Automatic: ${auto.weekly}`} error={touched ? optional(weekly) : undefined} />
        <Field label="Price for 30 days (₹)" value={monthly} onChangeText={setMonthly} keyboardType="number-pad" placeholder={`Automatic: ${auto.monthly}`} error={touched ? optional(monthly) : undefined} />
      </FormRow>
      <Field label="Security deposit (₹)" value={deposit} onChangeText={setDeposit} keyboardType="number-pad" placeholder={`Automatic for ${vehicle.type}: ${auto.deposit}`} error={touched ? optional(deposit) : undefined} />
    </FormSheet>
  );
}

// ---------------------------------------------------------------- rules

interface RulesForm {
  discount: Record<RentalTerm, string>;
  minDays: Record<RentalTerm, string>;
  deposit: Record<string, string>;
  tax: string;
}

const toForm = (s: PricingSettings): RulesForm => ({
  discount: Object.fromEntries(TERMS.map((t) => [t, String(Math.round(s.termDiscount[t] * 100))])) as Record<RentalTerm, string>,
  minDays: Object.fromEntries(TERMS.map((t) => [t, String(s.minDays[t])])) as Record<RentalTerm, string>,
  deposit: Object.fromEntries(typeNames().map((c) => [c, String(s.depositByCategory[c] ?? 5000)])),
  tax: String(Math.round(s.taxRate * 100)),
});

function PricingRules({ settings, save }: { settings: PricingSettings; save: (s: PricingSettings) => void }) {
  const { showToast } = useApp();
  const styles = useThemedStyles(makeSettingsStyles);
  const [form, setForm] = useState(() => toForm(settings));
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const percentError = (v: string) => (!/^\d{1,2}$/.test(v.trim()) ? '0 to 99' : undefined);
  const amountError = (v: string) => (!isWholeNumber(v) ? 'Whole number' : undefined);
  const minDayError = (v: string) => (!/^[1-9]\d{0,2}$/.test(v.trim()) ? 'At least 1' : undefined);
  const invalid =
    !!percentError(form.tax) ||
    TERMS.some((t) => percentError(form.discount[t]) || minDayError(form.minDays[t])) ||
    typeNames().some((c) => amountError(form.deposit[c] ?? ''));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  const apply = () => {
    save({
      termDiscount: Object.fromEntries(TERMS.map((t) => [t, Number(form.discount[t]) / 100])) as Record<RentalTerm, number>,
      minDays: Object.fromEntries(TERMS.map((t) => [t, Number(form.minDays[t])])) as Record<RentalTerm, number>,
      depositByCategory: Object.fromEntries(typeNames().map((c) => [c, Number(form.deposit[c] ?? 5000)])),
      taxRate: Number(form.tax) / 100,
    });
    setTouched(false);
    showToast('Pricing rules saved. New prices apply everywhere, including the customer app.');
  };

  return (
    <Section title="Pricing rules" subtitle="Discounts, tax, deposits and minimum rental length">
      <Text style={styles.meta}>Used by the server, this portal and the customer app for every new quote. Cars with their own weekly or monthly price (★) keep it. Existing bookings keep their price.</Text>
      <Card style={{ marginTop: 8 }}>
        <Text style={styles.label}>Term discount and minimum days</Text>
        {TERMS.map((t) => (
          <FormRow key={t}>
            <Field
              label={`${t} discount %`}
              value={form.discount[t]}
              keyboardType="number-pad"
              onChangeText={(v) => setForm((f) => ({ ...f, discount: { ...f.discount, [t]: v } }))}
              error={touched ? percentError(form.discount[t]) : undefined}
            />
            <Field
              label={`${t} minimum days`}
              value={form.minDays[t]}
              keyboardType="number-pad"
              onChangeText={(v) => setForm((f) => ({ ...f, minDays: { ...f.minDays, [t]: v } }))}
              error={touched ? minDayError(form.minDays[t]) : undefined}
            />
          </FormRow>
        ))}
        <Text style={styles.label}>Security deposit by car type (₹)</Text>
        <FormRow cols={4}>
          {typeNames().map((c) => (
            <Field
              key={c}
              label={c}
              value={form.deposit[c] ?? ''}
              keyboardType="number-pad"
              onChangeText={(v) => setForm((f) => ({ ...f, deposit: { ...f.deposit, [c]: v } }))}
              error={touched ? amountError(form.deposit[c] ?? '') : undefined}
            />
          ))}
        </FormRow>
        <Field label="Tax rate %" value={form.tax} keyboardType="number-pad" onChangeText={(tax) => setForm((f) => ({ ...f, tax }))} error={touched ? percentError(form.tax) : undefined} />
        <FormActions
          dirty={dirty}
          onSave={() => {
            setTouched(true);
            if (!invalid) setConfirming(true);
          }}
          onReset={() => {
            setForm(toForm(settings));
            setTouched(false);
          }}
        />
      </Card>
      <ConfirmDialog
        visible={confirming}
        title="Save pricing rules?"
        message="New quotes in this portal and the customer app use these rules straight away. Existing bookings keep their price."
        confirmLabel="Save rules"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          apply();
          setConfirming(false);
        }}
      />
    </Section>
  );
}
