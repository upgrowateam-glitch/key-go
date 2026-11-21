import React, { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

/** Colours for text and fields on the glass cards (over a dark picture). */
export const GLASS = {
  text: '#FFFFFF',
  soft: 'rgba(255,255,255,0.78)',
  faint: 'rgba(255,255,255,0.55)',
  fieldBg: 'rgba(255,255,255,0.10)',
  fieldBorder: 'rgba(255,255,255,0.28)',
  focus: '#FFBA00',
  error: '#FFB4A8',
  link: '#FFBA00',
};

/**
 * A see-through form field for the glass sign-in and sign-up cards: white text, soft border, an icon on the left,
 * a hint inside (placeholder), and an eye to show or hide a password. Behaves like the kit's Field.
 */
export function GlassField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  keyboardType,
  secureTextEntry,
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  required?: boolean;
  autoComplete?: 'email' | 'password' | 'new-password' | 'tel' | 'given-name' | 'family-name' | 'birthdate-full';
}) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  return (
    <View style={{ marginBottom: 14, minWidth: 0 }}>
      <Text style={{ color: GLASS.soft, fontSize: 12.5, fontWeight: '700', marginBottom: 6, letterSpacing: 0.2 }}>
        {label}
        {required ? <Text style={{ color: GLASS.focus }}> *</Text> : null}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 50,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: GLASS.fieldBg,
          borderWidth: 1,
          borderColor: error ? GLASS.error : focused ? GLASS.focus : GLASS.fieldBorder,
        }}>
        {icon}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={GLASS.faint}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !shown}
          autoCapitalize={keyboardType === 'email-address' || secureTextEntry ? 'none' : 'words'}
          autoCorrect={false}
          autoComplete={autoComplete}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, minWidth: 0, color: GLASS.text, fontSize: 15.5, paddingVertical: 12 }}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'} onPress={() => setShown((s) => !s)} hitSlop={8}>
            {shown ? <EyeOff size={18} color={GLASS.soft} /> : <Eye size={18} color={GLASS.soft} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={{ color: GLASS.error, fontSize: 12, marginTop: 5, fontWeight: '600' }}>{error}</Text> : null}
    </View>
  );
}
