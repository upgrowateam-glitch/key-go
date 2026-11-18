import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Fuel, Gauge, Plus } from 'lucide-react-native';
import { BarChart, Button, Card, Column, DataTable, EmptyState, Field, FormRow, FormSheet, Grid, StatTile } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact, formatKm } from '../../../lib/format';
import { useThemedStyles } from '../../../theme';
import { FuelEntry, Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { ListPager, usePaged } from '../ListPager';
import { ISO_DATE, num } from '../shared';

export function FuelTab({ v }: { v: Vehicle }) {
  const styles = useThemedStyles(makeStyles);
  const { cols } = useResponsive();
  const [adding, setAdding] = useState(false);
  const isEV = v.fuel === 'Electric';
  const unit = isEV ? 'kWh' : 'L';
  const entries = [...v.fuelHistory].sort((a, b) => (a.date < b.date ? 1 : -1));
  const paged = usePaged(entries);
  const addButton =
    v.status === 'Sold' ? undefined : <Button label={isEV ? 'Add session' : 'Add fill-up'} variant="outline" size="sm" icon={(c) => <Plus size={14} color={c} />} onPress={() => setAdding(true)} />;
  const sheet = adding ? <FuelSheet v={v} unit={unit} onClose={() => setAdding(false)} /> : null;

  if (entries.length === 0) {
    return (
      <Card>
        <EmptyState
          title={isEV ? 'No charging sessions yet' : 'No fuel entries yet'}
          message="Fuel and charging bills will appear here once recorded."
          icon={(c) => <Fuel size={22} color={c} />}
          action={addButton}
        />
        {sheet}
      </Card>
    );
  }
  const totalUnits = entries.reduce((s, e) => s + e.litres, 0);
  const totalCost = entries.reduce((s, e) => s + e.cost, 0);
  const chrono = [...entries].reverse();
  const labels = chrono.map((e, i) => {
    const l = formatDate(e.date, false);
    return chrono.findIndex((x) => formatDate(x.date, false) === l) === i ? l : `${l} (${i + 1})`;
  });
  const km = entries.length > 1 ? entries[0].odometerKm - entries[entries.length - 1].odometerKm : 0;

  const columns: Column<FuelEntry>[] = [
    { key: 'date', label: 'Date', flex: 1, minWidth: 110, value: (e) => formatDate(e.date) },
    { key: 'station', label: isEV ? 'Charging point' : 'Station', flex: 2, minWidth: 200, value: (e) => e.station },
    { key: 'units', label: isEV ? 'Energy' : 'Litres', flex: 0.8, minWidth: 90, align: 'right', value: (e) => `${e.litres} ${unit}` },
    { key: 'cost', label: 'Cost', flex: 0.9, minWidth: 100, align: 'right', value: (e) => formatINR(e.cost) },
    { key: 'rate', label: `₹ / ${unit}`, flex: 0.8, minWidth: 90, align: 'right', value: (e) => (e.litres ? `₹${(e.cost / e.litres).toFixed(1)}` : '—') },
    { key: 'odo', label: 'Odometer', flex: 1, minWidth: 110, align: 'right', value: (e) => formatKm(e.odometerKm) },
  ];

  return (
    <View>
      <Grid cols={cols(2, 2, 4)}>
        <StatTile label={isEV ? 'Energy charged' : 'Fuel filled'} value={`${totalUnits.toLocaleString('en-IN')} ${unit}`} tone="info" icon={(c) => <Fuel size={16} color={c} />} />
        <StatTile label="Total cost" value={formatINR(totalCost)} tone="primary" />
        <StatTile label={`Average ₹ / ${unit}`} value={`₹${(totalCost / Math.max(1, totalUnits)).toFixed(1)}`} tone="neutral" />
        <StatTile label={isEV ? 'Sessions' : 'Fill-ups'} value={entries.length} tone="neutral" hint={km > 0 ? `${formatKm(km)} between first and last` : undefined} icon={(c) => <Gauge size={16} color={c} />} />
      </Grid>
      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <Text style={styles.cardTitle}>{isEV ? 'Charging cost by session' : 'Fuel cost by fill-up'}</Text>
          {addButton}
        </View>
        <BarChart labels={labels} series={[{ name: 'Cost', values: chrono.map((e) => e.cost) }]} formatValue={formatINRCompact} showValues height={170} />
      </Card>
      <DataTable columns={columns} rows={paged.rows} rowKey={(e) => e.id} />
      <ListPager paged={paged} />
      {sheet}
    </View>
  );
}

function FuelSheet({ v, unit, onClose }: { v: Vehicle; unit: string; onClose: () => void }) {
  const { today, updateVehicle, showToast } = useApp();
  const isEV = unit === 'kWh';
  const [date, setDate] = useState(today);
  const [station, setStation] = useState('');
  const [units, setUnits] = useState('');
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState(String(v.odometerKm));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const submit = () => {
    const e: Record<string, string | undefined> = {};
    if (!ISO_DATE.test(date)) e.date = 'Use YYYY-MM-DD';
    else if (date > today) e.date = 'The date cannot be in the future';
    if (!station.trim()) e.station = isEV ? 'Enter the charging point' : 'Enter the station';
    if (!(num(units) > 0)) e.units = `Enter the ${isEV ? 'energy' : 'litres'}`;
    if (!(num(cost) > 0)) e.cost = 'Enter the cost';
    if (!(num(odometer) >= 0)) e.odometer = 'Enter the odometer reading';
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    const odometerKm = Math.round(num(odometer));
    const entry: FuelEntry = { id: `fuel-${Date.now()}`, date, station: station.trim(), litres: num(units), cost: Math.round(num(cost)), odometerKm };
    updateVehicle(v.id, { fuelHistory: [entry, ...v.fuelHistory], odometerKm: Math.max(v.odometerKm, odometerKm) });
    showToast(isEV ? 'Charging session recorded' : 'Fill-up recorded');
    onClose();
  };

  return (
    <FormSheet
      visible
      title={isEV ? 'Add charging session' : 'Add fill-up'}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="outline" onPress={onClose} />
          <Button label="Save" onPress={submit} />
        </>
      }>
      <FormRow>
        <Field label="Date" required value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" error={errors.date} />
        <Field label={isEV ? 'Charging point' : 'Station'} required value={station} onChangeText={setStation} error={errors.station} />
      </FormRow>
      <FormRow cols={3}>
        <Field label={`Quantity (${unit})`} required value={units} onChangeText={setUnits} keyboardType="numeric" error={errors.units} />
        <Field label="Cost (₹)" required value={cost} onChangeText={setCost} keyboardType="number-pad" error={errors.cost} />
        <Field label="Odometer (km)" required value={odometer} onChangeText={setOdometer} keyboardType="number-pad" error={errors.odometer} />
      </FormRow>
    </FormSheet>
  );
}
