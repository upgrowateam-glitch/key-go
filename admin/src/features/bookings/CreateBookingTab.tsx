import { useRouter } from '@/shims/expo-router';
import { Bell, CalendarCheck, CarFront, CheckCircle2, Clock3, FileText, Hash, Plus, Search, TriangleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Avatar, Badge, Button, Card, ChipGroup, EmptyState, Field, FormRow, SegmentedControl, SplitView, StatusBadge } from '../../components/kit';
import { SelectField } from '../../components/portal/SelectField';
import { DateField } from '../../components/ui/DateField';
import { addDaysYmd, textToYmd, todayYmd } from '../../components/ui/DateCalendar';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { findConflicts } from '../../lib/availability';
import { addDays, daysBetween, formatDate, formatINR } from '../../lib/format';
import { computeQuote, pricingRules, termForDays } from '../../lib/pricing';
import { useThemeColors, useThemedStyles } from '../../theme';
import type { Booking, BookingClassification, RentalPurpose, RentalTerm } from '../../types';
import { categoryFilters, CLASSIFICATIONS, makeStyles, PURPOSES, QuoteLine, TERMS, TIME_RE, validDate, VehicleThumb } from './shared';

type CustomerMode = 'Existing' | 'Walk-in';

/** Pickup and return times offered, every half hour. */
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${i % 2 ? '30' : '00'} ${h < 12 ? 'AM' : 'PM'}`;
});
const STRIP_DAYS = 30;

/**
 * Admin → Bookings → Create booking, in the Level 5 order:
 * 1 customer · 2 category · 3 availability · 4 pickup · 5 return · 6 rental term · 7 purpose · 8 quotation ·
 * 9 classification · 10 confirm · 11 booking ID · 12 reservation status · 13 pickup reminder.
 * The server gives the booking ID, checks date/time clashes again before confirming, and sends the reminder.
 */
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
  const [category, setCategory] = useState<string>('All');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [pickupLocation, setPickupLocation] = useState('Bengaluru International Airport (BLR)');
  const [pickupDate, setPickupDate] = useState(addDays(today, 3));
  const [pickupTime, setPickupTime] = useState('10:00 AM');
  const [returnDate, setReturnDate] = useState(addDays(today, 6));
  const [returnTime, setReturnTime] = useState('10:00 AM');
  const [termOverride, setTermOverride] = useState<RentalTerm | null>(null);
  const [purpose, setPurpose] = useState<RentalPurpose>('Personal');
  const [classOverride, setClassOverride] = useState<BookingClassification | null>(null);
  const [discount, setDiscount] = useState('0');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const [server, setServer] = useState<{ key: string; state: 'checking' | 'free' | 'busy' | 'error'; clashes: Booking[] } | null>(null);

  const datesValid = validDate(pickupDate) && validDate(returnDate);
  const days = datesValid ? daysBetween(pickupDate, returnDate) : 0;
  const windowReady = datesValid && days >= 1 && TIME_RE.test(pickupTime.trim()) && TIME_RE.test(returnTime.trim());

  const conflictsFor = (id: string) =>
    windowReady ? findConflicts(bookings, { vehicleId: id, pickupDate, pickupTime, returnDate, returnTime }, { today }) : [];

  // Sold and workshop cars cannot be booked; every other car is judged by its bookings for these dates
  const bookable = vehicles.filter((v) => v.status !== 'Sold' && v.status !== 'Maintenance' && (category === 'All' || v.type === category));
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const customer = customers.find((c) => c.id === customerId);
  const conflicts = useMemo(() => (vehicleId ? conflictsFor(vehicleId) : []), [vehicleId, bookings, pickupDate, pickupTime, returnDate, returnTime, windowReady]); // eslint-disable-line react-hooks/exhaustive-deps
  const matchingCustomers = customers
    .filter((c) => {
      const q = customerQuery.trim().toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''));
    })
    .slice(0, 6);

  // The server's own check for the chosen car and times (the final word; it checks again on confirm)
  const checkKey = vehicleId && windowReady ? [vehicleId, pickupDate, pickupTime, returnDate, returnTime].join('|') : '';
  useEffect(() => {
    if (!checkKey) return;
    let live = true;
    const t = setTimeout(() => {
      setServer({ key: checkKey, state: 'checking', clashes: [] });
      const q = new URLSearchParams({ vehicleId: vehicleId!, pickupDate, pickupTime: pickupTime.trim(), returnDate, returnTime: returnTime.trim() });
      api<{ available: boolean; clashes: Booking[] }>(`/admin/bookings/availability?${q.toString()}`)
        .then((r) => live && setServer({ key: checkKey, state: r.available ? 'free' : 'busy', clashes: r.clashes }))
        .catch(() => live && setServer({ key: checkKey, state: 'error', clashes: [] }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [checkKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const serverNow = server && server.key === checkKey ? server : null;

  const suggestedTerm = termForDays(Math.max(1, days));
  const term = termOverride ?? suggestedTerm;
  const discountNum = Number(discount.replace(/[^\d.]/g, '')) || 0;
  const quote = vehicle && days >= 1 ? computeQuote(vehicle, days, term, discountNum) : null;
  const reminderDate = validDate(pickupDate) ? addDays(pickupDate, -2) : null;

  // Classification suggestion: walk-in at the counter, a customer who rented before, or business use
  const rentedBefore = !!customerId && bookings.some((b) => b.customerId === customerId && ['Confirmed', 'Active', 'Completed'].includes(b.status));
  const suggestedClass: BookingClassification = mode === 'Walk-in' ? 'Walk-in' : rentedBefore ? 'Repeat customer' : purpose === 'Business' ? 'Corporate' : 'Walk-in';
  const classification = classOverride ?? suggestedClass;

  const errors: Record<string, string | undefined> = {
    customer: mode === 'Existing' && !customerId ? 'Select a customer or switch to walk-in' : undefined,
    walkInName: mode === 'Walk-in' && !walkInName.trim() ? 'Customer name is required' : undefined,
    walkInPhone: mode === 'Walk-in' && walkInPhone.replace(/\D/g, '').length < 10 ? 'Enter a valid phone number (10+ digits)' : undefined,
    vehicle: !vehicle ? 'Select a vehicle' : conflicts.length || serverNow?.state === 'busy' ? 'This vehicle is already booked for these dates and times' : undefined,
    pickupLocation: !pickupLocation.trim() ? 'Pickup location is required' : undefined,
    pickupDate: !validDate(pickupDate) ? 'Pick a date' : daysBetween(today, pickupDate) < 0 ? 'Pickup date is in the past' : undefined,
    returnDate: !validDate(returnDate) ? 'Pick a date' : datesValid && days < 1 ? 'Return must be after pickup' : undefined,
    discount: /[^\d.\s]/.test(discount) ? 'Enter an amount in ₹' : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = async (confirm: boolean) => {
    setSubmitted(true);
    if (hasErrors || !vehicle || busy) return;
    setBusy(true);
    try {
      const b = await createQuote({
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
      if (!b) return;
      if (!confirm) {
        router.replace('/bookings?tab=quotes' as any);
        return;
      }
      const confirmed = await confirmBooking(b.id);
      // A refused confirmation leaves the quotation saved (the reason is shown); staff can confirm it from Quotes
      setDone(confirmed ?? null);
      if (!confirmed) router.replace('/bookings?tab=quotes' as any);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDone(null);
    setSubmitted(false);
    setVehicleId(null);
    setCustomerId(null);
    setCustomerQuery('');
    setWalkInName('');
    setWalkInPhone('');
    setTermOverride(null);
    setClassOverride(null);
    setDiscount('0');
  };

  // ---------------------------------------------------------------- after confirming: 11 ID · 12 status · 13 reminder
  if (done) {
    const car = vehicles.find((v) => v.id === done.vehicleId);
    return (
      <Card style={{ maxWidth: 640, alignSelf: 'center', width: '100%', gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={44} color={colors.primaryText} />
          <Text style={[styles.formHeading, { fontSize: 20, marginBottom: 0 }]}>Booking confirmed</Text>
          <Text style={styles.cardSub}>
            {done.customerName} · {car?.name ?? done.vehicleName} · {formatDate(done.pickupDate)} {done.pickupTime} → {formatDate(done.returnDate)} {done.returnTime}
          </Text>
        </View>
        <DoneRow n={11} icon={<Hash size={16} color={colors.primaryText} />} title="Booking ID">
          <Text style={[styles.strong, { fontSize: 22, letterSpacing: 1 }]} selectable>
            {done.id}
          </Text>
        </DoneRow>
        <DoneRow n={12} icon={<CarFront size={16} color={colors.primaryText} />} title="Vehicle reservation status">
          <Text style={styles.cardSub}>
            {car?.name ?? done.vehicleName} is reserved for this booking.{' '}
            {done.pickupDate <= today ? `Now shown as ${car?.status ?? 'Reserved'}.` : `It shows as Reserved from ${formatDate(done.pickupDate)} and is free for other dates.`}
          </Text>
        </DoneRow>
        <DoneRow n={13} icon={<Bell size={16} color={colors.primaryText} />} title="Pickup reminder">
          <Text style={styles.cardSub}>
            {done.reminderScheduledFor
              ? `Scheduled for ${formatDate(done.reminderScheduledFor)} — sent in the customer app and by WhatsApp (when KeyGo's number is linked).`
              : 'Scheduled two days before pickup.'}
          </Text>
        </DoneRow>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button label="Open booking" icon={(c) => <CalendarCheck size={14} color={c} />} onPress={() => router.push(`/bookings/${encodeURIComponent(done.id)}` as any)} />
          <Button label="Print" variant="outline" icon={(c) => <FileText size={14} color={c} />} onPress={() => router.push(`/bookings/${encodeURIComponent(done.id)}/quotation` as any)} />
          <Button label="New booking" variant="ghost" icon={(c) => <Plus size={14} color={c} />} onPress={reset} />
        </View>
      </Card>
    );
  }

  const form = (
    <View style={{ gap: 12 }}>
      {/* 1 */}
      <Step n={1} title="Select customer" done={mode === 'Existing' ? !!customerId : !!walkInName.trim() && walkInPhone.replace(/\D/g, '').length >= 10}>
        <SegmentedControl options={['Existing', 'Walk-in'] as const} value={mode} onChange={setMode} style={{ marginBottom: 12 }} />
        {mode === 'Existing' ? (
          <View>
            <Field label="Find customer" value={customerQuery} onChangeText={setCustomerQuery} placeholder="Name or phone" left={<Search size={16} color={colors.muted} />} style={{ marginBottom: 8 }} />
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
      </Step>

      {/* 2 */}
      <Step n={2} title="Select vehicle category" done={category !== 'All'} hint={category === 'All' ? 'All categories' : category}>
        <ChipGroup options={categoryFilters()} value={category} onChange={setCategory} scroll />
      </Step>

      {/* 3 */}
      <Step n={3} title="Check vehicle availability" done={!!vehicle && !conflicts.length} hint="Next 30 days · tap a car to choose it">
        <View style={{ flexDirection: 'row', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          <Legend color={colors.primarySoft} border={colors.primaryBorder} label="Free" />
          <Legend color={colors.danger} label="Booked" />
          <Legend color={colors.highlight} label="Your dates" />
        </View>
        <View style={[styles.pickList, !!err('vehicle') && { borderColor: colors.danger }]}>
          {bookable.length === 0 ? (
            <EmptyState compact title="No vehicles" message="No vehicle in this category can be booked." />
          ) : (
            bookable.map((v) => {
              const active = v.id === vehicleId;
              const busyNow = conflictsFor(v.id).length > 0;
              return (
                <TouchableOpacity
                  key={v.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Select ${v.name}`}
                  onPress={() => setVehicleId(v.id)}
                  style={[styles.pickRow, active && styles.pickRowActive, { flexWrap: 'wrap' }]}>
                  <VehicleThumb vehicle={v} width={64} />
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.strong} numberOfLines={1}>
                      {v.name}
                    </Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {v.vehicleNumber} · {v.type} · {v.seats} seats · {formatINR(v.pricePerDay)}/day
                    </Text>
                    <AvailabilityStrip vehicleId={v.id} bookings={bookings} today={today} from={windowReady ? pickupDate : ''} to={windowReady ? returnDate : ''} />
                  </View>
                  {windowReady ? <Badge label={busyNow ? 'Booked' : 'Free'} tone={busyNow ? 'danger' : 'success'} /> : null}
                  {active ? <CheckCircle2 size={18} color={colors.primaryText} /> : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
        {err('vehicle') ? <Text style={styles.errorText}>{err('vehicle')}</Text> : null}
      </Step>

      {/* 4 */}
      <Step n={4} title="Select pickup date and time" done={!errors.pickupDate && !errors.pickupLocation}>
        <Field label="Pickup location" required value={pickupLocation} onChangeText={setPickupLocation} error={err('pickupLocation')} />
        <FormRow>
          <DateField label="Pickup date" required value={pickupDate} onChange={setPickupDate} min={todayYmd()} error={err('pickupDate')} />
          <SelectField label="Pickup time" required value={pickupTime} options={TIMES} onChange={setPickupTime} />
        </FormRow>
      </Step>

      {/* 5 */}
      <Step n={5} title="Select return date and time" done={!errors.returnDate && days >= 1}>
        <FormRow>
          <DateField
            label="Return date"
            required
            value={returnDate}
            onChange={setReturnDate}
            min={addDaysYmd(textToYmd(pickupDate) ?? todayYmd(), 1)}
            rangeFrom={textToYmd(pickupDate)}
            error={err('returnDate')}
          />
          <SelectField label="Return time" required value={returnTime} options={TIMES} onChange={setReturnTime} />
        </FormRow>
        {vehicle && windowReady ? (
          <AvailabilityResult
            name={vehicle.name}
            local={conflicts}
            server={serverNow}
            onOpen={(id) => router.push(`/bookings/${encodeURIComponent(id)}` as any)}
          />
        ) : (
          <Text style={styles.hint}>{vehicle ? 'Pick both dates to check this car.' : 'Choose a car in step 3 to check it for these dates and times.'}</Text>
        )}
      </Step>

      {/* 6 */}
      <Step n={6} title="Select daily / weekly / monthly rental" done={days >= 1} hint={days >= 1 ? `${days} day${days === 1 ? '' : 's'} · suggested ${suggestedTerm}` : undefined}>
        <SegmentedControl options={TERMS} value={term} onChange={(t) => setTermOverride(t)} />
        {termOverride && termOverride !== suggestedTerm ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => setTermOverride(null)}>
            <Text style={[styles.link, { marginTop: 8 }]}>Use suggested term ({suggestedTerm})</Text>
          </TouchableOpacity>
        ) : null}
        {days >= 1 && days < pricingRules().minDays[term] ? (
          <Text style={[styles.hint, { color: colors.warmText }]}>
            {term} term is normally for {pricingRules().minDays[term]}+ days.
          </Text>
        ) : null}
      </Step>

      {/* 7 */}
      <Step n={7} title="Enter rent purpose" done>
        <ChipGroup options={PURPOSES} value={purpose} onChange={setPurpose} />
      </Step>

      {/* 8 */}
      <Step n={8} title="Rental quotation" done={!!quote} hint="Updates as you change the steps above">
        {quote ? (
          <>
            <QuoteLine label={`Base (${formatINR(quote.ratePerDay)} × ${quote.days} days)`} value={formatINR(quote.base)} />
            <QuoteLine
              label={`${term} term discount (${quote.base ? Math.round((quote.termDiscount / quote.base) * 100) : 0}%)`}
              value={quote.termDiscount ? formatINR(-quote.termDiscount) : formatINR(0)}
              tone="discount"
            />
            <Field
              label="Manual discount (₹)"
              value={discount}
              onChangeText={setDiscount}
              keyboardType="numeric"
              hint="Applied after the term discount, before GST"
              error={err('discount')}
              style={{ marginTop: 8, marginBottom: 6 }}
            />
            <QuoteLine label="Subtotal" value={formatINR(quote.subtotal)} />
            <QuoteLine label={`GST (${Math.round(pricingRules().taxRate * 100)}%)`} value={formatINR(quote.tax)} />
            <View style={styles.quoteDivider} />
            <QuoteLine label="Total" value={formatINR(quote.total)} strong />
            <QuoteLine label="Refundable security deposit" value={formatINR(quote.deposit)} />
            <Text style={[styles.hint, { marginTop: 6 }]}>Saved quotations get their booking number and stay valid for 48 hours (Settings → Bookings).</Text>
          </>
        ) : (
          <Text style={styles.cardSub}>Choose a car and valid dates to see the price.</Text>
        )}
      </Step>

      {/* 9 */}
      <Step n={9} title="Apply booking classification" done hint={classOverride ? undefined : `Suggested: ${suggestedClass}`}>
        <ChipGroup options={CLASSIFICATIONS} value={classification} onChange={setClassOverride} />
      </Step>
    </View>
  );

  const side = (
    <Card tone="soft">
      <Text style={styles.formHeading}>10 · Confirm booking</Text>
      <SummaryLine label="Customer" value={mode === 'Existing' ? customer?.name ?? '—' : walkInName.trim() || '—'} />
      <SummaryLine label="Car" value={vehicle ? `${vehicle.name} · ${vehicle.vehicleNumber}` : '—'} />
      <SummaryLine label="Pickup" value={validDate(pickupDate) ? `${formatDate(pickupDate)} · ${pickupTime}` : '—'} />
      <SummaryLine label="Return" value={validDate(returnDate) ? `${formatDate(returnDate)} · ${returnTime}` : '—'} />
      <SummaryLine label="Rental" value={`${term} · ${purpose} · ${classification}`} />
      <View style={styles.quoteDivider} />
      <QuoteLine label="Total" value={quote ? formatINR(quote.total) : '—'} strong />
      <QuoteLine label="Deposit" value={quote ? formatINR(quote.deposit) : '—'} />
      {reminderDate ? (
        <View style={[styles.reminderChip, { marginTop: 12 }]}>
          <Bell size={12} color={colors.onHighlight} />
          <Text style={styles.reminderText}>
            13 · Pickup reminder on {formatDate(reminderDate)}
            {daysBetween(today, reminderDate) < 0 ? ' · sent right away' : ''}
          </Text>
        </View>
      ) : null}
      <View style={{ gap: 8, marginTop: 14 }}>
        <Button
          label={busy ? 'Saving…' : 'Confirm booking'}
          disabled={busy || serverNow?.state === 'busy' || conflicts.length > 0}
          icon={(c) => <CalendarCheck size={14} color={c} />}
          onPress={() => save(true)}
        />
        <Button label="Save as quotation only" variant="outline" disabled={busy} icon={(c) => <FileText size={14} color={c} />} onPress={() => save(false)} />
      </View>
      <Text style={[styles.hint, { marginTop: 10 }]}>11 · The booking ID is given when saved (KG + date + number of the day, e.g. KG26112301).</Text>
      {submitted && hasErrors ? <Text style={styles.errorText}>Please fix the highlighted steps.</Text> : null}
    </Card>
  );

  return <SplitView main={form} side={side} sideWidth={340} />;
}

// ---------------------------------------------------------------- pieces

function Step({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children: ReactNode }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: done ? colors.primary : colors.bg2,
          }}>
          {done ? <CheckCircle2 size={16} color={colors.onPrimary} /> : <Text style={{ color: colors.txt, fontWeight: '800', fontSize: 12.5 }}>{n}</Text>}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.strong, { fontSize: 15 }]} accessibilityRole="header">
            {n}. {title}
          </Text>
          {hint ? <Text style={styles.cardSub}>{hint}</Text> : null}
        </View>
      </View>
      {children}
    </Card>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3 }}>
      <Text style={styles.cardSub}>{label}</Text>
      <Text style={[styles.strong, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function DoneRow({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, backgroundColor: colors.bg2 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={styles.fieldLabel}>
          {n} · {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, borderWidth: border ? 1 : 0, borderColor: border }} />
      <Text style={styles.cardSub}>{label}</Text>
    </View>
  );
}

/** The next 30 days of a car: booked days in red, the chosen dates outlined in yellow. */
function AvailabilityStrip({ vehicleId, bookings, today, from, to }: { vehicleId: string; bookings: Booking[]; today: string; from: string; to: string }) {
  const colors = useThemeColors();
  const held = bookings.filter((b) => b.vehicleId === vehicleId && (b.status === 'Confirmed' || b.status === 'Active'));
  const daysList = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i));
  const bookedCount = daysList.filter((d) => held.some((b) => b.pickupDate <= d && (b.returnDate >= d || b.status === 'Active'))).length;
  return (
    <View accessibilityLabel={`Next 30 days: ${bookedCount ? `booked on ${bookedCount} day${bookedCount === 1 ? '' : 's'}` : 'free every day'}`} style={{ marginTop: 6 }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {daysList.map((d) => {
          const booked = held.some((b) => b.pickupDate <= d && (b.returnDate >= d || b.status === 'Active'));
          const mine = !!from && !!to && d >= from && d <= to;
          return (
            <View
              key={d}
              style={{
                flex: 1,
                height: 10,
                borderRadius: 2,
                backgroundColor: booked ? colors.danger : colors.primarySoft,
                borderWidth: mine ? 2 : booked ? 0 : 1,
                borderColor: mine ? colors.highlight : colors.primaryBorder,
              }}
            />
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 10, color: colors.muted }}>Today</Text>
        <Text style={{ fontSize: 10, color: colors.muted }}>{formatDate(addDays(today, STRIP_DAYS - 1), false)}</Text>
      </View>
    </View>
  );
}

/** Steps 3–5 result: is the chosen car free for the exact dates and times? (the server's answer when it has one) */
function AvailabilityResult({
  name,
  local,
  server,
  onOpen,
}: {
  name: string;
  local: Booking[];
  server: { state: 'checking' | 'free' | 'busy' | 'error'; clashes: Booking[] } | null;
  onOpen: (id: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const clashes = server?.state === 'busy' ? server.clashes : local;
  if (clashes.length) {
    return (
      <Card tone="highlight" style={{ marginTop: 4, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TriangleAlert size={16} color={colors.danger} />
          <Text style={styles.strong}>
            {name} is booked at this time ({clashes.length === 1 ? '1 booking' : `${clashes.length} bookings`})
          </Text>
        </View>
        {clashes.map((c) => (
          <TouchableOpacity key={c.id} accessibilityRole="link" onPress={() => onOpen(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={styles.link}>{c.id}</Text>
            <Text style={styles.cardSub}>
              {c.customerName} · {formatDate(c.pickupDate, false)} {c.pickupTime} – {formatDate(c.returnDate, false)} {c.returnTime}
            </Text>
            <StatusBadge status={c.status} />
          </TouchableOpacity>
        ))}
        <Text style={styles.cardSub}>Change the dates or times, or choose another car.</Text>
      </Card>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
      {server?.state === 'checking' ? (
        <Clock3 size={16} color={colors.muted} />
      ) : server?.state === 'error' ? (
        <TriangleAlert size={16} color={colors.warmText} />
      ) : (
        <CheckCircle2 size={16} color={colors.primaryText} />
      )}
      <Text style={styles.cardSub}>
        {server?.state === 'checking'
          ? 'Checking with the server…'
          : server?.state === 'error'
            ? 'Could not check with the server now — it checks again when you confirm.'
            : `${name} is free for these dates and times.`}
      </Text>
    </View>
  );
}
