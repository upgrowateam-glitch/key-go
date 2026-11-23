import React, { useState } from 'react';
import { Modal, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Calendar } from 'lucide-react-native';
import { useThemeColors, withAlpha } from '../../theme';
import { DateCalendar, MONTHS, textToYmd, type Ymd } from './DateCalendar';

/**
 * A date field for the app's light pages (pickup and return dates). Looks like the other form fields; tapping it opens
 * the KeyGo calendar (same as the sign-up date of birth) in a card over the page. The value stays "YYYY-MM-DD".
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
    <View style={[{ marginBottom: 14 }, style]}>
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
          {selected ? `${selected.d} ${MONTHS[selected.m].slice(0, 3)} ${selected.y}` : value || placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={{ color: colors.danger, fontSize: 11, marginTop: 4, fontWeight: '600' }}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(160)} style={{ flex: 1, backgroundColor: withAlpha('#06140E', 0.55), justifyContent: 'center', padding: 16 }}>
          <Pressable
            accessibilityLabel="Close calendar"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setOpen(false)}
          />
          <Animated.View
            entering={ZoomIn.duration(200)}
            style={{
              width: '100%',
              maxWidth: 400,
              alignSelf: 'center',
              borderRadius: 20,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 12,
            }}>
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
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}
