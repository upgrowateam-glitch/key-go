import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Card } from '../../components/kit';
import { ACTION_LABELS, identityHistory, type AuditEntry, type OwnerType } from '../../services/identity';
import { useThemeColors } from '../../theme';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

function describe(e: AuditEntry) {
  const d = e.detail ?? {};
  const parts = [d.label, d.result && !String(ACTION_LABELS[e.action] ?? '').includes(String(d.result)) ? d.result : undefined, d.note, d.reason ? `Reason: ${d.reason}` : undefined, d.via === 'customer-link' ? 'from the customer\'s phone' : d.via === 'staff-phone' ? 'from a phone' : undefined];
  return parts.filter(Boolean).join(' · ');
}

/** The audit log for one customer or driver: uploads, reviews, face checks and who opened which document. */
export function IdentityHistory({ ownerType, ownerId, filter }: { ownerType: OwnerType; ownerId: string; filter?: (e: AuditEntry) => boolean }) {
  const colors = useThemeColors();
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    identityHistory(ownerType, ownerId).then(setRows, (e: Error) => setError(e.message));
  }, [ownerType, ownerId]);

  if (error) return <Card><Text style={{ color: colors.danger }}>{error}</Text></Card>;
  if (!rows) return <Card><ActivityIndicator color={colors.primary} /></Card>;
  const shown = filter ? rows.filter(filter) : rows;
  return (
    <Card style={{ gap: 0, paddingVertical: 4 }}>
      {shown.length === 0 ? <Text style={{ color: colors.muted, fontSize: 13, paddingVertical: 10 }}>Nothing recorded yet.</Text> : null}
      {shown.map((e, i) => (
        <View key={e.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, flexWrap: 'wrap' }} accessibilityLabel={`${ACTION_LABELS[e.action] ?? e.action} by ${e.actorName}`}>
          <Text style={{ color: colors.muted, fontSize: 12, width: 150 }}>{when(e.at)}</Text>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Text style={{ color: e.action === 'face.no_match' || e.action === 'document.rejected' ? colors.danger : colors.txt, fontSize: 13, fontWeight: '700' }}>{ACTION_LABELS[e.action] ?? e.action}</Text>
            {describe(e) ? <Text style={{ color: colors.muted, fontSize: 12 }}>{describe(e)}</Text> : null}
          </View>
          <Text style={{ color: colors.txt, fontSize: 12 }}>
            {e.actorName}
            {e.actorRole ? <Text style={{ color: colors.muted }}> · {e.actorRole}</Text> : null}
          </Text>
        </View>
      ))}
    </Card>
  );
}
