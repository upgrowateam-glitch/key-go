import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { CalendarPlus, CheckCircle2, XCircle } from 'lucide-react-native';
import { Button, Card, Field, FormSheet, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { formatDate, formatINR } from '../../lib/format';
import { approveExtension, declineExtension, extensionLabel, extensionSummary } from '../../services/extensions';
import { useThemeColors } from '../../theme';
import type { Booking, BookingExtension } from '../../types';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Extensions of a rental: a customer's request waiting for Approve / Decline, and the history. */
export function ExtensionsCard({ booking: b, canEdit, onExtend }: { booking: Booking; canEdit: boolean; onExtend?: () => void }) {
  const colors = useThemeColors();
  const { showBooking, showToast } = useApp();
  const { all, pending } = extensionSummary(b);
  const [declining, setDeclining] = useState<BookingExtension | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const open = b.status === 'Confirmed' || b.status === 'Active';
  if (!all.length && !(open && canEdit)) return null;

  const run = async (task: () => Promise<Booking>, done: string) => {
    setBusy(true);
    try {
      showBooking(await task());
      showToast(done);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.txt, fontSize: 15, fontWeight: '800', flex: 1 }}>Extensions</Text>
        {open && canEdit && onExtend ? <Button label="Extend rental" size="sm" variant="outline" disabled={!!pending} icon={(c) => <CalendarPlus size={14} color={c} />} onPress={onExtend} /> : null}
      </View>

      {pending ? (
        <View style={{ borderWidth: 1, borderColor: colors.highlight, borderRadius: 10, padding: 10, gap: 6, backgroundColor: colors.highlightSoft }}>
          <Text style={{ color: colors.txt, fontSize: 14, fontWeight: '800' }}>
            Customer asks for {extensionLabel(pending)} · +{formatINR(pending.extraTotal)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12.5 }}>
            Return {formatDate(pending.fromReturnDate, false)} {pending.fromReturnTime} → {formatDate(pending.toReturnDate, false)} {pending.toReturnTime}. The car is held for this time until you decide.
          </Text>
          {canEdit ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button label="Approve" size="sm" variant="secondary" disabled={busy} icon={(c) => <CheckCircle2 size={14} color={c} />} onPress={() => run(() => approveExtension(b.id, pending.id), 'Extension approved')} />
              <Button
                label="Decline"
                size="sm"
                variant="danger"
                disabled={busy}
                icon={(c) => <XCircle size={14} color={c} />}
                onPress={() => {
                  setReason('');
                  setDeclining(pending);
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {all.length === 0 ? <Text style={{ color: colors.muted, fontSize: 12.5 }}>Not extended. Extend by hours or by days (24-hour blocks); the car must be free for the extra time.</Text> : null}
      {all
        .filter((e) => e !== pending)
        .slice()
        .reverse()
        .map((e) => (
          <View key={e.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.txt, fontSize: 13, fontWeight: '700' }}>
                {extensionLabel(e)} → {formatDate(e.toReturnDate, false)} {e.toReturnTime}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Asked by {e.requestedBy}
                {e.requestedByRole === 'Customer' ? ' (customer)' : ''} · {when(e.requestedAt)}
                {e.decidedBy && e.decidedBy !== e.requestedBy ? ` · ${e.status.toLowerCase()} by ${e.decidedBy}` : ''}
              </Text>
              {e.declineReason ? <Text style={{ color: colors.danger, fontSize: 12 }}>Reason: {e.declineReason}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <StatusBadge status={e.status} />
              <Text style={{ color: colors.txt, fontSize: 12.5, fontWeight: '700' }}>{e.status === 'Approved' ? `+${formatINR(e.extraTotal)}` : formatINR(0)}</Text>
            </View>
          </View>
        ))}

      <FormSheet
        visible={!!declining}
        title="Decline the extension?"
        onClose={() => setDeclining(null)}
        footer={
          <>
            <Button label="Keep it" variant="ghost" onPress={() => setDeclining(null)} />
            <Button
              label="Decline"
              variant="danger"
              disabled={!reason.trim() || busy}
              onPress={() => {
                const e = declining!;
                setDeclining(null);
                run(() => declineExtension(b.id, e.id, reason.trim()), 'Extension declined · the customer was told');
              }}
            />
          </>
        }>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>The return goes back to {declining ? `${formatDate(declining.fromReturnDate, false)} ${declining.fromReturnTime}` : ''} and the car is free again after it.</Text>
        <Field label="Reason (the customer sees this)" required value={reason} onChangeText={setReason} placeholder="e.g. The car is needed for servicing" />
      </FormSheet>
    </Card>
  );
}
