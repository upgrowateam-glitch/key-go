import React from 'react';
import { View } from 'react-native';
import { Tone, VehiclePhoto } from '../../components/kit';
import { daysBetween } from '../../lib/format';
import { useThemeColors } from '../../theme';
import { Vehicle } from '../../types';

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const num = (s: string) => {
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/** Expiry flag for insurance / PUC: expired, or expiring within 30 days. */
export function expiryFlag(expiry: string, today: string): { label: string; tone: Tone } | null {
  if (!ISO_DATE.test(expiry)) return null;
  const d = daysBetween(today, expiry);
  if (d < 0) return { label: 'Expired', tone: 'danger' };
  if (d <= 30) return { label: d === 0 ? 'Expires today' : `Expires in ${d}d`, tone: 'warning' };
  return null;
}

export function VehicleThumb({ vehicle, width = 64, height = 42 }: { vehicle: Vehicle; width?: number; height?: number }) {
  const colors = useThemeColors();
  return (
    <View
      style={{ width, height, borderRadius: 10, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      accessibilityLabel={`${vehicle.name} photo`}>
      <VehiclePhoto source={vehicle.imageAsset} style={{ width, height }} radius={0} />
    </View>
  );
}
