import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, LogIn, LogOut, Phone, RotateCcw, Timer, UserCheck } from 'lucide-react-native';
import { Avatar, Button, Card, ChipGroup, ConfirmDialog, DataTable, Divider, EmptyState, Grid, KeyValueGrid, Section, SegmentedControl, SimulatedNote, StatTile, StatusBadge, type Column } from '../../components/kit';
import { ResourceState } from '../../components/portal/ResourceState';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { formatDate } from '../../lib/format';
import { useResource } from '../../services/mockClient';
import { fetchDutyRecords, type DutyRecord } from '../../services/people';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import type { AttendanceMark, StaffPunch } from '../../types';
import { CsvButton, FilterGroup, ListToolbar, Pager, SearchField, usePaged } from '../finance/tableTools';

/** September 2026: 30 days, 1 Sep is a Tuesday (Monday-first grid ⇒ 1 leading blank). */
const DAYS_IN_MONTH = 30;
const FIRST_WEEKDAY_OFFSET = 1;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TODAY_DAY = 26;

const MARK_LABEL: Record<AttendanceMark, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Leave',
  H: 'Half day',
  W: 'Weekly off',
};
const MARKS: AttendanceMark[] = ['P', 'A', 'L', 'H', 'W'];
const KINDS = ['All', 'Staff', 'Driver'] as const;

function markColors(colors: ThemeColors, m: AttendanceMark) {
  switch (m) {
    case 'P':
      return colors.status.available;
    case 'A':
      return colors.status.sold;
    case 'L':
      return colors.status.maintenance;
    case 'H':
      return colors.status.reserved;
    default:
      return colors.status.neutral;
  }
}

function summarise(s: StaffPunch) {
  const count = (m: AttendanceMark) => s.attendance.filter((x) => x === m).length;
  return { P: count('P'), A: count('A'), L: count('L'), H: count('H'), W: count('W') };
}

export default function AttendanceTab() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { cols, isPhone } = useResponsive();
  const { staffPunches, toggleDutyPunch, today } = useApp();
  const res = useResource(fetchDutyRecords);
  const [calendarStaff, setCalendarStaff] = useState<string>(staffPunches[0]?.id ?? '');
  const [punching, setPunching] = useState<StaffPunch | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All');

  const current = staffPunches.find((s) => s.id === calendarStaff) ?? staffPunches[0];

  const kpis = useMemo(
    () => ({
      punchedIn: staffPunches.filter((s) => s.status === 'Punched In').length,
      hours: staffPunches.reduce((s, x) => s + x.hoursThisMonth, 0),
      overtime: staffPunches.reduce((s, x) => s + x.overtimeHours, 0),
    }),
    [staffPunches]
  );

  // Today's row comes from the live punch state; history comes from the duty log.
  const duty = useMemo<DutyRecord[]>(() => {
    const live: DutyRecord[] = staffPunches.map((s) => ({
      id: `live-${s.id}`,
      personId: s.id,
      personName: s.staffName,
      kind: 'Staff',
      date: today,
      start: s.punchIn,
      end: s.status === 'Punched In' ? 'On duty' : (s.punchOut ?? '—'),
      hours: s.hoursWorked,
      overtime: 0,
    }));
    const q = query.trim().toLowerCase();
    return [...live, ...(res.data ?? [])]
      .filter((r) => kind === 'All' || r.kind === kind)
      .filter((r) => !q || `${r.personName} ${r.date} ${r.note ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || a.personName.localeCompare(b.personName));
  }, [staffPunches, res.data, today, kind, query]);
  const paged = usePaged(duty);
  const filtered = !!query.trim() || kind !== 'All';

  const attendanceColumns: Column<StaffPunch>[] = [
    { key: 'name', label: 'Staff', flex: 1.6, minWidth: 160, value: (s) => s.staffName },
    ...(['P', 'A', 'L', 'H'] as const).map<Column<StaffPunch>>((m) => ({
      key: m,
      label: MARK_LABEL[m],
      minWidth: 90,
      align: 'center',
      value: (s) => summarise(s)[m],
    })),
    { key: 'hours', label: 'Hours (Sep)', minWidth: 100, align: 'right', value: (s) => `${s.hoursThisMonth} h` },
    { key: 'ot', label: 'Overtime', minWidth: 90, align: 'right', value: (s) => `${s.overtimeHours} h` },
  ];

  const dutyColumns: Column<DutyRecord>[] = [
    { key: 'date', label: 'Date', minWidth: 110, flex: 0.8, value: (r) => formatDate(r.date) },
    { key: 'name', label: 'Person', minWidth: 150, flex: 1.2, value: (r) => r.personName },
    { key: 'kind', label: 'Type', minWidth: 80, flex: 0.6, value: (r) => r.kind },
    { key: 'start', label: 'In', minWidth: 90, flex: 0.7, value: (r) => r.start },
    { key: 'end', label: 'Out', minWidth: 90, flex: 0.7, value: (r) => r.end },
    { key: 'hours', label: 'Hours', minWidth: 80, flex: 0.6, align: 'right', value: (r) => `${r.hours} h` },
    { key: 'overtime', label: 'Overtime', minWidth: 90, flex: 0.6, align: 'right', value: (r) => (r.overtime ? `${r.overtime} h` : '—') },
    { key: 'note', label: 'Note', minWidth: 160, flex: 1.2, value: (r) => r.note ?? '' },
  ];

  const applyPunch = () => {
    if (punching) toggleDutyPunch(punching.id);
    setPunching(null);
  };

  return (
    <View>
      <SimulatedNote>Punch in/out uses this device&apos;s clock and is not synced anywhere.</SimulatedNote>

      <Grid cols={cols(2, 3, 3)} style={{ marginTop: 8 }}>
        <StatTile label="On duty now" value={kpis.punchedIn} hint={`of ${staffPunches.length} staff`} tone="success" icon={(c) => <UserCheck size={16} color={c} />} />
        <StatTile label="Hours this month" value={`${kpis.hours} h`} hint="All staff" tone="info" icon={(c) => <Timer size={16} color={c} />} />
        <StatTile label="Overtime" value={`${kpis.overtime} h`} hint="September" tone="warning" icon={(c) => <Clock size={16} color={c} />} />
      </Grid>

      <Section title="Team on shift" subtitle="Punch staff in and out of duty">
        {staffPunches.length === 0 ? (
          <Card>
            <EmptyState title="No staff yet" message="Staff profiles will appear here." />
          </Card>
        ) : (
          <Grid cols={cols(1, 2, 3)} gap={16}>
            {staffPunches.map((s) => (
              <StaffCard key={s.id} staff={s} onToggle={() => setPunching(s)} />
            ))}
          </Grid>
        )}
      </Section>

      <Section title="Attendance · September 2026" subtitle="Days 27–30 are upcoming">
        <View style={{ marginBottom: 12 }}>
          <ChipGroup
            options={staffPunches.map((s) => s.id)}
            labels={Object.fromEntries(staffPunches.map((s) => [s.id, s.staffName]))}
            value={current?.id ?? ''}
            onChange={setCalendarStaff}
            scroll={isPhone}
          />
        </View>
        {current ? (
          <Grid cols={cols(1, 1, 2)} gap={16}>
            <Card>
              <AttendanceCalendar staff={current} />
              <View style={styles.legend}>
                {MARKS.map((m) => {
                  const c = markColors(colors, m);
                  return (
                    <View key={m} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: c.bg, borderColor: c.border }]}>
                        <Text style={[styles.legendLetter, { color: c.text }]}>{m}</Text>
                      </View>
                      <Text style={styles.sub}>{MARK_LABEL[m]}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
            <Card>
              <Text style={styles.cardTitle}>{current.staffName}</Text>
              <Text style={styles.sub}>
                {current.role} · shift {current.shift}
              </Text>
              <Divider />
              <KeyValueGrid
                cols={2}
                items={(() => {
                  const sm = summarise(current);
                  return [
                    { label: 'Present', value: `${sm.P} days` },
                    { label: 'Absent', value: `${sm.A} days` },
                    { label: 'Leave', value: `${sm.L} days` },
                    { label: 'Half day', value: `${sm.H} days` },
                    { label: 'Weekly off', value: `${sm.W} days` },
                    { label: 'Working hours (Sep)', value: `${current.hoursThisMonth} h` },
                    { label: 'Overtime', value: `${current.overtimeHours} h` },
                    { label: 'Today', value: `${current.hoursWorked} h logged` },
                  ];
                })()}
              />
            </Card>
          </Grid>
        ) : (
          <Card>
            <EmptyState title="No staff selected" />
          </Card>
        )}
        <View style={{ marginTop: 4 }}>
          <DataTable columns={attendanceColumns} rows={staffPunches} rowKey={(s) => s.id} onRowPress={(s) => setCalendarStaff(s.id)} />
        </View>
      </Section>

      <Section title="Duty records" subtitle="Daily in and out times for staff and drivers">
        {res.error || (res.loading && !res.data) ? (
          <ResourceState loading={res.loading} error={res.error} onRetry={res.reload} />
        ) : (
          <View>
            <ListToolbar search={<SearchField value={query} onChange={setQuery} placeholder="Name, date or note" />}>
              <FilterGroup label="Type">
                <SegmentedControl options={KINDS} value={kind} onChange={setKind} />
              </FilterGroup>
              <CsvButton
                data={() => ({
                  filename: 'keygo-duty-records.csv',
                  headers: ['Date', 'Person', 'Type', 'In', 'Out', 'Hours', 'Overtime', 'Note'],
                  rows: duty.map((r) => [r.date, r.personName, r.kind, r.start, r.end, r.hours, r.overtime, r.note ?? '']),
                })}
              />
              {filtered ? (
                <Button
                  label="Reset"
                  variant="ghost"
                  size="sm"
                  icon={(c) => <RotateCcw size={14} color={c} />}
                  onPress={() => {
                    setQuery('');
                    setKind('All');
                  }}
                />
              ) : null}
            </ListToolbar>
            <DataTable columns={dutyColumns} rows={paged.pageRows} rowKey={(r) => r.id} empty={<EmptyState compact title="No duty records" message="Nothing matches these filters." />} />
            <Pager paged={paged} />
          </View>
        )}
      </Section>

      <ConfirmDialog
        visible={!!punching}
        title={punching?.status === 'Punched In' ? `Punch out ${punching.staffName}?` : `Punch in ${punching?.staffName ?? ''}?`}
        message={punching?.status === 'Punched In' ? "This ends the current shift using this device's clock." : "This starts a shift using this device's clock."}
        confirmLabel={punching?.status === 'Punched In' ? 'Punch out' : 'Punch in'}
        onConfirm={applyPunch}
        onCancel={() => setPunching(null)}
      />
    </View>
  );
}

function StaffCard({ staff: s, onToggle }: { staff: StaffPunch; onToggle: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const on = s.status === 'Punched In';
  return (
    <Card style={on ? { borderColor: colors.primaryBorder } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={s.staffName} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {s.staffName}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {s.role}
          </Text>
        </View>
        <StatusBadge status={s.status} />
      </View>
      <View style={{ marginTop: 12, gap: 6 }}>
        <View style={styles.infoRow}>
          <Phone size={13} color={colors.muted} />
          <Text style={styles.infoText}>{s.phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Clock size={13} color={colors.muted} />
          <Text style={styles.infoText}>Shift {s.shift}</Text>
        </View>
      </View>
      <View style={[styles.dutyBox, { backgroundColor: on ? colors.successGlow : colors.bg2 }]}>
        {on ? (
          <>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.dutyText, { color: colors.success }]}>On duty since {s.punchIn}</Text>
            </View>
            <Text style={styles.sub}>{s.hoursWorked} h logged today</Text>
          </>
        ) : (
          <>
            <Text style={styles.dutyText}>Off duty</Text>
            <Text style={styles.sub}>
              Last shift {s.punchIn}
              {s.punchOut ? ` – ${s.punchOut}` : ''} · {s.hoursWorked} h
            </Text>
          </>
        )}
      </View>
      <Button
        label={on ? 'Punch out' : 'Punch in'}
        variant={on ? 'outline' : 'primary'}
        fullWidth
        icon={(c) => (on ? <LogOut size={16} color={c} /> : <LogIn size={16} color={c} />)}
        onPress={onToggle}
        accessibilityHint={on ? `Punch ${s.staffName} out of duty` : `Punch ${s.staffName} in for duty`}
        style={{ marginTop: 12 }}
      />
    </Card>
  );
}

function AttendanceCalendar({ staff }: { staff: StaffPunch }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const cells: (number | null)[] = [...Array.from({ length: FIRST_WEEKDAY_OFFSET }, () => null), ...Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View accessibilityLabel={`Attendance calendar for ${staff.staffName}, September 2026`}>
      <View style={styles.calRow}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={styles.calCellWrap}>
            <Text style={styles.weekday}>{w}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.calRow, { flexWrap: 'wrap' }]}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`b-${i}`} style={styles.calCellWrap} />;
          const mark = staff.attendance[day - 1];
          const upcoming = day > TODAY_DAY || !mark;
          const c = mark && !upcoming ? markColors(colors, mark) : null;
          return (
            <View key={day} style={styles.calCellWrap}>
              <View
                accessibilityLabel={`${day} September: ${upcoming ? 'upcoming' : MARK_LABEL[mark]}`}
                style={[
                  styles.calCell,
                  c ? { backgroundColor: c.bg, borderColor: c.border } : { backgroundColor: colors.card, borderColor: colors.line, borderStyle: 'dashed' },
                  day === TODAY_DAY && { borderWidth: 2, borderColor: colors.primary },
                ]}>
                <Text style={[styles.calDay, c ? { color: c.text } : null]}>{day}</Text>
                <Text style={[styles.calMark, { color: c ? c.text : colors.muted }]}>{upcoming ? '–' : mark}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cardTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
    },
    sub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 1,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoText: {
      color: colors.txt,
      fontSize: 13,
    },
    dutyBox: {
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
    },
    liveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dutyText: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '800',
    },
    calRow: {
      flexDirection: 'row',
    },
    calCellWrap: {
      width: `${100 / 7}%`,
      padding: 3,
    },
    weekday: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 4,
    },
    calCell: {
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    calDay: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '600',
    },
    calMark: {
      fontSize: 14,
      fontWeight: '800',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 14,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendSwatch: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legendLetter: {
      fontSize: 11,
      fontWeight: '800',
    },
  });
