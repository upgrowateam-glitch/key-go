import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Calendar, ChevronDown } from 'lucide-react-native';
import { GLASS } from './GlassField';
import { DateCalendar, longDate, textToYmd, todayYmd } from './DateCalendar';

/**
 * A date field for the glass sign-up card. Tapping it opens the KeyGo calendar (glass look) right under it, starting
 * on the Year view for birth years far back. Future dates can't be picked. The value stays a "YYYY-MM-DD" text, so
 * the form's checks are unchanged.
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
  const [open, setOpen] = useState(false);
  const selected = textToYmd(value);
  const today = todayYmd();

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
        onPress={() => setOpen((o) => !o)}
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
          {selected ? longDate(selected) : value || placeholder}
        </Text>
        <ChevronDown size={18} color={GLASS.soft} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {error && !open ? <Text style={{ color: GLASS.error, fontSize: 12, marginTop: 5, fontWeight: '600' }}>{error}</Text> : null}

      {open ? (
        <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: 10 }}>
          <DateCalendar
            look="glass"
            value={value}
            max={today}
            // with no date yet, start at the years list around an adult's birth year
            startOn={{ y: today.y - 25, m: 0, d: 1 }}
            startTab="year"
            emptyText="Pick your birth year, then the day."
            onConfirm={(text) => {
              onChange(text);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
