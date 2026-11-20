'use client';

import React from 'react';
import { Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useThemeColors } from '../../theme';

/**
 * A labelled dropdown that looks like the other form fields. Uses the browser's own select, so it works with the
 * keyboard and opens the phone's native picker on mobiles.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  required,
  hint,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  required?: boolean;
  hint?: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ marginBottom: 14, flex: 1, minWidth: 0 }}>
      <Text style={{ color: colors.txt, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            width: '100%',
            height: 44,
            padding: '0 38px 0 12px',
            borderRadius: 10,
            border: `1px solid ${colors.lineStrong}`,
            background: colors.card,
            color: colors.txt,
            fontSize: 15,
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
          }}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <View pointerEvents="none" style={{ position: 'absolute', right: 12 }}>
          <ChevronDown size={18} color={colors.muted} />
        </View>
      </View>
      {hint ? <Text style={{ color: colors.muted, fontSize: 11.5, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}
