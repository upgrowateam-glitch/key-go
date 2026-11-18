import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Clock, Play, Save, Workflow, Zap } from 'lucide-react-native';
import { Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, FormRow, Grid, IconButton, Section, SplitView, StatTile, ToggleRow } from '../../components/kit';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles } from '../../theme';
import { ruleRunsStore, scheduleStore, type DailySchedule } from '../../services/notifications';
import type { AutomationRule } from '../../types';
import { ListToolbar, Pager, useListControls, WithStore } from './listControls';
import { makeStyles } from './shared';

const TIMEZONES = ['Asia/Kolkata (IST)', 'Asia/Dubai (GST)', 'UTC'] as const;
const RULE_FILTERS = ['All', 'Active', 'Paused'] as const;
type RuleFilter = (typeof RULE_FILTERS)[number];

const nowLabel = () => `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

export default function AutomationTab() {
  const { automations } = useApp();
  const { cols } = useResponsive();
  const enabled = automations.filter((a) => a.enabled).length;

  return (
    <View>
      <Grid cols={cols(2, 2, 2)}>
        <StatTile label="Active rules" value={`${enabled}/${automations.length}`} tone="primary" icon={(c) => <Zap size={16} color={c} />} />
        <StatTile label="Paused rules" value={automations.length - enabled} tone="neutral" icon={(c) => <Workflow size={16} color={c} />} />
      </Grid>
      <SplitView
        main={<WithStore store={ruleRunsStore}>{(runs, setRuns) => <RulesSection runs={runs} setRuns={setRuns} />}</WithStore>}
        side={<WithStore store={scheduleStore}>{(schedule, save) => <ScheduleSection schedule={schedule} save={save} />}</WithStore>}
        sideWidth={380}
      />
    </View>
  );
}

// ---------------------------------------------------------------- rules

function RulesSection({ runs, setRuns }: { runs: Record<string, string>; setRuns: (runs: Record<string, string>) => void }) {
  const { automations, toggleAutomation, showToast } = useApp();
  const colors = useThemeColors();
  const { isPhone } = useResponsive();
  const [filter, setFilter] = useState<RuleFilter>('All');
  const [pending, setPending] = useState<AutomationRule | null>(null);

  const rows = useMemo(() => automations.filter((r) => filter === 'All' || (filter === 'Active') === r.enabled), [automations, filter]);
  const list = useListControls(rows, {
    search: (r) => `${r.name} ${r.description} ${r.trigger}`,
    sorts: {
      Default: () => 0,
      Name: (a, b) => a.name.localeCompare(b.name),
      'Active first': (a, b) => Number(b.enabled) - Number(a.enabled),
    },
  });

  const run = (r: AutomationRule) => {
    setRuns({ ...runs, [r.id]: nowLabel() });
    showToast(`"${r.name}" ran (simulated — nothing was executed)`);
  };

  return (
    <Section title="Automation rules" subtitle="Turn rules on or off and trigger a simulated run">
      <ListToolbar controls={list} placeholder="Search rules" filters={<ChipGroup options={RULE_FILTERS} value={filter} onChange={setFilter} />} />
      <Card>
        {list.total === 0 ? (
          <EmptyState title="No automation rules" message="No rules match this search or filter." compact />
        ) : (
          list.pageRows.map((r) => (
            <ToggleRow
              key={r.id}
              label={r.name}
              description={`${r.description}
Trigger: ${r.trigger} · Last run: ${runs[r.id] ?? r.lastRun ?? 'Never'}${r.enabled ? '' : ' · Paused'}`}
              value={r.enabled}
              onValueChange={() => setPending(r)}
              right={
                isPhone ? (
                  <IconButton label={`Run ${r.name} now`} icon={(c) => <Play size={14} color={r.enabled ? c : colors.muted} />} onPress={() => (r.enabled ? run(r) : showToast('Enable the rule to run it'))} />
                ) : (
                  <Button
                    label="Run now"
                    size="sm"
                    variant="outline"
                    disabled={!r.enabled}
                    accessibilityHint={r.enabled ? 'Simulates a run of this rule' : 'Enable the rule to run it'}
                    icon={(c) => <Play size={12} color={c} />}
                    onPress={() => run(r)}
                  />
                )
              }
            />
          ))
        )}
      </Card>
      <Pager controls={list} />
      <ConfirmDialog
        visible={!!pending}
        title={pending?.enabled ? `Pause "${pending.name}"?` : `Enable "${pending?.name}"?`}
        message={pending?.enabled ? 'This rule stops triggering until it is enabled again.' : 'This rule starts triggering on its next event. Nothing runs for real in the UI phase.'}
        confirmLabel={pending?.enabled ? 'Pause rule' : 'Enable rule'}
        danger={pending?.enabled}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) {
            toggleAutomation(pending.id);
            showToast(`${pending.name} ${pending.enabled ? 'paused' : 'enabled'}`);
          }
          setPending(null);
        }}
      />
    </Section>
  );
}

// ---------------------------------------------------------------- schedule

function ScheduleSection({ schedule, save: persist }: { schedule: DailySchedule; save: (s: DailySchedule) => void }) {
  const { showToast } = useApp();
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [time, setTime] = useState(schedule.time);
  const [email, setEmail] = useState(schedule.email);
  const [tz, setTz] = useState(schedule.timezone);
  const [weekly, setWeekly] = useState(schedule.weekly);
  const [touched, setTouched] = useState(false);

  const timeError = !/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim()) ? 'Use 24-hour HH:MM, e.g. 08:00' : undefined;
  const emailError = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Enter a valid email address' : undefined;

  const save = () => {
    setTouched(true);
    if (timeError || emailError) return;
    persist({ time: time.trim(), email: email.trim(), timezone: tz, weekly });
    showToast(`Daily report scheduled for ${time} ${tz.split(' ')[0]} (simulated)`);
  };

  return (
    <Section title="Schedule" subtitle="Daily report email">
      <Card>
        <FormRow>
          <Field
            label="Daily report time"
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            error={touched ? timeError : undefined}
            hint="24-hour format"
            left={<Clock size={16} color={colors.muted} />}
          />
          <Field label="Send to" value={email} onChangeText={setEmail} keyboardType="email-address" error={touched ? emailError : undefined} />
        </FormRow>
        <Text style={styles.sheetLabel}>Timezone</Text>
        <ChipGroup options={TIMEZONES as readonly string[]} value={tz} onChange={setTz} />
        <ToggleRow label="Weekly summary" description="Also send a Monday summary of the previous week" value={weekly} onValueChange={setWeekly} />
        <View style={{ marginTop: 12 }}>
          <Button label="Save schedule" icon={(c) => <Save size={14} color={c} />} onPress={save} fullWidth />
        </View>
      </Card>
    </Section>
  );
}
