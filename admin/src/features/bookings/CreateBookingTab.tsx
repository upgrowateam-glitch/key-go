import { useRouter } from '@/shims/expo-router';
import { Bell, CalendarCheck, CheckCircle2, FileText, Search, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Avatar, Badge, Button, Card, ChipGroup, EmptyState, Field, FormRow, Section, SegmentedControl, SimulatedNote, SplitView, StatusBadge } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { findConflicts } from '../../lib/availability';
import { addDays, daysBetween, formatDate, formatINR } from '../../lib/format';
import { computeQuote, PRICING_RULES, termForDays } from '../../lib/pricing';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { BookingClassification, RentalPurpose, RentalTerm } from '../../types';
import { CATEGORY_FILTERS, CLASSIFICATIONS, makeStyles, PURPOSES, QuoteLine, TERMS, TIME_RE, validDate, VehicleThumb } from './shared';

type CustomerMode = 'Existing' | 'Walk-in';

export function CreateBookingTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { customers, vehicles, bookings, today, createQuote, confirmBooking } = useApp();

  const [mode, setMode] = useState<CustomerMode>('Existing');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_FILTERS)[number]>('All');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [pickupLocation, setPickupLocation] = useState('Bengaluru International Airport (BLR)');
  const [pickupDate, setPickupDate] = useState(addDays(today, 3));
  const [pickupTime, setPickupTime] = useState('10:00 AM');
  const [returnDate, setReturnDate] = useState(addDays(today, 6));
  const [returnTime, setReturnTime] = useState('06:00 PM');
  const [termOverride, setTermOverride] = useState<RentalTerm | null>(null);
  const [purpose, setPurpose] = useState<RentalPurpose>('Personal');
  const [classification, setClassification] = useState<BookingClassification>('Walk-in');
  const [discount, setDiscount] = useState('0');
  const [submitted, setSubmitted] = useState(false);

  const datesValid = validDate(pickupDate) && validDate(returnDate);
  const days = datesValid ? daysBetween(pickupDate, returnDate) : 0;
  const windowReady = datesValid && days >= 1 && TIME_RE.test(pickupTime.trim()) && TIME_RE.test(returnTime.trim());

  const conflictsFor = (id: string) =>
    windowReady ? findConflicts(bookings, { vehicleId: id, pickupDate, pickupTime, returnDate, returnTime }, { today }) : [];

  // Sold and workshop cars cannot be booked; every other car is judged by its bookings for these dates
  const bookable = vehicles.filter((v) => v.status !== 'Sold' && v.status !== 'Maintenance' && (category === 'All' || v.type === category));
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const conflicts = useMemo(() => (vehicleId ? conflictsFor(vehicleId) : []), [vehicleId, bookings, pickupDate, pickupTime, returnDate, returnTime, windowReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const matchingCustomers = customers
    .filter((c) => {
      const q = customerQuery.trim().toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''));
    })
    .slice(0, 6);

  const suggestedTerm = termForDays(Math.max(1, days));
  const term = termOverride ?? suggestedTerm;
  const discountNum = Number(discount.replace(/[^\d.]/g, '')) || 0;
  const quote = vehicle && days >= 1 ? computeQuote(vehicle, days, term, discountNum) : null;
  const reminderDate = validDate(pickupDate) ? addDays(pickupDate, -2) : null;

  const errors: Record<string, string | undefined> = {
    customer: mode === 'Existing' && !customerId ? 'Select a customer or switch to walk-in' : undefined,
    walkInName: mode === 'Walk-in' && !walkInName.trim() ? 'Customer name is required' : undefined,
    walkInPhone: mode === 'Walk-in' && walkInPhone.replace(/\D/g, '').length < 10 ? 'Enter a valid phone number (10+ digits)' : undefined,
    vehicle: !vehicle ? 'Select a vehicle' : conflicts.length ? 'This vehicle is already booked for these dates' : undefined,
    pickupLocation: !pickupLocation.trim() ? 'Pickup location is required' : undefined,
    pickupDate: !validDate(pickupDate) ? 'Use YYYY-MM-DD' : daysBetween(today, pickupDate) < 0 ? 'Pickup date is in the past' : undefined,
    pickupTime: !TIME_RE.test(pickupTime.trim()) ? 'Use hh:mm AM/PM' : undefined,
    returnDate: !validDate(returnDate) ? 'Use YYYY-MM-DD' : datesValid && days < 1 ? 'Return must be after pickup' : undefined,
    returnTime: !TIME_RE.test(returnTime.trim()) ? 'Use hh:mm AM/PM' : undefined,
    discount: /[^\d.\s]/.test(discount) ? 'Enter an amount in ₹' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = (confirm: boolean) => {
    setSubmitted(true);
    if (hasErrors || !vehicle) return;
    const b = createQuote({
      vehicleId: vehicle.id,
      customerId: mode === 'Existing' ? customerId ?? undefined : undefined,
      customerName: mode === 'Walk-in' ? walkInName.trim() : undefined,
      customerPhone: mode === 'Walk-in' ? walkInPhone.trim() : undefined,
      pickupLocation: pickupLocation.trim(),
      pickupDate,
      pickupTime: pickupTime.trim().toUpperCase(),
      returnDate,
      returnTime: returnTime.trim().toUpperCase(),
      term,
      purpose,
      classification,
      discount: discountNum,
    });
    if (confirm) {
      confirmBooking(b.id);
      router.push(`/bookings/${encodeURIComponent(b.id)}` as any);
    } else {
      router.replace('/bookings?tab=quotes' as any);
    }
  };

  const form = (
    <View>
      <Section title="Customer" style={{ marginTop: 0 }}>
        <Card>
          <SegmentedControl options={['Existing', 'Walk-in'] as const} value={mode} onChange={setMode} style={{ marginBottom: 12 }} />
          {mode === 'Existing' ? (
            <View>
              <Field
                label="Find customer"
                value={customerQuery}
                onChangeText={setCustomerQuery}
                placeholder="Name or phone"
                left={<Search size={16} color={colors.muted} />}
                style={{ marginBottom: 8 }}
              />
              <View style={[styles.pickList, !!err('customer') && { borderColor: colors.danger }]}>
                {matchingCustomers.length === 0 ? (
                  <EmptyState compact title="No customers found" message="Try another name, or add them as a walk-in." />
                ) : (
                  matchingCustomers.map((c) => {
                    const active = c.id === customerId;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Select ${c.name}`}
                        onPress={() => setCustomerId(c.id)}
                        style={[styles.pickRow, active && styles.pickRowActive]}>
                        <Avatar name={c.name} bg={c.avatarBg} size={30} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.strong} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Text style={styles.cardSub} numberOfLines={1}>
                            {c.phone} · {c.city}
                          </Text>
                        </View>
                        <Badge label={c.loyaltyTier} tone={c.loyaltyTier === 'VIP' || c.loyaltyTier === 'Gold' ? 'highlight' : 'neutral'} />
                        {active ? <CheckCircle2 size={18} color={colors.primaryText} /> : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
              {err('customer') ? <Text style={styles.errorText}>{err('customer')}</Text> : null}
            </View>
          ) : (
            <FormRow>
              <Field label="Customer name" required value={walkInName} onChangeText={setWalkInName} placeholder="Full name" error={err('walkInName')} />
              <Field label="Phone" required value={walkInPhone} onChangeText={setWalkInPhone} placeholder="+91 98xxx xxxxx" keyboardType="phone-pad" error={err('walkInPhone')} />
            </FormRow>
          )}
        </Card>
      </Section>

      <Section title="Trip">
        <Card>
          <Field label="Pickup location" required value={pickupLocation} onChangeText={setPickupLocation} error={err('pickupLocation')} />
          <FormRow>
            <Field label="Pickup date" required value={pickupDate} onChangeText={setPickupDate} placeholder="YYYY-MM-DD" error={err('pickupDate')} />
            <Field label="Pickup time" required value={pickupTime} onChangeText={setPickupTime} placeholder="10:00 AM" error={err('pickupTime')} />
          </FormRow>
          <FormRow>
            <Field label="Return date" required value={returnDate} onChangeText={setReturnDate} placeholder="YYYY-MM-DD" error={err('returnDate')} />
            <Field label="Return time" required value={returnTime} onChangeText={setReturnTime} placeholder="06:00 PM" error={err('returnTime')} />
          </FormRow>

          <Text style={styles.fieldLabel}>Rental term</Text>
          <SegmentedControl options={TERMS} value={term} onChange={(t) => setTermOverride(t)} />
          <Text style={styles.hint}>{days >= 1 ? `${days} day${days === 1 ? '' : 's'} · suggested term: ${suggestedTerm}` : 'Enter valid dates to get a term suggestion'}</Text>
          {termOverride && termOverride !== suggestedTerm ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => setTermOverride(null)}>
              <Text style={styles.link}>Use suggested term ({suggestedTerm})</Text>
            </TouchableOpacity>
          ) : null}
          {days >= 1 && days < PRICING_RULES.minDays[term] ? (
            <Text style={[styles.hint, { color: colors.warmText }]}>
              {term} term is normally for {PRICING_RULES.minDays[term]}+ days.
            </Text>
          ) : null}

          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Purpose</Text>
          <ChipGroup options={PURPOSES} value={purpose} onChange={setPurpose} />
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Classification</Text>
          <ChipGroup options={CLASSIFICATIONS} value={classification} onChange={setClassification} />

          <Field
            label="Manual discount (₹)"
            value={discount}
            onChangeText={setDiscount}
            keyboardType="numeric"
            hint="Applied after the term discount, before GST"
            error={err('discount')}
            style={{ marginTop: 14, marginBottom: 0 }}
          />
        </Card>
      </Section>

      <Section title="Vehicle" subtitle="Availability is checked against the dates and times above">
        <Card>
          <View style={{ marginBottom: 10 }}>
            <ChipGroup options={CATEGORY_FILTERS} value={category} onChange={setCategory} scroll />
          </View>
          <View style={[styles.pickList, !!err('vehicle') && { borderColor: colors.danger }]}>
            {bookable.length === 0 ? (
              <EmptyState compact title="No vehicles" message="No vehicle in this category can be booked." />
            ) : (
              bookable.map((v) => {
                const active = v.id === vehicleId;
                const busy = conflictsFor(v.id).length > 0;
                return (
                  <TouchableOpacity
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Select ${v.name}`}
                    onPress={() => setVehicleId(v.id)}
                    style={[styles.pickRow, active && styles.pickRowActive]}>
                    <VehicleThumb vehicle={v} width={64} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.strong} numberOfLines={1}>
                        {v.name}
                      </Text>
                      <Text style={styles.cardSub} numberOfLines={1}>
                        {v.vehicleNumber} · {v.type} · {v.seats} seats
                      </Text>
                    </View>
                    {busy ? <Badge label="Booked" tone="danger" /> : null}
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.strong}>{formatINR(v.pricePerDay)}</Text>
                      <Text style={styles.cardSub}>per day</Text>
                    </View>
                    {active ? <CheckCircle2 size={18} color={colors.primaryText} /> : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
          {err('vehicle') ? <Text style={styles.errorText}>{err('vehicle')}</Text> : null}
          {conflicts.length ? (
            <Card tone="highlight" style={{ marginTop: 10, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TriangleAlert size={16} color={colors.danger} />
                <Text style={styles.strong}>Overlaps with {conflicts.length === 1 ? 'a booking' : `${conflicts.length} bookings`}</Text>
              </View>
              {conflicts.map((c) => (
                <TouchableOpacity key={c.id} accessibilityRole="link" onPress={() => router.push(`/bookings/${encodeURIComponent(c.id)}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.link}>{c.id}</Text>
                  <Text style={styles.cardSub}>
                    {c.customerName} · {formatDate(c.pickupDate, false)} {c.pickupTime} – {formatDate(c.returnDate, false)} {c.returnTime}
                  </Text>
                  <StatusBadge status={c.status} />
                </TouchableOpacity>
              ))}
            </Card>
          ) : null}
          <SimulatedNote>This check only covers bookings loaded in this browser. The backend must enforce vehicle availability atomically when a booking is saved.</SimulatedNote>
        </Card>
      </Section>
    </View>
  );

  const preview = (
    <Card tone="soft">
      <Text style={styles.formHeading}>Quote preview</Text>
      {quote ? (
        <>
          <QuoteLine label={`Base (${formatINR(quote.ratePerDay)} × ${quote.days} days)`} value={formatINR(quote.base)} />
          <QuoteLine label={`${term} term discount (${Math.round(PRICING_RULES.termDiscount[term] * 100)}%)`} value={quote.termDiscount ? formatINR(-quote.termDiscount) : formatINR(0)} tone="discount" />
          <QuoteLine label="Manual discount" value={quote.manualDiscount ? formatINR(-quote.manualDiscount) : formatINR(0)} tone="discount" />
          <QuoteLine label="Subtotal" value={formatINR(quote.subtotal)} />
          <QuoteLine label={`GST (${Math.round(PRICING_RULES.taxRate * 100)}%)`} value={formatINR(quote.tax)} />
          <View style={styles.quoteDivider} />
          <QuoteLine label="Total" value={formatINR(quote.total)} strong />
          <QuoteLine label="Refundable security deposit" value={formatINR(quote.deposit)} />
        </>
      ) : (
        <Text style={styles.cardSub}>Select a vehicle and valid dates to see the price.</Text>
      )}
      {vehicle ? (
        <>
          <View style={styles.quoteDivider} />
          <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Rates for {vehicle.name}</Text>
          {TERMS.map((t) => {
            const perDay = Math.round(vehicle.pricePerDay * (1 - PRICING_RULES.termDiscount[t]));
            const length = PRICING_RULES.minDays[t];
            return <QuoteLine key={t} label={`${t} (${formatINR(perDay)}/day)`} value={t === 'Daily' ? `${formatINR(perDay)}/day` : `${formatINR(perDay * length)}/${length}d`} />;
          })}
        </>
      ) : null}
      {reminderDate ? (
        <View style={[styles.reminderChip, { marginTop: 12 }]}>
          <Bell size={12} color={colors.onHighlight} />
          <Text style={styles.reminderText}>
            Pickup reminder will be scheduled for {formatDate(reminderDate)} (T-2)
            {daysBetween(today, reminderDate) < 0 ? ' · already due' : ''}
          </Text>
        </View>
      ) : null}
      <View style={{ gap: 8, marginTop: 14 }}>
        <Button label="Save & confirm" icon={(c) => <CalendarCheck size={14} color={c} />} onPress={() => save(true)} />
        <Button label="Save quote" variant="outline" icon={(c) => <FileText size={14} color={c} />} onPress={() => save(false)} />
      </View>
      {submitted && hasErrors ? <Text style={styles.errorText}>Please fix the highlighted fields.</Text> : null}
      <SimulatedNote>Sample pricing rules: final rates, discounts and tax rules are pending business confirmation.</SimulatedNote>
    </Card>
  );

  return <SplitView main={form} side={preview} sideWidth={340} />;
}
