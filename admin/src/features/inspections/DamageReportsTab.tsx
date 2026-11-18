import { useRouter } from '@/shims/expo-router';
import { AlertTriangle, CheckCircle2, IndianRupee, Plus, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
    Badge,
    Button,
    Card,
    CarDamageDiagram,
    ChipGroup,
    Column,
    ConfirmDialog,
    DataTable,
    DonutChart,
    EmptyState,
    Field,
    FormRow,
    FormSheet,
    Grid,
    HBarChart,
    KeyValueGrid,
    Section,
    SegmentedControl,
    StatTile,
    Tone,
} from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate, formatINR, formatINRCompact } from '../../lib/format';
import { addManualDamage, DAMAGE_STATUSES, DamageEstimate, DamageStatus, loadDamage, SUGGESTED_COST, updateDamage } from '../../services/inspections';
import { useResource } from '../../services/mockClient';
import type { CarZone, DamageMark } from '../../types';
import { FilterGroup, ListToolbar, Pager, parseAmount, useCommonStyles, usePaged } from '../agreements/listTools';

const KINDS = ['Scratch', 'Dent', 'Crack', 'Paint chip'] as const;
const SEVERITIES = ['Minor', 'Moderate', 'Major'] as const;
const STATUS_FILTERS = ['All', ...DAMAGE_STATUSES] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
const SOURCE_FILTERS = ['All', 'Return', 'Pickup', 'Manual'] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];
const SORTS = ['Newest', 'Highest cost', 'Severity'] as const;
type Sort = (typeof SORTS)[number];

const SEVERITY_TONE: Record<DamageMark['severity'], Tone> = { Minor: 'highlight', Moderate: 'warning', Major: 'danger' };
const STATUS_TONE: Record<DamageStatus, Tone> = { Reported: 'warning', Estimated: 'info', 'In repair': 'violet', Repaired: 'success', Charged: 'primary', Waived: 'neutral' };
const SEVERITY_RANK: Record<DamageMark['severity'], number> = { Major: 0, Moderate: 1, Minor: 2 };

interface DamageRow extends DamageEstimate {
  key: string;
  source: Exclude<SourceFilter, 'All'>;
  inspectionId?: string;
  bookingId?: string;
  vehicleName: string;
  vehicleNumber: string;
  customerName?: string;
  zone: CarZone;
  kind: DamageMark['kind'];
  severity: DamageMark['severity'];
  date: string;
  by: string;
  notes?: string;
  status: DamageStatus;
  cost: number;
}

interface ReportForm {
  vehicleId: string;
  zone?: CarZone;
  kind: DamageMark['kind'];
  severity: DamageMark['severity'];
  parts: string;
  labour: string;
  paint: string;
  reportedBy: string;
  notes: string;
}
interface EstimateForm {
  parts: string;
  labour: string;
  paint: string;
}
type Errors = Record<string, string | undefined>;

const toNumber = (s: string) => {
  const n = parseAmount(s);
  return Number.isNaN(n) ? 0 : Math.round(n);
};

export default function DamageReportsTab() {
  const styles = useCommonStyles();
  const router = useRouter();
  const { cols, isPhone } = useResponsive();
  const { inspections, bookings, vehicles, showToast } = useApp();
  const res = useResource(loadDamage);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [source, setSource] = useState<SourceFilter>('All');
  const [sort, setSort] = useState<Sort>('Newest');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateForm>({ parts: '', labour: '', paint: '' });
  const [report, setReport] = useState<ReportForm | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [statusChange, setStatusChange] = useState<{ row: DamageRow; to: DamageStatus } | null>(null);

  const fleet = useMemo(() => vehicles.filter((v) => v.status !== 'Sold'), [vehicles]);
  const data = res.data;

  const rows = useMemo<DamageRow[]>(() => {
    if (!data) return [];
    const fromInspections = inspections.flatMap((r) =>
      r.damageMarks.map((m): DamageRow => {
        const key = `${r.id}:${m.id}`;
        const o = data.overlays[key];
        const b = bookings.find((x) => x.id === r.bookingId);
        const parts = o?.parts ?? m.estimatedCost;
        const labour = o?.labour ?? 0;
        const paint = o?.paint ?? 0;
        return {
          key,
          source: r.type,
          inspectionId: r.id,
          bookingId: r.bookingId,
          vehicleName: b?.vehicleName ?? r.vehicleNumber,
          vehicleNumber: r.vehicleNumber,
          customerName: b?.customerName,
          zone: m.zone,
          kind: m.kind,
          severity: m.severity,
          date: r.date.slice(0, 10),
          by: r.inspectorName,
          notes: r.notes,
          status: o?.status ?? 'Reported',
          parts,
          labour,
          paint,
          cost: parts + labour + paint,
        };
      })
    );
    const fromManual = data.manual.map((m): DamageRow => {
      const v = vehicles.find((x) => x.id === m.vehicleId);
      return {
        key: m.id,
        source: 'Manual',
        vehicleName: v?.name ?? m.vehicleId,
        vehicleNumber: v?.vehicleNumber ?? '',
        zone: m.zone,
        kind: m.kind,
        severity: m.severity,
        date: m.reportedOn,
        by: m.reportedBy,
        notes: m.notes,
        status: m.status,
        parts: m.parts,
        labour: m.labour,
        paint: m.paint,
        cost: m.parts + m.labour + m.paint,
      };
    });
    return [...fromManual, ...fromInspections];
  }, [data, inspections, bookings, vehicles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (status === 'All' || r.status === status) &&
          (source === 'All' || r.source === source) &&
          (!q || [r.key, r.vehicleName, r.vehicleNumber, r.customerName ?? '', r.bookingId ?? '', r.zone, r.kind].some((s) => s.toLowerCase().includes(q)))
      )
      .sort((a, b) => (sort === 'Highest cost' ? b.cost - a.cost : sort === 'Severity' ? SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] : b.date.localeCompare(a.date)));
  }, [rows, status, source, query, sort]);
  const paged = usePaged(filtered, `${status}|${source}|${sort}|${query}`);

  if (res.error || (res.loading && !res.data)) return <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />;
  if (!data) return null;

  const fail = (e: Error) => showToast(e.message);
  const filtersActive = !!query || status !== 'All' || source !== 'All' || sort !== 'Newest';
  const reset = () => {
    setQuery('');
    setStatus('All');
    setSource('All');
    setSort('Newest');
  };
  // Pickup marks are pre-existing, so they never count towards what is owed.
  const live = rows.filter((r) => r.source !== 'Pickup' && r.status !== 'Waived');
  const open = live.filter((r) => r.status !== 'Repaired' && r.status !== 'Charged');
  const totalCost = live.reduce((s, r) => s + r.cost, 0);
  const openCost = open.reduce((s, r) => s + r.cost, 0);

  const byVehicle = [...live.reduce((m, r) => m.set(r.vehicleNumber, { label: r.vehicleName, sublabel: r.vehicleNumber, value: (m.get(r.vehicleNumber)?.value ?? 0) + r.cost }), new Map<string, { label: string; sublabel: string; value: number }>()).values()]
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  const bySeverity = SEVERITIES.map((s) => ({ label: s, value: live.filter((r) => r.severity === s).reduce((t, r) => t + r.cost, 0) })).filter((i) => i.value > 0);

  const selected = rows.find((r) => r.key === openKey);
  const openRow = (r: DamageRow) => {
    setErrors({});
    setEstimate({ parts: String(r.parts), labour: String(r.labour), paint: String(r.paint) });
    setOpenKey(r.key);
  };
  const estimateTotal = toNumber(estimate.parts) + toNumber(estimate.labour) + toNumber(estimate.paint);
  const saveEstimate = () => {
    if (!selected) return;
    const next: DamageOverlayPatch = { parts: toNumber(estimate.parts), labour: toNumber(estimate.labour), paint: toNumber(estimate.paint) };
    if (selected.status === 'Reported' && estimateTotal > 0) next.status = 'Estimated';
    updateDamage(selected.key, next).then((d) => {
      res.setData(d);
      setOpenKey(null);
      showToast('Repair estimate saved');
    }, fail);
  };
  const applyStatus = () => {
    if (!statusChange) return;
    const { row, to } = statusChange;
    updateDamage(row.key, { status: to }).then((d) => {
      res.setData(d);
      showToast(`${row.zone} marked ${to.toLowerCase()}`);
    }, fail);
    setStatusChange(null);
  };

  const openReport = () => {
    setErrors({});
    setReport({ vehicleId: fleet[0]?.id ?? '', kind: 'Scratch', severity: 'Minor', parts: String(SUGGESTED_COST.Minor), labour: '', paint: '', reportedBy: '', notes: '' });
  };
  const submitReport = () => {
    if (!report) return;
    const e: Errors = {};
    if (!report.vehicleId) e.vehicleId = 'Select a vehicle';
    if (!report.zone) e.zone = 'Tap the damaged panel on the diagram';
    if (report.reportedBy.trim().length < 2) e.reportedBy = 'Enter who found the damage';
    setErrors(e);
    if (Object.keys(e).length || !report.zone) return;
    addManualDamage({
      vehicleId: report.vehicleId,
      zone: report.zone,
      kind: report.kind,
      severity: report.severity,
      parts: toNumber(report.parts),
      labour: toNumber(report.labour),
      paint: toNumber(report.paint),
      reportedBy: report.reportedBy.trim(),
      notes: report.notes.trim() || undefined,
    }).then((d) => {
      res.setData(d);
      setReport(null);
      showToast('Damage report added');
    }, fail);
  };

  const columns: Column<DamageRow>[] = [
    { key: 'date', label: 'Date', flex: 0.8, minWidth: 100, value: (r) => formatDate(r.date) },
    {
      key: 'vehicle',
      label: 'Vehicle',
      flex: 1.3,
      minWidth: 150,
      render: (r) => (
        <View>
          <Text style={styles.strong} numberOfLines={1}>
            {r.vehicleName}
          </Text>
          <Text style={styles.sub}>{r.vehicleNumber}</Text>
        </View>
      ),
    },
    {
      key: 'damage',
      label: 'Damage',
      flex: 1.4,
      minWidth: 160,
      render: (r) => (
        <View>
          <Text style={styles.body} numberOfLines={1}>
            {r.zone}
          </Text>
          <Text style={styles.sub}>{r.kind}</Text>
        </View>
      ),
    },
    { key: 'severity', label: 'Severity', flex: 0.7, minWidth: 90, render: (r) => <Badge label={r.severity} tone={SEVERITY_TONE[r.severity]} /> },
    { key: 'source', label: 'Source', flex: 0.8, minWidth: 100, value: (r) => (r.source === 'Manual' ? r.key : r.inspectionId ?? r.source) },
    { key: 'cost', label: 'Cost', flex: 0.7, minWidth: 90, align: 'right', value: (r) => (r.cost ? formatINR(r.cost) : '—') },
    { key: 'status', label: 'Status', flex: 0.8, minWidth: 100, render: (r) => <Badge label={r.status} tone={STATUS_TONE[r.status]} /> },
  ];

  return (
    <View>
      <Grid cols={cols(2, 4, 4)}>
        <StatTile label="Open damage" value={open.length} hint="Not repaired or charged" emphasis icon={(c) => <AlertTriangle size={16} color={c} />} />
        <StatTile label="Open repair cost" value={formatINRCompact(openCost)} tone="warning" icon={(c) => <Wrench size={16} color={c} />} />
        <StatTile label="Total damage cost" value={formatINRCompact(totalCost)} tone="danger" hint="Excludes pickup and waived" icon={(c) => <IndianRupee size={16} color={c} />} />
        <StatTile label="Closed" value={rows.filter((r) => r.status === 'Repaired' || r.status === 'Charged').length} tone="success" icon={(c) => <CheckCircle2 size={16} color={c} />} />
      </Grid>

      <Section
        title="Damage reports"
        subtitle="From inspections and manual reports. Tap a report to estimate cost or change status."
        action={<Button label="Report damage" size="sm" icon={(c) => <Plus size={14} color={c} />} disabled={!fleet.length} onPress={openReport} />}>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Vehicle, customer, booking, panel or type" onReset={filtersActive ? reset : undefined}>
          <FilterGroup label="Status">
            <ChipGroup options={STATUS_FILTERS} value={status} onChange={setStatus} scroll={isPhone} />
          </FilterGroup>
          <FilterGroup label="Source">
            <SegmentedControl options={SOURCE_FILTERS} value={source} onChange={setSource} />
          </FilterGroup>
          <FilterGroup label="Sort by">
            <ChipGroup options={SORTS} value={sort} onChange={setSort} scroll={isPhone} />
          </FilterGroup>
        </ListToolbar>
        <DataTable
          columns={columns}
          rows={paged.pageRows}
          rowKey={(r) => r.key}
          onRowPress={openRow}
          empty={
            <EmptyState
              compact
              title={rows.length ? 'No damage reports match' : 'No damage reported'}
              message={rows.length ? 'Try another search or filter.' : 'Damage marked during inspections appears here.'}
              icon={(c) => <Wrench size={22} color={c} />}
              action={filtersActive ? <Button label="Reset filters" variant="outline" size="sm" onPress={reset} /> : undefined}
            />
          }
        />
        <Pager paged={paged} />
      </Section>

      <Section title="Damage cost" subtitle="Return and manual reports, excluding waived">
        <Grid cols={cols(1, 2, 2)}>
          <Card>
            <Text style={styles.chartTitle}>By vehicle</Text>
            {byVehicle.length ? <HBarChart items={byVehicle} formatValue={formatINRCompact} /> : <EmptyState compact title="No costs yet" />}
          </Card>
          <Card>
            <Text style={styles.chartTitle}>By severity</Text>
            {bySeverity.length ? <DonutChart items={bySeverity} centerValue={formatINRCompact(totalCost)} centerLabel="total" formatValue={formatINRCompact} /> : <EmptyState compact title="No costs yet" />}
          </Card>
        </Grid>
      </Section>

      <FormSheet
        visible={!!selected}
        title={selected ? `${selected.zone} · ${selected.kind}` : ''}
        onClose={() => setOpenKey(null)}
        footer={
          <>
            <Button label="Close" variant="outline" onPress={() => setOpenKey(null)} />
            <Button label="Save estimate" onPress={saveEstimate} />
          </>
        }>
        {selected ? (
          <>
            <KeyValueGrid
              cols={2}
              items={[
                { label: 'Vehicle', value: `${selected.vehicleName} · ${selected.vehicleNumber}` },
                { label: 'Reported', value: `${formatDate(selected.date)} by ${selected.by}` },
                { label: 'Severity', value: <Badge label={selected.severity} tone={SEVERITY_TONE[selected.severity]} /> },
                { label: 'Status', value: <Badge label={selected.status} tone={STATUS_TONE[selected.status]} /> },
              ]}
            />
            {selected.source === 'Pickup' ? <Text style={[styles.sub, { marginBottom: 12 }]}>Pre-existing at pickup, so it is not charged to this customer.</Text> : null}
            {selected.bookingId ? <Button label={`Open booking ${selected.bookingId}`} size="sm" variant="ghost" onPress={() => router.push(`/bookings/${encodeURIComponent(selected.bookingId!)}`)} /> : null}
            {selected.notes ? <Text style={[styles.body, { marginVertical: 8 }]}>{selected.notes}</Text> : null}
            <CarDamageDiagram marks={[{ id: selected.key, zone: selected.zone, kind: selected.kind, severity: selected.severity, estimatedCost: selected.cost }]} width={150} readOnly />
            <Text style={[styles.label, { marginTop: 14 }]}>Cost calculation</Text>
            <FormRow cols={3}>
              <Field label="Parts (₹)" keyboardType="number-pad" value={estimate.parts} onChangeText={(parts) => setEstimate({ ...estimate, parts })} />
              <Field label="Labour (₹)" keyboardType="number-pad" value={estimate.labour} onChangeText={(labour) => setEstimate({ ...estimate, labour })} />
              <Field label="Paint (₹)" keyboardType="number-pad" value={estimate.paint} onChangeText={(paint) => setEstimate({ ...estimate, paint })} />
            </FormRow>
            <Text style={styles.cardTitle}>Total {formatINR(estimateTotal)}</Text>
            <Text style={styles.sub}>Suggested for {selected.severity.toLowerCase()} damage: {formatINR(SUGGESTED_COST[selected.severity])}</Text>
            <Text style={[styles.label, { marginTop: 14 }]}>Change status</Text>
            <ChipGroup
              options={DAMAGE_STATUSES}
              value={selected.status}
              onChange={(to) => {
                if (to === selected.status) return;
                setStatusChange({ row: selected, to });
                setOpenKey(null);
              }}
            />
          </>
        ) : null}
      </FormSheet>

      <FormSheet
        visible={!!report}
        title="Report damage"
        onClose={() => setReport(null)}
        footer={
          <>
            <Button label="Cancel" variant="outline" onPress={() => setReport(null)} />
            <Button label="Save report" onPress={submitReport} />
          </>
        }>
        {report ? (
          <>
            <Text style={styles.label}>Vehicle</Text>
            <View style={{ marginBottom: 14 }}>
              <ChipGroup
                options={fleet.map((v) => v.id)}
                value={report.vehicleId}
                onChange={(vehicleId) => setReport({ ...report, vehicleId })}
                labels={Object.fromEntries(fleet.map((v) => [v.id, `${v.name} · ${v.vehicleNumber}`]))}
                scroll
              />
              {errors.vehicleId ? <Text style={styles.error}>{errors.vehicleId}</Text> : null}
            </View>
            <Text style={styles.label}>Mark the panel{report.zone ? `: ${report.zone}` : ''}</Text>
            <CarDamageDiagram
              marks={report.zone ? [{ id: 'new', zone: report.zone, kind: report.kind, severity: report.severity, estimatedCost: 0 }] : []}
              onZonePress={(zone) => {
                setReport({ ...report, zone });
                setErrors({ ...errors, zone: undefined });
              }}
              width={170}
            />
            {errors.zone ? <Text style={styles.error}>{errors.zone}</Text> : null}
            <Text style={[styles.label, { marginTop: 14 }]}>Type</Text>
            <ChipGroup options={KINDS} value={report.kind} onChange={(kind) => setReport({ ...report, kind })} />
            <Text style={[styles.label, { marginTop: 14 }]}>Severity</Text>
            <SegmentedControl options={SEVERITIES} value={report.severity} onChange={(severity) => setReport({ ...report, severity, parts: String(SUGGESTED_COST[severity]) })} style={{ marginBottom: 14 }} />
            <FormRow cols={3}>
              <Field label="Parts (₹)" keyboardType="number-pad" value={report.parts} onChangeText={(parts) => setReport({ ...report, parts })} />
              <Field label="Labour (₹)" keyboardType="number-pad" value={report.labour} onChangeText={(labour) => setReport({ ...report, labour })} />
              <Field label="Paint (₹)" keyboardType="number-pad" value={report.paint} onChangeText={(paint) => setReport({ ...report, paint })} />
            </FormRow>
            <Text style={[styles.strong, { marginBottom: 14 }]}>Total {formatINR(toNumber(report.parts) + toNumber(report.labour) + toNumber(report.paint))}</Text>
            <Field label="Reported by" required value={report.reportedBy} onChangeText={(reportedBy) => setReport({ ...report, reportedBy })} error={errors.reportedBy} />
            <Field label="Notes" multiline value={report.notes} onChangeText={(notes) => setReport({ ...report, notes })} />
          </>
        ) : null}
      </FormSheet>

      <ConfirmDialog
        visible={!!statusChange}
        title={statusChange ? `Mark as ${statusChange.to.toLowerCase()}?` : ''}
        message={statusChange ? `${statusChange.row.zone} on ${statusChange.row.vehicleName} (${statusChange.row.vehicleNumber}), ${formatINR(statusChange.row.cost)}.` : undefined}
        confirmLabel={statusChange ? `Mark ${statusChange.to.toLowerCase()}` : 'Confirm'}
        onConfirm={applyStatus}
        onCancel={() => setStatusChange(null)}
      />
    </View>
  );
}

type DamageOverlayPatch = Partial<DamageEstimate> & { status?: DamageStatus };
