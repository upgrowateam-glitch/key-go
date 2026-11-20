import React from 'react';
import { Text, View } from 'react-native';
import {
  BadgeCheck,
  CalendarDays,
  Car,
  Cog,
  CreditCard,
  Factory,
  FileCheck2,
  Fuel,
  Gauge,
  Hash,
  IndianRupee,
  Landmark,
  Layers,
  MapPin,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react-native';
import { Card, ProgressBar } from '../../../components/kit';
import { formatDate, formatINR, formatKm } from '../../../lib/format';
import type { VehicleCategory } from '../../../services/fleet';
import { useThemeColors, useThemedStyles } from '../../../theme';
import { Vehicle } from '../../../types';
import { makeStyles } from '../detailStyles';
import { InfoTile, SectionHeader } from '../ui';
import { VehiclePhotos } from './VehiclePhotos';

export function OverviewTab({ v, category }: { v: Vehicle; category: VehicleCategory }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <SectionHeader icon={Car} title="Vehicle details" subtitle="What customers see when they book" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <InfoTile icon={Hash} label="Vehicle ID" value={v.code ?? v.id} />
          <InfoTile icon={BadgeCheck} label="Registration number" value={v.vehicleNumber} />
          <InfoTile icon={Car} label="Type" value={v.type} tone="info" />
          <InfoTile icon={Layers} label="Category" value={category} tone="info" />
          <InfoTile icon={Fuel} label="Fuel type" value={v.fuel} tone="warning" />
          <InfoTile icon={Users} label="Seats" value={String(v.seats)} tone="violet" />
          <InfoTile icon={Cog} label="Transmission" value={v.transmission === 'Auto' ? 'Automatic' : 'Manual'} tone="violet" />
          <InfoTile icon={Factory} label="Brand" value={v.brand ?? '—'} />
          <InfoTile icon={IndianRupee} label="Daily rental price" value={formatINR(v.pricePerDay)} tone="success" />
        </View>
      </Card>
      <Card>
        <SectionHeader icon={Wallet} title="Purchase & usage" subtitle="Ownership, devices and papers" tone="success" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <InfoTile icon={CalendarDays} label="Purchase date" value={formatDate(v.purchaseDate)} />
          <InfoTile icon={IndianRupee} label="Purchase cost" value={formatINR(v.purchaseCost)} tone="success" />
          <InfoTile icon={Gauge} label="Odometer" value={formatKm(v.odometerKm)} tone="info" />
          <InfoTile
            icon={Landmark}
            label="Financing"
            value={v.loanDetails ? `On loan · ${formatINR(v.loanDetails.emiAmount)}/month` : 'Owned outright'}
            tone="violet"
          />
          <InfoTile icon={MapPin} label="GPS device" value={v.gpsDeviceId || 'Not fitted'} tone="info" />
          <InfoTile icon={CreditCard} label="FASTag" value={`${v.fastagId || '—'} · ${formatINR(v.fastagBalance)}`} tone="warning" />
          <InfoTile icon={ShieldCheck} label="Insurance expiry" value={formatDate(v.insuranceExpiry)} tone="success" />
          <InfoTile icon={FileCheck2} label="PUC expiry" value={formatDate(v.pucExpiry)} tone="success" />
        </View>
        <View style={{ marginTop: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Fuel size={13} color={v.fuelLevelPercent < 25 ? colors.warning : colors.muted} />
              <Text style={styles.kLabel}>{v.fuel === 'Electric' ? 'Battery charge' : 'Fuel level'}</Text>
            </View>
            <Text style={styles.kValueSm}>{v.fuelLevelPercent}%</Text>
          </View>
          <ProgressBar value={v.fuelLevelPercent / 100} tone={v.fuelLevelPercent < 25 ? 'warning' : 'primary'} />
        </View>
      </Card>
      <VehiclePhotos v={v} />
    </View>
  );
}
