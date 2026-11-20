import { StyleSheet } from 'react-native';
import { Tone } from '../../components/kit';
import { daysBetween } from '../../lib/format';
import type { ThemeColors } from '../../theme';
import type { Customer } from '../../types';

export const KYC_FILTERS = ['All', 'Verified', 'Pending', 'Incomplete', 'Rejected'] as const;
export type KycFilter = (typeof KYC_FILTERS)[number];

export const TIER_TONE: Record<Customer['loyaltyTier'], Tone> = {
  Bronze: 'warm',
  Silver: 'neutral',
  Gold: 'highlight',
  VIP: 'primary',
};

/** Overall verification from the server (ID card, licence, licence validity, face check). */
export function kycState(c: Customer): Exclude<KycFilter, 'All'> {
  if (c.kycStatus) return c.kycStatus === 'Not verified' ? 'Incomplete' : c.kycStatus;
  if (c.idCardStatus === 'Rejected' || c.faceVerification === 'Rejected') return 'Rejected';
  if (c.idCardStatus === 'Verified' && c.faceVerification === 'Verified') return 'Verified';
  if (c.idCardStatus === 'Pending' || c.faceVerification === 'Pending') return 'Pending';
  return 'Incomplete';
}

/** Licence validity relative to today. */
export function licenceState(expiry: string, today: string): 'Valid' | 'Expiring' | 'Expired' | 'Unknown' {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return 'Unknown';
  const d = daysBetween(today, expiry);
  if (d < 0) return 'Expired';
  if (d <= 60) return 'Expiring';
  return 'Valid';
}

export function statusToneFor(s: Customer['idCardStatus']): Tone {
  return s === 'Verified' ? 'success' : s === 'Pending' ? 'warning' : s === 'Rejected' ? 'danger' : 'neutral';
}

/** Aadhaar stays masked everywhere it is displayed: only the last 4 digits are shown. */
export function maskAadhaar(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? `XXXX-XXXX-${digits.slice(-4)}` : '—';
}

/** Licence numbers are masked in lists and in the audit trail. */
export function maskLicence(value: string) {
  const v = value.replace(/\s+/g, '');
  if (!v) return 'Not provided';
  return `${v.slice(0, 4)} ••••${v.slice(-4)}`;
}

export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    name: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    cellStrong: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    cellSub: { color: colors.muted, fontSize: 11, marginTop: 1, flexShrink: 1 },
    kvLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: 3 },
    cardFoot: { flexDirection: 'row', gap: 12, backgroundColor: colors.bg, borderRadius: 12, padding: 10 },
    filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    strong: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    sub: { color: colors.muted, fontSize: 12, marginTop: 1, textAlign: 'left' },
    summaryName: { color: colors.txt, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    cardTitle: { color: colors.txt, fontSize: 14, fontWeight: '800', alignSelf: 'flex-start' },
    fieldLabel: { color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    photoCircle: {
      width: 112,
      height: 112,
      borderRadius: 56,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.lineStrong,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    faceFrame: {
      width: 132,
      height: 150,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    faceOval: {
      width: 88,
      height: 116,
      borderRadius: 50,
      borderWidth: 2,
      borderStyle: 'dashed',
      alignItems: 'center',
    },
    faceDot: { width: 7, height: 7, borderRadius: 4 },
    faceMouth: {
      width: 28,
      height: 12,
      marginTop: 22,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      borderRightWidth: 2,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      borderTopWidth: 0,
    },
    scanLine: { position: 'absolute', left: 12, right: 12, top: '48%', height: 2, borderRadius: 1, opacity: 0.9 },
    faceCheck: { position: 'absolute', right: 8, bottom: 8, borderRadius: 14, padding: 2 },
    scanner: {
      borderWidth: 1,
      borderColor: colors.secondaryBorder,
      backgroundColor: colors.secondarySoft,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      gap: 12,
    },
    scanCard: {
      width: '100%',
      maxWidth: 320,
      aspectRatio: 1.586,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.secondary,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
  });
