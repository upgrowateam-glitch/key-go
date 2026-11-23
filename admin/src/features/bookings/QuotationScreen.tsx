'use client';

import { useLocalSearchParams, useRouter } from '@/shims/expo-router';
import { ArrowLeft, Printer, RefreshCw, Send } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, EmptyState } from '../../components/kit';
import { KeyGoLogo } from '../../components/ui/KeyGoLogo';
import { useApp } from '../../context/AppContext';
import { formatDate, formatINR } from '../../lib/format';
import { companyStore } from '../../services/settings';
import { useThemeColors } from '../../theme';
import { WithStore } from '../notifications/listControls';

/** Only the document is printed (the portal's menus and these buttons are hidden). */
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #keygo-quotation, #keygo-quotation * { visibility: visible !important; }
  #keygo-quotation { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: 0 !important; }
  @page { margin: 14mm; }
}`;

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

/**
 * A booking's quotation (or, once confirmed, its booking confirmation) as a clean page to print, save as PDF or
 * send by WhatsApp. Route: /bookings/<id>/quotation.
 */
export default function QuotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { bookings, vehicles, customers, sendQuote, renewQuote } = useApp();
  const [sending, setSending] = useState(false);
  const b = bookings.find((x) => x.id === id);
  if (!b) {
    return <EmptyState title="Booking not found" message={`There is no booking ${id ?? ''}.`} action={<Button label="Back to bookings" onPress={() => router.push('/bookings' as any)} />} />;
  }
  const car = vehicles.find((v) => v.id === b.vehicleId);
  const customer = customers.find((c) => c.id === b.customerId);
  const isQuote = b.status === 'Quoted' || b.status === 'Pending';
  const expired = isQuote && !!b.quoteValidUntil && Date.parse(b.quoteValidUntil) < Date.now();
  const rent = b.subtotal + (b.discount || 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
      <style>{PRINT_CSS}</style>
      <View style={{ width: '100%', maxWidth: 820, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Button label="Back" variant="ghost" icon={(c) => <ArrowLeft size={14} color={c} />} onPress={() => router.back()} />
        <View style={{ flex: 1 }} />
        {expired ? <Button label="Renew quotation" variant="outline" icon={(c) => <RefreshCw size={14} color={c} />} onPress={() => renewQuote(b.id)} /> : null}
        {isQuote && !expired ? (
          <Button
            label={sending ? 'Sending…' : b.quoteSentAt ? 'Send again by WhatsApp' : 'Send by WhatsApp'}
            variant="outline"
            disabled={sending}
            icon={(c) => <Send size={14} color={c} />}
            onPress={async () => {
              setSending(true);
              await sendQuote(b.id);
              setSending(false);
            }}
          />
        ) : null}
        <Button label="Print / Save as PDF" icon={(c) => <Printer size={14} color={c} />} onPress={() => window.print()} />
      </View>

      <WithStore store={companyStore}>
        {(company) => (
          <View
            nativeID="keygo-quotation"
            style={{ width: '100%', maxWidth: 820, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 32, gap: 22 }}>
            {/* header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <View style={{ gap: 6, maxWidth: 380 }}>
                <KeyGoLogo size={34} showText textColor="#0B3A2C" accentColor="#E0A100" />
                <Text style={doc.small}>{company.legalName || company.name}</Text>
                {company.address ? <Text style={doc.small}>{company.address}</Text> : null}
                <Text style={doc.small}>{[company.phone, company.email].filter(Boolean).join(' · ')}</Text>
                {company.gstin ? <Text style={doc.small}>GSTIN {company.gstin}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={doc.title}>{isQuote ? 'Rental quotation' : 'Booking confirmation'}</Text>
                <Text style={doc.idText}>{b.id}</Text>
                <Text style={doc.small}>Date: {formatDate(b.createdAt)}</Text>
                {isQuote && b.quoteValidUntil ? <Text style={[doc.small, expired && { color: '#B42318', fontWeight: '700' }]}>{expired ? 'Expired' : 'Valid until'}: {when(b.quoteValidUntil)}</Text> : null}
                {!isQuote ? <Text style={doc.small}>Status: {b.status}</Text> : null}
              </View>
            </View>

            {/* customer, car and trip */}
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              <Box title="Customer">
                <Text style={doc.strong}>{b.customerName}</Text>
                <Text style={doc.small}>{b.customerPhone}</Text>
                {customer?.email ? <Text style={doc.small}>{customer.email}</Text> : null}
              </Box>
              <Box title="Vehicle">
                <Text style={doc.strong}>{car?.name ?? b.vehicleName}</Text>
                <Text style={doc.small}>
                  {[b.vehicleNumber, car?.type ?? b.vehicleCategory, car ? `${car.seats} seats` : ''].filter(Boolean).join(' · ')}
                </Text>
              </Box>
            </View>
            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              <Box title="Pickup">
                <Text style={doc.strong}>
                  {formatDate(b.pickupDate)} · {b.pickupTime}
                </Text>
                <Text style={doc.small}>{b.pickupLocation}</Text>
              </Box>
              <Box title="Return">
                <Text style={doc.strong}>
                  {formatDate(b.returnDate)} · {b.returnTime}
                </Text>
                <Text style={doc.small}>
                  {b.days} day{b.days === 1 ? '' : 's'} · {b.term} rental · {b.purpose}
                </Text>
              </Box>
            </View>

            {/* price */}
            <View style={{ borderWidth: 1, borderColor: '#E3E7E4', borderRadius: 10, overflow: 'hidden' }}>
              <Row label={`Rent (${formatINR(b.baseRatePerDay)}/day, ${b.days} day${b.days === 1 ? '' : 's'}, ${b.term.toLowerCase()})`} value={formatINR(rent)} />
              {b.discount ? <Row label="Discount" value={`−${formatINR(b.discount)}`} /> : null}
              <Row label="Subtotal" value={formatINR(b.subtotal)} />
              <Row label="GST" value={formatINR(b.tax)} />
              <Row label="Total payable" value={formatINR(b.totalAmount)} strong />
              <Row label="Refundable security deposit" value={formatINR(b.depositAmount)} />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={doc.small}>Booking classification: {b.classification}</Text>
              {isQuote ? (
                <Text style={doc.small}>
                  This quotation holds the price until it expires. The car is reserved only once the booking is confirmed; dates and times are checked again at that point.
                </Text>
              ) : (
                <Text style={doc.small}>
                  A pickup reminder is sent {b.reminderScheduledFor ? `on ${formatDate(b.reminderScheduledFor)}` : 'two days before pickup'}. Please bring your driving licence and ID card.
                </Text>
              )}
              <Text style={doc.small}>Fuel, tolls, fines and damage are charged as per the rental agreement.</Text>
            </View>
          </View>
        )}
      </WithStore>
    </ScrollView>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 220, gap: 3, padding: 12, borderRadius: 10, backgroundColor: '#F5F7F5' }}>
      <Text style={doc.label}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: '#E3E7E4',
        backgroundColor: strong ? '#F1F6F2' : '#FFFFFF',
      }}>
      <Text style={strong ? doc.strong : doc.body}>{label}</Text>
      <Text style={strong ? [doc.strong, { fontSize: 16 }] : doc.body}>{value}</Text>
    </View>
  );
}

// Fixed print colours (not the theme), so the document looks the same in dark mode and on paper
const doc = {
  title: { color: '#0B3A2C', fontSize: 20, fontWeight: '800' as const },
  idText: { color: '#1F2421', fontSize: 16, fontWeight: '800' as const, letterSpacing: 1 },
  label: { color: '#5B6560', fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  strong: { color: '#1F2421', fontSize: 14, fontWeight: '700' as const },
  body: { color: '#1F2421', fontSize: 13.5 },
  small: { color: '#5B6560', fontSize: 12.5, lineHeight: 18 },
};
