import { useRouter } from '@/shims/expo-router';
import { Camera, ClipboardList, Gauge, ListChecks, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Button, Card, CarDamageDiagram, ChipGroup, EmptyState, Grid, ProgressBar, Section, SegmentedControl, StatTile, Tone } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatKm } from '../../lib/format';
import { CHECKLIST_ITEMS, getChecklist } from '../../services/inspections';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { Booking, DamageMark, InspectionRecord, Vehicle } from '../../types';
import { FilterGroup, ListToolbar, Pager, usePaged } from '../agreements/listTools';
import { InspectionThumb } from './QueueTabs';

const VIEWS = ['All', 'Pickup', 'Return'] as const;
type ViewFilter = (typeof VIEWS)[number];
const SORTS = ['Newest', 'Oldest', 'Highest damage'] as const;
type Sort = (typeof SORTS)[number];

const SEVERITY_TONE: Record<DamageMark['severity'], Tone> = { Minor: 'highlight', Moderate: 'warning', Major: 'danger' };
const TYPE_TONE: Record<InspectionRecord['type'], Tone> = { Pickup: 'violet', Return: 'warning' };

function InspectionCard({ record: r, booking, vehicle }: { record: InspectionRecord; booking?: Booking; vehicle?: Vehicle }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const fuelTone: Tone = r.fuelPercent < 25 ? 'danger' : r.fuelPercent < 50 ? 'warning' : 'success';
  const marks = r.damageMarks ?? [];
  const checklist = getChecklist(r.id);
  const failed = checklist ? CHECKLIST_ITEMS.filter((i) => !checklist[i]) : [];
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={styles.cardTitle}>{r.id}</Text>
          <Badge label={`${r.type} inspection`} tone={TYPE_TONE[r.type]} />
        </View>
        <Text style={styles.sub}>
          {r.date.includes(' ') ? `${formatDate(r.date.split(' ')[0])} · ${r.date.split(' ').slice(1).join(' ')}` : formatDate(r.date)} · by {r.inspectorName}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <InspectionThumb vehicle={vehicle} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.strong} numberOfLines={1}>
                {vehicle?.name ?? booking?.vehicleName ?? r.vehicleNumber}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {r.vehicleNumber}
              </Text>
              <TouchableOpacity accessibilityRole="link" accessibilityLabel={`Open booking ${r.bookingId}`} onPress={() => router.push(`/bookings/${encodeURIComponent(r.bookingId)}`)}>
                <Text style={styles.link} numberOfLines={1}>
                  Booking {r.bookingId}
                  {booking ? ` · ${booking.customerName}` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.kvLabel}>Fuel level</Text>
              <Text style={styles.strong}>{r.fuelPercent}%</Text>
            </View>
            <ProgressBar value={r.fuelPercent / 100} tone={fuelTone} />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <Gauge size={14} color={colors.muted} />
              <Text style={styles.metaText}>{formatKm(r.odometerKm)}</Text>
            </View>
            <View style={styles.meta}>
              <Camera size={14} color={colors.muted} />
              <Text style={styles.metaText}>
                {r.photosCaptured.length} photo{r.photosCaptured.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.meta}>
              <Wrench size={14} color={colors.muted} />
              <Text style={styles.metaText}>{marks.length ? `${marks.length} damage${marks.length > 1 ? 's' : ''}` : 'No damage'}</Text>
            </View>
            {checklist ? (
              <View style={styles.meta}>
                <ListChecks size={14} color={colors.muted} />
                <Text style={styles.metaText}>{failed.length ? `${failed.length} checklist issue${failed.length > 1 ? 's' : ''}` : 'Checklist OK'}</Text>
              </View>
            ) : null}
          </View>

          {marks.length ? (
            <View style={{ gap: 6 }}>
              {marks.map((m) => (
                <View key={m.id} style={styles.damageRow}>
                  <Badge label={m.severity} tone={SEVERITY_TONE[m.severity]} />
                  <Text style={[styles.metaText, { flex: 1 }]} numberOfLines={2}>
                    {m.zone} — {m.kind}
                  </Text>
                  <Text style={styles.strong}>{m.estimatedCost ? formatINR(m.estimatedCost) : '—'}</Text>
                </View>
              ))}
            </View>
          ) : r.damagesMarked.length ? (
            <Text style={styles.metaText}>{r.damagesMarked.join(', ')}</Text>
          ) : null}

          <View style={styles.costRow}>
            <Text style={styles.kvLabel}>Estimated damage cost</Text>
            <Text style={[styles.strong, r.estimatedDamageCost > 0 && { color: colors.danger }]}>{r.estimatedDamageCost > 0 ? formatINR(r.estimatedDamageCost) : 'None'}</Text>
          </View>
          {r.notes ? <Text style={styles.notes}>“{r.notes}”</Text> : null}
          <Button label="Open full report" size="sm" variant="outline" onPress={() => router.push(`/bookings/${encodeURIComponent(r.bookingId)}/inspection?type=${r.type}`)} />
        </View>

        {isDesktop ? (
          <View style={styles.diagramWrap}>
            <CarDamageDiagram marks={marks} width={140} readOnly />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export default function InspectionHistoryTab() {
  const { cols, isPhone } = useResponsive();
  const { bookings, inspections, vehicles, today } = useApp();

  const [view, setView] = useState<ViewFilter>('All');
  const [sort, setSort] = useState<Sort>('Newest');
  const [query, setQuery] = useState('');

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const vehicleByNumber = useMemo(() => new Map(vehicles.map((v) => [v.vehicleNumber, v])), [vehicles]);
  const bookingById = useMemo(() => new Map(bookings.map((b) => [b.id, b])), [bookings]);

  const history = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inspections
      .filter((r) => view === 'All' || r.type === view)
      .filter((r) => {
        if (!q) return true;
        const b = bookingById.get(r.bookingId);
        return [r.id, r.bookingId, r.vehicleNumber, r.inspectorName, b?.customerName ?? '', b?.vehicleName ?? ''].some((s) => s.toLowerCase().includes(q));
      })
      .sort((a, b) => (sort === 'Highest damage' ? b.estimatedDamageCost - a.estimatedDamageCost : sort === 'Oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  }, [inspections, view, query, sort, bookingById]);
  const paged = usePaged(history, `${view}|${sort}|${query}`, 6);

  const month = today.slice(0, 7);
  const thisMonth = inspections.filter((r) => r.date.startsWith(month)).length;
  const damageTotal = inspections.filter((r) => r.type === 'Return').reduce((s, r) => s + r.estimatedDamageCost, 0);

  const filtersActive = view !== 'All' || !!query || sort !== 'Newest';
  const reset = () => {
    setView('All');
    setSort('Newest');
    setQuery('');
  };

  return (
    <View>
      <Grid cols={cols(2, 3, 3)}>
        <StatTile label="Inspections on record" value={inspections.length} emphasis icon={(c) => <ClipboardList size={16} color={c} />} />
        <StatTile label="This month" value={thisMonth} tone="info" icon={(c) => <ClipboardList size={16} color={c} />} />
        <StatTile label="Damage recorded" value={formatINR(damageTotal)} hint="From return inspections" tone="danger" icon={(c) => <Wrench size={16} color={c} />} />
      </Grid>
      <Section title="Inspection history" subtitle={`${history.length} ${view === 'All' ? '' : `${view.toLowerCase()} `}report${history.length === 1 ? '' : 's'}`}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Inspection, booking, vehicle, customer or inspector" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Type">
            <SegmentedControl options={VIEWS} value={view} onChange={setView} labels={{ All: 'All inspections' }} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        {history.length === 0 ? (
          <Card>
            <EmptyState
              title={inspections.length === 0 ? 'No inspections yet' : 'No inspections match'}
              message={inspections.length === 0 ? 'Inspection reports appear here after pickup and return checks.' : 'Try another search or switch the view.'}
              icon={(c) => <ClipboardList size={22} color={c} />}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          </Card>
        ) : (
          <Grid cols={cols(1, 2, 2)}>
            {paged.pageRows.map((r) => {
              const b = bookingById.get(r.bookingId);
              const v = (b && vehicleById.get(b.vehicleId)) ?? vehicleByNumber.get(r.vehicleNumber);
              return <InspectionCard key={r.id} record={r} booking={b} vehicle={v} />;
            })}
          </Grid>
        )}
        <Pager paged={paged} />
      </Section>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strong: { color: colors.txt, fontSize: 13, fontWeight: '700' },
    sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    cardTitle: { color: colors.txt, fontSize: 15, fontWeight: '800' },
    kvLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    link: { color: colors.primaryText, fontSize: 12, fontWeight: '700', marginTop: 2 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { color: colors.txt, fontSize: 12 },
    damageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    costRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.bg,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    notes: { color: colors.muted, fontSize: 12, fontStyle: 'italic', lineHeight: 17 },
    diagramWrap: {
      width: 156,
      alignItems: 'center',
      justifyContent: 'flex-start',
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingVertical: 8,
    },
  });
