import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { CalendarPlus, Minus, Plus } from 'lucide-react-native';
import { Button, Field, FormSheet, SegmentedControl } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { formatDate, formatINR } from '../../lib/format';
import { extendRentalNow, quoteExtension, type ExtensionQuote, type ExtensionUnit } from '../../services/extensions';
import { useThemeColors } from '../../theme';
import type { Booking } from '../../types';

const UNITS = ['Days', 'Hours'] as const;
const MAX = { days: 60, hours: 23 } as const;

/**
 * Staff extend a rental by hours or by days. Shows the new return time and the extra charge (worked out by the
 * server from the car's daily price) and whether the car is free, then extends at once.
 */
export function ExtendRentalSheet({ booking: b, initialDays = 1, onClose }: { booking: Booking; initialDays?: number; onClose: () => void }) {
  const colors = useThemeColors();
  const { showBooking, showToast } = useApp();
  const [unit, setUnit] = useState<ExtensionUnit>('days');
  const [amountText, setAmountText] = useState(String(Math.max(1, Math.min(60, initialDays))));
  const [quote, setQuote] = useState<ExtensionQuote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const amount = Number(amountText);
  const valid = Number.isInteger(amount) && amount >= 1 && amount <= MAX[unit];

  // Fresh price and availability for every change (short pause so typing does not flood the server)
  useEffect(() => {
    setQuote(null);
    setError('');
    if (!valid) return;
    const t = setTimeout(() => {
      quoteExtension(b.id, unit, amount).then(setQuote, (e: Error) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [b.id, unit, amount, valid]);

  const step = (by: number) => setAmountText(String(Math.max(1, Math.min(MAX[unit], (valid ? amount : 0) + by))));

  const confirm = async () => {
    setBusy(true);
    try {
      const saved = await extendRentalNow(b.id, unit, amount);
      showBooking(saved);
      showToast(`Extended to ${formatDate(saved.returnDate, false)} · ${saved.returnTime}`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet
      visible
      title={`Extend ${b.id}`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
          <Button
            label={busy ? 'Extending…' : quote ? `Extend · +${formatINR(quote.extraTotal)}` : 'Extend'}
            disabled={!quote?.available || busy}
            icon={(c) => <CalendarPlus size={15} color={c} />}
            onPress={confirm}
          />
        </>
      }>
      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 10 }}>
        {b.vehicleName} · now returning {formatDate(b.returnDate, false)} at {b.returnTime}
      </Text>
      <SegmentedControl
        options={UNITS}
        value={unit === 'days' ? 'Days' : 'Hours'}
        onChange={(u) => {
          const next = u === 'Days' ? 'days' : 'hours';
          setUnit(next);
          setAmountText((t) => String(Math.max(1, Math.min(MAX[next], Number(t) || 1))));
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
        <Button label="" size="sm" variant="outline" icon={(c) => <Minus size={14} color={c} />} onPress={() => step(-1)} accessibilityHint={`One ${unit === 'days' ? 'day' : 'hour'} less`} />
        <View style={{ flex: 1 }}>
          <Field
            label={unit === 'days' ? 'Extra days (24 hours each)' : 'Extra hours'}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            error={amountText && !valid ? (unit === 'days' ? '1 to 60 days' : '1 to 23 hours (24+ hours: use days)') : undefined}
          />
        </View>
        <Button label="" size="sm" variant="outline" icon={(c) => <Plus size={14} color={c} />} onPress={() => step(1)} accessibilityHint={`One ${unit === 'days' ? 'day' : 'hour'} more`} />
      </View>

      <View style={{ marginTop: 12, gap: 6, minHeight: 120 }}>
        {!quote && !error && valid ? <ActivityIndicator color={colors.primary} /> : null}
        {quote ? (
          <>
            <Row label="New return" value={`${formatDate(quote.newReturnDate, false)} · ${quote.newReturnTime}`} strong />
            <Row label="Rent" value={formatINR(quote.extraRent)} />
            {quote.extraDriver ? <Row label="Driver" value={formatINR(quote.extraDriver)} /> : null}
            <Row label="GST" value={formatINR(quote.extraTax)} />
            <Row label="Extra charge" value={formatINR(quote.extraTotal)} strong />
            <Text style={{ color: colors.muted, fontSize: 12 }}>{quote.explain}</Text>
            {quote.available ? (
              <Text style={{ color: colors.success, fontSize: 12.5, fontWeight: '700' }}>The car is free for this time.</Text>
            ) : (
              <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '700' }}>{quote.problem}</Text>
            )}
          </>
        ) : null}
        {error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text> : null}
      </View>
    </FormSheet>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: strong ? '800' : '500' }}>{label}</Text>
      <Text style={{ color: colors.txt, fontSize: strong ? 15 : 13, fontWeight: strong ? '800' : '600' }}>{value}</Text>
    </View>
  );
}
