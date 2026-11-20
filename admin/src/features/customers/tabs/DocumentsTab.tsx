import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { BadgeCheck, CircleAlert, Clock3, ShieldX } from 'lucide-react-native';
import { Card, KeyValueGrid, Section, StatusBadge } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { formatDate } from '../../../lib/format';
import { fetchCustomer } from '../../../services/identity';
import { useThemeColors } from '../../../theme';
import type { Customer } from '../../../types';
import { FaceCheckPanel } from '../../identity/FaceCheckPanel';
import { IdentityHistory } from '../../identity/IdentityHistory';
import { IdentityPanel } from '../../identity/IdentityPanel';
import { CUSTOMER_SLOTS, useIdentity } from '../../identity/useIdentity';
import { licenceState, maskLicence } from '../shared';

/** Verification of a customer: overall status, face check, documents, and the log of checks and openings. */
export function DocumentsTab({ customer: c }: { customer: Customer }) {
  const colors = useThemeColors();
  const { showCustomer, today } = useApp();
  const state = useIdentity('customer', c.id);
  const [historyKey, setHistoryKey] = useState(0);

  // Statuses are worked out on the server; fetch the customer again after any change
  const refresh = async () => {
    try {
      showCustomer(await fetchCustomer(c.id));
    } catch {
      // the next page load shows it
    }
    await state.reload();
    setHistoryKey((k) => k + 1);
  };

  const kyc = c.kycStatus ?? 'Not verified';
  const tone = kyc === 'Verified' ? colors.success : kyc === 'Rejected' ? colors.danger : kyc === 'Pending' ? colors.warmText : colors.muted;
  const Icon = kyc === 'Verified' ? BadgeCheck : kyc === 'Rejected' ? ShieldX : kyc === 'Pending' ? Clock3 : CircleAlert;
  const lic = licenceState(c.dlExpiry, today);

  return (
    <View>
      <Card style={{ gap: 12, marginTop: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon size={26} color={tone} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: tone, fontSize: 18, fontWeight: '800' }}>{kyc === 'Verified' ? 'Verified customer' : kyc}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Verified = ID card and driving licence verified, licence valid, face matched with the ID photo.</Text>
          </View>
        </View>
        {c.kycMissing?.length ? (
          <View style={{ gap: 4 }}>
            {c.kycMissing.map((m) => (
              <Text key={m} style={{ color: colors.txt, fontSize: 13 }}>
                • {m}
              </Text>
            ))}
          </View>
        ) : null}
        <KeyValueGrid
          items={[
            { label: 'ID card', value: <StatusBadge status={c.idCardStatus} /> },
            { label: 'Driving licence', value: <StatusBadge status={c.dlStatus ?? 'Not uploaded'} /> },
            { label: 'Face check', value: <StatusBadge status={c.faceVerification} /> },
            { label: 'Licence number', value: c.dlNumber ? maskLicence(c.dlNumber) : 'Not entered' },
            { label: 'Licence state', value: c.dlState || '—' },
            {
              label: 'Licence expiry',
              value: (
                <Text style={{ color: lic === 'Expired' ? colors.danger : lic === 'Expiring' ? colors.warmText : colors.txt, fontWeight: '700', fontSize: 13 }}>
                  {c.dlExpiry ? `${formatDate(c.dlExpiry)}${lic === 'Expired' ? ' · expired' : lic === 'Expiring' ? ' · expiring soon' : ''}` : 'Not entered'}
                </Text>
              ),
            },
          ]}
        />
      </Card>

      <Section title="Face check" subtitle="Compare the customer photo or selfie with the ID card photo">
        <FaceCheckPanel customer={c} state={state} onChanged={refresh} />
      </Section>

      <Section title="Documents" subtitle="Customers can also add these from the app (Profile → My Documents)">
        <IdentityPanel ownerType="customer" ownerId={c.id} ownerName={c.name} slots={CUSTOMER_SLOTS} state={state} onChanged={refresh} />
      </Section>

      {state.data?.canOpen ? (
        <Section title="Checks and access log" subtitle="Every upload, review, face check and document opening, with who and when">
          <IdentityHistory key={historyKey} ownerType="customer" ownerId={c.id} />
        </Section>
      ) : null}
    </View>
  );
}
