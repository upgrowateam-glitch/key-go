import React from 'react';
import { Text, View } from 'react-native';
import { Card, KeyValueGrid, ProgressBar } from '../../../components/kit';
import { formatDate, formatINR, formatKm } from '../../../lib/format';
import type { VehicleCategory } from '../../../services/fleet';
import { useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { VehiclePhotos } from './VehiclePhotos';

export function OverviewTab({ v, category }: { v: Vehicle; category: VehicleCategory }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={styles.cardTitle}>Vehicle details</Text>
        <KeyValueGrid
          items={[
            { label: 'Vehicle ID', value: v.id },
            { label: 'Registration number', value: v.vehicleNumber },
            { label: 'Type', value: v.type },
            { label: 'Category', value: category },
            { label: 'Fuel type', value: v.fuel },
            { label: 'Seats', value: String(v.seats) },
            { label: 'Transmission', value: v.transmission === 'Auto' ? 'Automatic' : 'Manual' },
            { label: 'Brand', value: v.brand ?? '—' },
            { label: 'Daily rental price', value: formatINR(v.pricePerDay) },
          ]}
        />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Purchase & usage</Text>
        <KeyValueGrid
          items={[
            { label: 'Purchase date', value: formatDate(v.purchaseDate) },
            { label: 'Purchase cost', value: formatINR(v.purchaseCost) },
            { label: 'Odometer', value: formatKm(v.odometerKm) },
            { label: 'Financing', value: v.loanDetails ? `On loan · ${formatINR(v.loanDetails.emiAmount)}/month` : 'Owned outright' },
            { label: 'GPS device', value: v.gpsDeviceId },
            { label: 'FASTag', value: `${v.fastagId} · ${formatINR(v.fastagBalance)}` },
            { label: 'Insurance expiry', value: formatDate(v.insuranceExpiry) },
            { label: 'PUC expiry', value: formatDate(v.pucExpiry) },
          ]}
        />
        <View style={{ marginTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={styles.kLabel}>{v.fuel === 'Electric' ? 'Battery charge' : 'Fuel level'}</Text>
            <Text style={styles.kValueSm}>{v.fuelLevelPercent}%</Text>
          </View>
          <ProgressBar value={v.fuelLevelPercent / 100} tone={v.fuelLevelPercent < 25 ? 'warning' : 'primary'} />
        </View>
      </Card>
      <VehiclePhotos v={v} />
    </View>
  );
}
