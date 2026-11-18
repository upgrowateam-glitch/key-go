import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { Button, Card, ChipGroup, ConfirmDialog, DataTable, EmptyState, Field, FormRow, FormSheet, Section, SimulatedNote, type Column } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useThemedStyles } from '../../theme';
import { formatINR } from '../../lib/format';
import { pricingStore, type PricingSettings } from '../../services/settings';
import { ListToolbar, Pager, useListControls, WithStore } from '../notifications/listControls';
import type { RentalTerm, Vehicle, VehicleType } from '../../types';
import { FormActions, isWholeNumber, makeSettingsStyles } from './formParts';

const TERMS: RentalTerm[] = ['Daily', 'Weekly', 'Monthly'];
const CATEGORIES: VehicleType[] = ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Electric', 'Luxury'];
const TYPE_FILTERS = ['All', ...CATEGORIES] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

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
  const [filter, setFilter] = useState<TypeFilter>('All');
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
    { key: 'type', label: 'Category', minWidth: 90 },
    { key: 'pricePerDay', label: 'Rate per day', minWidth: 110, align: 'right', value: (v) => formatINR(v.pricePerDay) },
    { key: 'actions', label: 'Action', minWidth: 110, align: 'right', render: (v) => <Button label="Edit rate" size="sm" variant="outline" icon={(c) => <Pencil size={12} color={c} />} onPress={() => setEditing(v)} /> },
  ];

  return (
    <Section title="Vehicle daily rates" subtitle="Used for every new quote" style={{ marginTop: 0 }}>
      <ListToolbar controls={list} placeholder="Search vehicle or number" filters={<ChipGroup options={TYPE_FILTERS} value={filter} onChange={setFilter} />} />
      <DataTable columns={columns} rows={list.pageRows} rowKey={(v) => v.id} empty={<EmptyState title="No vehicles" message="Nothing matches this search or category." compact />} />
      <Pager controls={list} />
      {editing ? (
        <RateSheet
          vehicle={editing}
          onClose={() => setEditing(null)}
          onSave={(rate) => {
            updateVehicle(editing.id, { pricePerDay: rate });
            showToast(`${editing.name} rate set to ${formatINR(rate)} per day`);
            setEditing(null);
          }}
        />
      ) : null}
    </Section>
  );
}

function RateSheet({ vehicle, onClose, onSave }: { vehicle: Vehicle; onClose: () => void; onSave: (rate: number) => void }) {
  const [rate, setRate] = useState(String(vehicle.pricePerDay));
  const [touched, setTouched] = useState(false);
  const error = !/^[1-9]\d{0,6}$/.test(rate.trim()) ? 'Enter a whole rupee amount above 0' : undefined;
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
              if (!error) onSave(Number(rate));
            }}
          />
        </>
      }>
      <Field label="Rate per day (₹)" required value={rate} onChangeText={setRate} keyboardType="number-pad" error={touched ? error : undefined} hint={`Current rate ${formatINR(vehicle.pricePerDay)}. Existing bookings keep their price.`} />
    </FormSheet>
  );
}

// ---------------------------------------------------------------- rules

interface RulesForm {
  discount: Record<RentalTerm, string>;
  minDays: Record<RentalTerm, string>;
  deposit: Record<VehicleType, string>;
  tax: string;
}

const toForm = (s: PricingSettings): RulesForm => ({
  discount: Object.fromEntries(TERMS.map((t) => [t, String(Math.round(s.termDiscount[t] * 100))])) as Record<RentalTerm, string>,
  minDays: Object.fromEntries(TERMS.map((t) => [t, String(s.minDays[t])])) as Record<RentalTerm, string>,
  deposit: Object.fromEntries(CATEGORIES.map((c) => [c, String(s.depositByCategory[c])])) as Record<VehicleType, string>,
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
    CATEGORIES.some((c) => amountError(form.deposit[c]));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  const apply = () => {
    save({
      termDiscount: Object.fromEntries(TERMS.map((t) => [t, Number(form.discount[t]) / 100])) as Record<RentalTerm, number>,
      minDays: Object.fromEntries(TERMS.map((t) => [t, Number(form.minDays[t])])) as Record<RentalTerm, number>,
      depositByCategory: Object.fromEntries(CATEGORIES.map((c) => [c, Number(form.deposit[c])])) as Record<VehicleType, number>,
      taxRate: Number(form.tax) / 100,
    });
    setTouched(false);
    showToast('Pricing rules saved');
  };

  return (
    <Section title="Pricing rules" subtitle="Discounts, tax, deposits and minimum rental length">
      <SimulatedNote>These rules are saved on this page only. Quotes keep using the sample rules until the backend applies them, and final rates must come from the business.</SimulatedNote>
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
        <Text style={styles.label}>Security deposit by category (₹)</Text>
        <FormRow cols={4}>
          {CATEGORIES.map((c) => (
            <Field
              key={c}
              label={c}
              value={form.deposit[c]}
              keyboardType="number-pad"
              onChangeText={(v) => setForm((f) => ({ ...f, deposit: { ...f.deposit, [c]: v } }))}
              error={touched ? amountError(form.deposit[c]) : undefined}
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
        message="These rules replace the current values on this page. Existing bookings keep their price."
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
