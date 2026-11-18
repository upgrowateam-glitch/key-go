import React from 'react';
import { Text, View } from 'react-native';
import { Badge, Card, KeyValueGrid, StatusBadge } from '../../../components/kit';
import { useApp } from '../../../context/AppContext';
import { formatDate } from '../../../lib/format';
import { useThemedStyles } from '../../../theme';
import type { Customer } from '../../../types';
import { licenceState, makeStyles, maskAadhaar, maskLicence } from '../shared';

export function OverviewTab({ customer: c }: { customer: Customer }) {
  const styles = useThemedStyles(makeStyles);
  const { today } = useApp();
  const lic = licenceState(c.dlExpiry, today);
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Personal details</Text>
        <KeyValueGrid
          cols={2}
          items={[
            { label: 'Name', value: c.name },
            { label: 'Date of birth', value: c.dob ? formatDate(c.dob) : '—' },
            { label: 'Phone', value: c.phone || '—' },
            { label: 'Email', value: c.email || '—' },
            { label: 'Address', value: c.address || '—' },
            { label: 'City', value: c.city || '—' },
          ]}
        />
      </Card>
      <Card>
        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Identity & licence</Text>
        <KeyValueGrid
          cols={2}
          items={[
            { label: 'Aadhaar / ID number', value: maskAadhaar(c.aadhaarNo) },
            { label: 'ID card', value: <StatusBadge status={c.idCardStatus} /> },
            { label: 'Licence number', value: maskLicence(c.dlNumber) },
            { label: 'Issuing state', value: c.dlState || '—' },
            { label: 'Licence expiry', value: c.dlExpiry ? formatDate(c.dlExpiry) : '—' },
            {
              label: 'Licence status',
              value: lic === 'Unknown' ? '—' : <Badge label={lic === 'Expiring' ? 'Expires within 60 days' : lic} tone={lic === 'Expired' ? 'danger' : lic === 'Expiring' ? 'warning' : 'success'} />,
            },
          ]}
        />
      </Card>
      <Card>
        <Text style={[styles.cardTitle, { marginBottom: 12 }]}>Care-of contact</Text>
        <KeyValueGrid
          cols={2}
          items={[
            { label: 'C/O name', value: c.careOfName || '—' },
            { label: 'Relation', value: c.careOfRelation || '—' },
            { label: 'C/O phone', value: c.careOfPhone || '—' },
          ]}
        />
      </Card>
    </View>
  );
}
