'use client';

import React, { useState } from 'react';
import { Modal, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { useThemeColors } from '../../theme';
import { withAlpha } from '../../theme/colorUtils';
import { DateCalendar, MONTHS, textToYmd, type Ymd } from './DateCalendar';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A date field that opens the KeyGo calendar (the same one as in the customer app) in a card over the page.
 * The value stays "YYYY-MM-DD".
 */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  rangeFrom,
  placeholder = 'Select date',
  error,
  required,
  style,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: Ymd;
  max?: Ymd;
  /** Marks the trip from this day to the picked one (used for the return date). */
  rangeFrom?: Ymd | null;
  placeholder?: string;
  error?: string;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const selected = textToYmd(value);

  return (
    <View style={[{ marginBottom: 14, flex: 1, minWidth: 0 }, style]}>
      <Text style={{ color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `, ${value}` : ''}`}
        accessibilityHint="Opens a calendar"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: error ? colors.danger : open ? colors.primary : colors.lineStrong,
          borderRadius: 10,
          paddingHorizontal: 12,
          minHeight: 44,
        }}>
        <Calendar size={16} color={colors.primaryText} />
        <Text style={{ flex: 1, color: selected ? colors.txt : colors.muted, fontSize: 14, paddingVertical: 10 }} numberOfLines={1}>
          {selected
            ? `${WEEKDAY[new Date(selected.y, selected.m, selected.d).getDay()]}, ${selected.d} ${MONTHS[selected.m].slice(0, 3)} ${selected.y}`
            : value || placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={{ color: colors.danger, fontSize: 11, marginTop: 4, fontWeight: '600' }}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: withAlpha('#06140E', 0.55), justifyContent: 'center', padding: 16 }}>
          <Pressable accessibilityLabel="Close calendar" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setOpen(false)} />
          <View style={{ width: '100%', maxWidth: 400, alignSelf: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 8, marginLeft: 4 }}>{label}</Text>
            <DateCalendar
              look="light"
              value={value}
              min={min}
              max={max}
              rangeFrom={rangeFrom}
              startOn={rangeFrom ?? min}
              onConfirm={(text) => {
                onChange(text);
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
