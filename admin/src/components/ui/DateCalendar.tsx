'use client';

import React, { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '../../theme';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const YEARS_PER_PAGE = 12;

export type Ymd = { y: number; m: number; d: number };

const pad = (n: number) => String(n).padStart(2, '0');
export const ymdToText = ({ y, m, d }: Ymd) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const key = (a: Ymd) => a.y * 10000 + a.m * 100 + a.d;
const same = (a: Ymd | null | undefined, b: Ymd) => !!a && key(a) === key(b);
const monthKey = (y: number, m: number) => y * 12 + m;

/** Reads "YYYY-MM-DD" (only real dates). */
export function textToYmd(text: string | undefined): Ymd | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec((text ?? '').trim());
  if (!hit) return null;
  const y = +hit[1];
  const m = +hit[2] - 1;
  const d = +hit[3];
  return m >= 0 && m < 12 && d >= 1 && d <= daysIn(y, m) ? { y, m, d } : null;
}

export const todayYmd = (): Ymd => {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
};

export const addDaysYmd = (a: Ymd, days: number): Ymd => {
  const n = new Date(a.y, a.m, a.d + days);
  return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
};

/** "16 January 2026" */
export const longDate = (a: Ymd) => `${a.d} ${MONTHS[a.m]} ${a.y}`;

type Palette = {
  panel: string;
  panelBorder: string;
  tabsBg: string;
  tabOn: string;
  tabOnText: string;
  tabOffText: string;
  arrow: string;
  title: string;
  weekday: string;
  cell: string;
  cellBorder: string;
  cellText: string;
  outside: string;
  pick: string;
  pickText: string;
  range: string;
  rangeText: string;
  divider: string;
  big: string;
  sub: string;
  link: string;
};

/** "glass": white see-through on a dark picture (sign-up). "light": a frosted white card on the app's light pages. */
export function useCalendarPalette(look: 'glass' | 'light'): Palette {
  const c = useThemeColors();
  if (look === 'glass') {
    return {
      panel: 'rgba(255,255,255,0.10)',
      panelBorder: 'rgba(255,255,255,0.30)',
      tabsBg: 'rgba(255,255,255,0.10)',
      tabOn: 'rgba(255,255,255,0.92)',
      tabOnText: '#0B3A2C',
      tabOffText: 'rgba(255,255,255,0.78)',
      arrow: '#FFBA00',
      title: '#FFFFFF',
      weekday: 'rgba(255,255,255,0.55)',
      cell: 'rgba(255,255,255,0.14)',
      cellBorder: 'rgba(255,255,255,0.12)',
      cellText: '#FFFFFF',
      outside: 'rgba(255,255,255,0.05)',
      pick: '#FFBA00',
      pickText: '#1F2421',
      range: 'rgba(255,186,0,0.28)',
      rangeText: '#FFFFFF',
      divider: 'rgba(255,255,255,0.16)',
      big: '#FFFFFF',
      sub: 'rgba(255,255,255,0.78)',
      link: '#FFBA00',
    };
  }
  return {
    panel: c.card,
    panelBorder: c.line,
    tabsBg: c.bg2,
    tabOn: c.card,
    tabOnText: c.primaryText,
    tabOffText: c.muted,
    arrow: c.primaryText,
    title: c.txt,
    weekday: c.muted,
    cell: c.bg,
    cellBorder: c.line,
    cellText: c.txt,
    outside: 'transparent',
    pick: c.highlight,
    pickText: c.onHighlight,
    range: c.highlightSoft,
    rangeText: c.txt,
    divider: c.line,
    big: c.txt,
    sub: c.muted,
    link: c.primaryText,
  };
}

/**
 * The KeyGo calendar (same look everywhere): Month and Year tabs, a month of day squares (Monday first), the picked
 * day shown large ("16 Wednesday / October, 2026"), and Confirm / Cancel. Days outside `min`…`max` can't be picked.
 * `rangeFrom` lightly marks the days from that date up to the picked one (a trip's length).
 */
export function DateCalendar({
  look,
  value,
  min,
  max,
  rangeFrom,
  startOn,
  startTab = 'month',
  emptyText = 'Pick a day.',
  confirmLabel = 'Confirm date',
  onConfirm,
  onCancel,
}: {
  look: 'glass' | 'light';
  value: string;
  min?: Ymd;
  max?: Ymd;
  rangeFrom?: Ymd | null;
  /** Month shown first when nothing is picked yet. */
  startOn?: Ymd;
  startTab?: 'month' | 'year';
  emptyText?: string;
  confirmLabel?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}) {
  const p = useCalendarPalette(look);
  const current = textToYmd(value);
  const first = current ?? startOn ?? min ?? todayYmd();
  const [tab, setTab] = useState<'month' | 'year'>(current ? 'month' : startTab);
  const [picked, setPicked] = useState<Ymd | null>(current);
  const [shown, setShown] = useState({ y: first.y, m: first.m });
  const [yearPage, setYearPage] = useState(first.y);

  const allowed = (a: Ymd) => (!min || key(a) >= key(min)) && (!max || key(a) <= key(max));
  const canPrevMonth = !min || monthKey(shown.y, shown.m) > monthKey(min.y, min.m);
  const canNextMonth = !max || monthKey(shown.y, shown.m) < monthKey(max.y, max.m);
  const moveMonth = (step: number) =>
    setShown(({ y, m }) => {
      const next = new Date(y, m + step, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  // month view: last days of the previous month (faded), this month, first days of the next (faded)
  const lead = (new Date(shown.y, shown.m, 1).getDay() + 6) % 7;
  const prevDays = daysIn(shown.y, shown.m - 1 < 0 ? 11 : shown.m - 1);
  const cells: { label: number; day?: Ymd }[] = [];
  for (let i = lead; i > 0; i--) cells.push({ label: prevDays - i + 1 });
  for (let d = 1; d <= daysIn(shown.y, shown.m); d++) cells.push({ label: d, day: { y: shown.y, m: shown.m, d } });
  while (cells.length % 7) cells.push({ label: cells.length - lead - daysIn(shown.y, shown.m) + 1 });

  const firstYear = yearPage - (yearPage % YEARS_PER_PAGE);
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => firstYear + i);
  const yearOk = (y: number) => (!min || y >= min.y) && (!max || y <= max.y);

  const inRange = (a: Ymd) => !!rangeFrom && !!picked && key(a) > key(rangeFrom) && key(a) < key(picked);

  return (
    <View style={{ padding: 14, borderRadius: 18, backgroundColor: p.panel, borderWidth: 1, borderColor: p.panelBorder }}>
      {/* Month | Year */}
      <View style={{ flexDirection: 'row', alignSelf: 'flex-start', padding: 3, borderRadius: 10, backgroundColor: p.tabsBg, marginBottom: 12 }}>
        {(['month', 'year'] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            onPress={() => setTab(t)}
            style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: tab === t ? p.tabOn : 'transparent' }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: tab === t ? p.tabOnText : p.tabOffText }}>{t === 'month' ? 'Month' : 'Year'}</Text>
          </Pressable>
        ))}
      </View>

      {/* ‹ October 2026 ›  or  ‹ 2016 – 2027 › */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Arrow
          label={tab === 'month' ? 'Previous month' : 'Earlier years'}
          disabled={tab === 'month' ? !canPrevMonth : !!min && firstYear <= min.y}
          onPress={() => (tab === 'month' ? moveMonth(-1) : setYearPage((y) => y - YEARS_PER_PAGE))}>
          <ChevronLeft size={18} color={p.arrow} />
        </Arrow>
        <Pressable accessibilityRole="button" onPress={() => setTab(tab === 'month' ? 'year' : 'month')} hitSlop={6}>
          <Text style={{ color: p.title, fontSize: 15, fontWeight: '700' }}>
            {tab === 'month' ? `${MONTHS[shown.m]} ${shown.y}` : `${years[0]} – ${years[years.length - 1]}`}
          </Text>
        </Pressable>
        <Arrow
          label={tab === 'month' ? 'Next month' : 'Later years'}
          disabled={tab === 'month' ? !canNextMonth : !!max && firstYear + YEARS_PER_PAGE > max.y}
          onPress={() => (tab === 'month' ? moveMonth(1) : setYearPage((y) => y + YEARS_PER_PAGE))}>
          <ChevronRight size={18} color={p.arrow} />
        </Arrow>
      </View>

      {tab === 'month' ? (
        <>
          <View style={{ flexDirection: 'row' }}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={{ width: `${100 / 7}%`, textAlign: 'center', color: p.weekday, fontSize: 11.5, fontWeight: '700', marginBottom: 6 }}>
                {w}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((c, i) => {
              const on = !!c.day && same(picked, c.day);
              const from = !!c.day && same(rangeFrom, c.day);
              const between = !!c.day && inRange(c.day);
              const usable = !!c.day && allowed(c.day);
              return (
                <View key={i} style={{ width: `${100 / 7}%`, padding: 3 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={c.day ? longDate(c.day) : undefined}
                    accessibilityState={{ selected: on, disabled: !usable }}
                    disabled={!usable}
                    onPress={() => c.day && setPicked(c.day)}
                    style={{
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      backgroundColor: on || from ? p.pick : between ? p.range : c.day ? p.cell : p.outside,
                      borderWidth: 1,
                      borderColor: on || from ? p.pick : between ? p.range : p.cellBorder,
                      opacity: usable || from ? 1 : 0.38,
                    }}>
                    <Text style={{ fontSize: 13, fontWeight: on || from ? '800' : '600', color: on || from ? p.pickText : between ? p.rangeText : p.cellText }}>
                      {c.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {years.map((y) => {
            const on = y === shown.y;
            const ok = yearOk(y);
            return (
              <View key={y} style={{ width: '25%', padding: 4 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: !ok }}
                  disabled={!ok}
                  onPress={() => {
                    // keep the month, but inside the allowed dates
                    setShown(({ m }) => {
                      let mm = m;
                      if (min && y === min.y) mm = Math.max(mm, min.m);
                      if (max && y === max.y) mm = Math.min(mm, max.m);
                      return { y, m: mm };
                    });
                    setTab('month');
                  }}
                  style={{
                    paddingVertical: 11,
                    alignItems: 'center',
                    borderRadius: 10,
                    backgroundColor: on ? p.pick : p.cell,
                    borderWidth: 1,
                    borderColor: on ? p.pick : p.cellBorder,
                    opacity: ok ? 1 : 0.38,
                  }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? p.pickText : p.cellText }}>{y}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* the picked day, large, then confirm */}
      <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: p.divider }}>
        {picked ? (
          <>
            <Text style={{ color: p.big }}>
              <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: -0.8 }}>{picked.d} </Text>
              <Text style={{ fontSize: 20, fontWeight: '700' }}>{DAY_NAMES[new Date(picked.y, picked.m, picked.d).getDay()]}</Text>
            </Text>
            <Text style={{ color: p.sub, fontSize: 15, fontWeight: '600', marginTop: 2 }}>
              {MONTHS[picked.m]}, {picked.y}
            </Text>
          </>
        ) : (
          <Text style={{ color: p.sub, fontSize: 13.5 }}>{emptyText}</Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !picked }}
            disabled={!picked}
            onPress={() => picked && onConfirm(ymdToText(picked))}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 11,
              borderRadius: 10,
              backgroundColor: p.pick,
              opacity: picked ? 1 : 0.5,
            }}>
            <Calendar size={16} color={p.pickText} />
            <Text style={{ color: p.pickText, fontWeight: '800', fontSize: 14 }}>{confirmLabel}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={8}>
            <Text style={{ color: p.link, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Arrow({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, opacity: disabled ? 0.3 : 1 }}>
      {children}
    </Pressable>
  );
}
