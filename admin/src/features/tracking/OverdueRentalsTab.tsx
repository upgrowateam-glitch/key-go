import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, CalendarPlus, CheckCircle2, IndianRupee, LogIn, Phone } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, FormSheet, Grid, Section, StatTile } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { daysBetween, formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { isOverdue } from '../../lib/lifecycle';
import { useResource } from '../../services/mockClient';
import { ContactOutcome, loadContactLog, logContact } from '../../services/tracking';
import type { Booking } from '../../types';
import { FilterGroup, ListToolbar, Pager, parseAmount, useCommonStyles, usePaged } from '../agreements/listTools';

const OUTCOMES: ContactOutcome[] = ['Reached', 'No answer', 'Promised return', 'Escalated'];
const SORTS = ['Most late', 'Highest charge', 'Customer A-Z'] as const;
type Sort = (typeof SORTS)[number];

export default function OverdueRentalsTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { bookings, today, extendRental, showToast } = useApp();
  const res = useResource(loadContactLog);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('Most late');
  const [contactFor, setContactFor] = useState<Booking | null>(null);
  const [outcome, setOutcome] = useState<ContactOutcome>('Reached');
  const [note, setNote] = useState('');
  const [by, setBy] = useState('');
  const [errors, setErrors] = useState<{ note?: string; by?: string }>({});
  const [extendFor, setExtendFor] = useState<Booking | null>(null);
  const [extraDays, setExtraDays] = useState('1');
  const [daysError, setDaysError] = useState<string>();
  const [confirmExtend, setConfirmExtend] = useState<{ booking: Booking; days: number } | null>(null);

  const lateDays = (b: Booking) => daysBetween(b.returnDate, today);
  const lateCharge = (b: Booking) => lateDays(b) * b.baseRatePerDay;

  const overdue = useMemo(() => bookings.filter((b) => isOverdue(b, today)), [bookings, today]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return overdue
      .filter((b) => !q || [b.id, b.customerName, b.customerPhone, b.vehicleName, b.vehicleNumber].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => (sort === 'Customer A-Z' ? a.customerName.localeCompare(b.customerName) : sort === 'Highest charge' ? daysBetween(b.returnDate, today) * b.baseRatePerDay - daysBetween(a.returnDate, today) * a.baseRatePerDay : a.returnDate.localeCompare(b.returnDate)));
  }, [overdue, query, sort, today]);
  const paged = usePaged(shown, `${query}|${sort}`, 8);

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;
  const contacts = res.data ?? [];

  const filtersActive = !!query || sort !== 'Most late';
  const reset = () => {
    setQuery('');
    setSort('Most late');
  };
  const openContact = (b: Booking) => {
    setOutcome('Reached');
    setNote('');
    setBy('');
    setErrors({});
    setContactFor(b);
  };
  const submitContact = () => {
    if (!contactFor) return;
    const e: typeof errors = {};
    if (note.trim().length < 3) e.note = 'Add a short note about the call';
    if (by.trim().length < 2) e.by = 'Enter who made contact';
    setErrors(e);
    if (Object.keys(e).length) return;
    logContact({ bookingId: contactFor.id, outcome, note: note.trim(), by: by.trim() }).then(
      (d) => {
        res.setData(d);
        setContactFor(null);
        showToast('Contact attempt logged');
      },
      (err: Error) => showToast(err.message)
    );
  };
  const openExtend = (b: Booking) => {
    setExtraDays(String(Math.max(1, lateDays(b))));
    setDaysError(undefined);
    setExtendFor(b);
  };
  const reviewExtend = () => {
    if (!extendFor) return;
    const n = parseAmount(extraDays);
    if (!(n >= 1) || !Number.isInteger(n)) return setDaysError('Enter a whole number of days');
    if (n > 60) return setDaysError('Extend by 60 days at most');
    setConfirmExtend({ booking: extendFor, days: n });
    setExtendFor(null);
  };

  return (
    <View>
      <Grid cols={cols(1, 3, 3)}>
        <StatTile label="Overdue rentals" value={overdue.length} tone={overdue.length ? 'danger' : 'success'} emphasis={overdue.length > 0} hint={overdue.length ? 'Past the return date' : 'All on time'} icon={(c) => <AlertTriangle size={16} color={c} />} />
        <StatTile label="Estimated late charges" value={formatINRCompact(overdue.reduce((s, b) => s + lateCharge(b), 0))} tone="warning" hint="Late days × daily rate" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Contact attempts logged" value={contacts.filter((c) => overdue.some((b) => b.id === c.bookingId)).length} tone="info" icon={(c) => <Phone size={16} color={c} />} />
      </Grid>

      <Section title="Overdue returns" subtitle={`${shown.length} of ${overdue.length} shown`}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Booking, customer, phone or vehicle" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        {shown.length === 0 ? (
          <Card>
            <EmptyState
              title={overdue.length ? 'No rentals match' : 'No overdue rentals'}
              message={overdue.length ? 'Try another search.' : 'Every active rental is within its return date.'}
              icon={(c) => <CheckCircle2 size={22} color={c} />}
              action={filtersActive ? <Button label="Reset" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          </Card>
        ) : (
          <Grid cols={cols(1, 1, 2)}>
            {paged.pageRows.map((b) => {
              const log = contacts.filter((c) => c.bookingId === b.id);
              return (
                <Card key={b.id} style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.title} numberOfLines={1}>
                        {b.customerName}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {b.id} · {b.vehicleName} · {b.vehicleNumber}
                      </Text>
                      <Text style={styles.sub}>{b.customerPhone}</Text>
                    </View>
                    <Badge label={`${lateDays(b)}d late`} tone="danger" />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <View>
                      <Text style={styles.kvLabel}>Was due</Text>
                      <Text style={styles.strong}>
                        {formatDate(b.returnDate, false)}, {b.returnTime}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.kvLabel}>Estimated late charge</Text>
                      <Text style={styles.strong}>{formatINR(lateCharge(b))}</Text>
                    </View>
                  </View>
                  {log[0] ? (
                    <Text style={styles.sub} numberOfLines={2}>
                      Last contact: {log[0].outcome} · {log[0].note} ({log[0].by}, {formatDate(log[0].date, false)})
                    </Text>
                  ) : (
                    <Text style={styles.sub}>No contact logged yet</Text>
                  )}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Button label="Log contact" size="sm" variant="outline" icon={(c) => <Phone size={14} color={c} />} onPress={() => openContact(b)} />
                    <Button label="Extend" size="sm" variant="outline" icon={(c) => <CalendarPlus size={14} color={c} />} onPress={() => openExtend(b)} />
                    <Button label="Return inspection" size="sm" icon={(c) => <LogIn size={14} color={c} />} onPress={() => router.push(`/bookings/${encodeURIComponent(b.id)}/inspection?type=Return`)} />
                    <Button label="Open booking" size="sm" variant="ghost" onPress={() => router.push(`/bookings/${encodeURIComponent(b.id)}`)} />
                  </View>
                </Card>
              );
            })}
          </Grid>
        )}
        <Pager paged={paged} />
      </Section>

      <FormSheet
        visible={!!contactFor}
        title={contactFor ? `Log contact · ${contactFor.customerName}` : ''}
        onClose={() => setContactFor(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setContactFor(null)} />
            <Button label="Save" onPress={submitContact} />
          </>
        }>
        <Text style={styles.label}>Outcome</Text>
        <View style={{ marginBottom: 14 }}>
          <ChipGroup options={OUTCOMES} value={outcome} onChange={setOutcome} />
        </View>
        <Field label="Note" required multiline value={note} onChangeText={setNote} error={errors.note} />
        <Field label="Contacted by" required value={by} onChangeText={setBy} error={errors.by} />
      </FormSheet>

      <FormSheet
        visible={!!extendFor}
        title={extendFor ? `Extend ${extendFor.id}` : ''}
        onClose={() => setExtendFor(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setExtendFor(null)} />
            <Button label="Continue" onPress={reviewExtend} />
          </>
        }>
        <Field
          label="Extra days"
          required
          keyboardType="number-pad"
          value={extraDays}
          onChangeText={(t) => {
            setExtraDays(t);
            setDaysError(undefined);
          }}
          hint="The rental amount is recalculated from the vehicle's rate."
          error={daysError}
        />
      </FormSheet>

      <ConfirmDialog
        visible={!!confirmExtend}
        title="Extend this rental?"
        message={confirmExtend ? `${confirmExtend.booking.id} for ${confirmExtend.booking.customerName} will run ${confirmExtend.days} more day${confirmExtend.days === 1 ? '' : 's'}, and the rental amount will be recalculated.` : undefined}
        confirmLabel="Extend rental"
        onConfirm={() => {
          if (confirmExtend) extendRental(confirmExtend.booking.id, confirmExtend.days);
          setConfirmExtend(null);
        }}
        onCancel={() => setConfirmExtend(null)}
      />
    </View>
  );
}
