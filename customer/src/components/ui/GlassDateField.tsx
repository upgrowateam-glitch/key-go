import React, { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { GLASS } from './GlassField';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const YEARS_PER_PAGE = 12;

type Ymd = { y: number; m: number; d: number };

const pad = (n: number) => String(n).padStart(2, '0');
const toText = ({ y, m, d }: Ymd) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const same = (a: Ymd | null, b: Ymd) => !!a && a.y === b.y && a.m === b.m && a.d === b.d;
const after = (a: Ymd, b: Ymd) => a.y * 10000 + a.m * 100 + a.d > b.y * 10000 + b.m * 100 + b.d;

/** Reads "YYYY-MM-DD" (only real dates). */
function fromText(text: string): Ymd | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!hit) return null;
  const y = +hit[1];
  const m = +hit[2] - 1;
  const d = +hit[3];
  return m >= 0 && m < 12 && d >= 1 && d <= daysIn(y, m) ? { y, m, d } : null;
}

/**
 * A date field for the glass sign-up card. Tapping it opens a frosted calendar right under it, with a Month view
 * (days of the month, Monday first) and a Year view (12 years at a time, for birth years far back), the picked day
 * shown large ("16 Wednesday / October, 2004"), and Confirm / Cancel. Future dates can't be picked.
 * The value stays a "YYYY-MM-DD" text, so the form's checks are unchanged.
 */
export function GlassDateField({
  label,
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
}) {
  const now = new Date();
  const today: Ymd = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'month' | 'year'>('month');
  const [picked, setPicked] = useState<Ymd | null>(null);
  const [shown, setShown] = useState({ y: today.y, m: today.m });
  const [yearPage, setYearPage] = useState(today.y);

  const openCalendar = () => {
    const current = fromText(value);
    setPicked(current);
    // with no date yet, start at the years list around an adult's birth year
    const start = current ?? { y: today.y - 25, m: 0, d: 1 };
    setShown({ y: start.y, m: start.m });
    setYearPage(start.y);
    setTab(current ? 'month' : 'year');
    setOpen(true);
  };

  const moveMonth = (step: number) =>
    setShown(({ y, m }) => {
      const next = new Date(y, m + step, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  const confirm = () => {
    if (picked) onChange(toText(picked));
    setOpen(false);
  };

  // ---------------------------------------------------------------- month view cells (Monday first)
  const lead = (new Date(shown.y, shown.m, 1).getDay() + 6) % 7;
  const prevDays = daysIn(shown.y, shown.m - 1 < 0 ? 11 : shown.m - 1);
  const cells: { label: number; day?: Ymd }[] = [];
  for (let i = lead; i > 0; i--) cells.push({ label: prevDays - i + 1 });
  for (let d = 1; d <= daysIn(shown.y, shown.m); d++) cells.push({ label: d, day: { y: shown.y, m: shown.m, d } });
  while (cells.length % 7) cells.push({ label: cells.length - lead - daysIn(shown.y, shown.m) + 1 });
  const atLatestMonth = shown.y > today.y || (shown.y === today.y && shown.m >= today.m);

  // ---------------------------------------------------------------- year view
  const firstYear = yearPage - (yearPage % YEARS_PER_PAGE);
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => firstYear + i);

  const selected = fromText(value);
  const big = picked ?? selected;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: GLASS.soft, fontSize: 12.5, fontWeight: '700', marginBottom: 6, letterSpacing: 0.2 }}>
        {label}
        {required ? <Text style={{ color: GLASS.focus }}> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `, ${value}` : ''}`}
        accessibilityHint="Opens a calendar"
        onPress={() => (open ? setOpen(false) : openCalendar())}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 50,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: GLASS.fieldBg,
          borderWidth: 1,
          borderColor: error ? GLASS.error : open ? GLASS.focus : GLASS.fieldBorder,
        }}>
        <Calendar size={18} color={GLASS.soft} />
        <Text style={{ flex: 1, color: value ? GLASS.text : GLASS.faint, fontSize: 15.5, paddingVertical: 12 }}>
          {selected ? `${selected.d} ${MONTHS[selected.m]} ${selected.y}` : value || placeholder}
        </Text>
        <ChevronDown size={18} color={GLASS.soft} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {error && !open ? <Text style={{ color: GLASS.error, fontSize: 12, marginTop: 5, fontWeight: '600' }}>{error}</Text> : null}

      {open ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.30)',
          }}>
          {/* Month | Year */}
          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'flex-start',
              padding: 3,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.10)',
              marginBottom: 12,
            }}>
            {(['month', 'year'] as const).map((t) => (
              <Pressable
                key={t}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                onPress={() => setTab(t)}
                style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: tab === t ? 'rgba(255,255,255,0.92)' : 'transparent' }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: tab === t ? '#0B3A2C' : GLASS.soft }}>{t === 'month' ? 'Month' : 'Year'}</Text>
              </Pressable>
            ))}
          </View>

          {/* header: ‹ October 2004 › or ‹ 1992 – 2003 › */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Arrow
              label={tab === 'month' ? 'Previous month' : 'Earlier years'}
              onPress={() => (tab === 'month' ? moveMonth(-1) : setYearPage((y) => y - YEARS_PER_PAGE))}>
              <ChevronLeft size={18} color={GLASS.focus} />
            </Arrow>
            <Pressable accessibilityRole="button" onPress={() => setTab(tab === 'month' ? 'year' : 'month')} hitSlop={6}>
              <Text style={{ color: GLASS.text, fontSize: 15, fontWeight: '700' }}>
                {tab === 'month' ? `${MONTHS[shown.m]} ${shown.y}` : `${years[0]} – ${years[years.length - 1]}`}
              </Text>
            </Pressable>
            <Arrow
              label={tab === 'month' ? 'Next month' : 'Later years'}
              disabled={tab === 'month' ? atLatestMonth : firstYear + YEARS_PER_PAGE > today.y}
              onPress={() => (tab === 'month' ? moveMonth(1) : setYearPage((y) => y + YEARS_PER_PAGE))}>
              <ChevronRight size={18} color={GLASS.focus} />
            </Arrow>
          </View>

          {tab === 'month' ? (
            <>
              <View style={{ flexDirection: 'row' }}>
                {WEEKDAYS.map((w) => (
                  <Text key={w} style={{ width: `${100 / 7}%`, textAlign: 'center', color: GLASS.faint, fontSize: 11.5, fontWeight: '700', marginBottom: 6 }}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {cells.map((c, i) => {
                  const future = !!c.day && after(c.day, today);
                  const on = !!c.day && same(picked, c.day);
                  const usable = !!c.day && !future;
                  return (
                    <View key={i} style={{ width: `${100 / 7}%`, padding: 3 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={c.day ? `${c.day.d} ${MONTHS[c.day.m]} ${c.day.y}` : undefined}
                        accessibilityState={{ selected: on, disabled: !usable }}
                        disabled={!usable}
                        onPress={() => c.day && setPicked(c.day)}
                        style={{
                          aspectRatio: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          backgroundColor: on ? GLASS.focus : c.day ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
                          borderWidth: 1,
                          borderColor: on ? GLASS.focus : 'rgba(255,255,255,0.12)',
                          opacity: usable ? 1 : 0.4,
                        }}>
                        <Text style={{ fontSize: 13, fontWeight: on ? '800' : '600', color: on ? '#1F2421' : GLASS.text }}>{c.label}</Text>
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
                const future = y > today.y;
                return (
                  <View key={y} style={{ width: '25%', padding: 4 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: on, disabled: future }}
                      disabled={future}
                      onPress={() => {
                        setShown(({ m }) => ({ y, m: y === today.y ? Math.min(m, today.m) : m }));
                        setTab('month');
                      }}
                      style={{
                        paddingVertical: 11,
                        alignItems: 'center',
                        borderRadius: 10,
                        backgroundColor: on ? GLASS.focus : 'rgba(255,255,255,0.14)',
                        borderWidth: 1,
                        borderColor: on ? GLASS.focus : 'rgba(255,255,255,0.12)',
                        opacity: future ? 0.4 : 1,
                      }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#1F2421' : GLASS.text }}>{y}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* the picked day, large, then confirm */}
          <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' }}>
            {big ? (
              <>
                <Text style={{ color: GLASS.text }}>
                  <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: -0.8 }}>{big.d} </Text>
                  <Text style={{ fontSize: 20, fontWeight: '700' }}>{DAY_NAMES[new Date(big.y, big.m, big.d).getDay()]}</Text>
                </Text>
                <Text style={{ color: GLASS.soft, fontSize: 15, fontWeight: '600', marginTop: 2 }}>
                  {MONTHS[big.m]}, {big.y}
                </Text>
              </>
            ) : (
              <Text style={{ color: GLASS.soft, fontSize: 13.5 }}>Pick your birth year, then the day.</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !picked }}
                disabled={!picked}
                onPress={confirm}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 11,
                  borderRadius: 10,
                  backgroundColor: GLASS.focus,
                  opacity: picked ? 1 : 0.5,
                }}>
                <Calendar size={16} color="#1F2421" />
                <Text style={{ color: '#1F2421', fontWeight: '800', fontSize: 14 }}>Confirm date</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={{ color: GLASS.link, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      ) : null}
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
