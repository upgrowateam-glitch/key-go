import React, { ReactNode } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';

// ---------------------------------------------------------------- Button

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'highlight';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: (color: string) => ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  fullWidth,
  style,
  accessibilityHint,
}: ButtonProps) {
  const colors = useThemeColors();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.secondary, fg: colors.onSecondary, border: colors.secondary },
    outline: { bg: colors.card, fg: colors.primaryText, border: colors.primaryBorder },
    ghost: { bg: 'transparent', fg: colors.primaryText, border: 'transparent' },
    danger: { bg: colors.dangerGlow, fg: colors.danger, border: colors.status.sold.border },
    highlight: { bg: colors.highlight, fg: colors.onHighlight, border: colors.highlight },
  };
  const p = palette[variant];
  const pad = size === 'sm' ? { paddingHorizontal: 12, paddingVertical: 7 } : size === 'lg' ? { paddingHorizontal: 20, paddingVertical: 14 } : { paddingHorizontal: 16, paddingVertical: 10 };
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        pad,
        style,
      ]}>
      {icon ? icon(p.fg) : null}
      <Text style={{ color: p.fg, fontSize: size === 'sm' ? 12 : 14, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Round icon-only button. */
export function IconButton({
  icon,
  onPress,
  label,
  tone = 'default',
}: {
  icon: (color: string) => ReactNode;
  onPress?: () => void;
  label: string;
  tone?: 'default' | 'primary';
}) {
  const colors = useThemeColors();
  const bg = tone === 'primary' ? colors.primary : colors.card;
  const fg = tone === 'primary' ? colors.onPrimary : colors.txt;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: bg, borderWidth: 1, borderColor: tone === 'primary' ? bg : colors.line, alignItems: 'center', justifyContent: 'center' }}>
      {icon(fg)}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------- Field

interface FieldProps {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
  /** Hides the typed value, for passwords. */
  secureTextEntry?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  keyboardType,
  multiline,
  editable = true,
  secureTextEntry,
  left,
  right,
  required,
  style,
}: FieldProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.inputWrap,
          !editable && { backgroundColor: colors.bg2 },
          !!error && { borderColor: colors.danger },
          multiline && { alignItems: 'flex-start' },
        ]}>
        {left}
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
          secureTextEntry={secureTextEntry}
        />
        {right}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Lays out form fields in 1 column on phones and `cols` columns on wider screens. */
export function FormRow({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  const { isPhone } = useResponsive();
  const items = React.Children.toArray(children).filter(Boolean);
  if (isPhone) return <>{items}</>;
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {items.map((c, i) => (
        <View key={i} style={{ flex: 1 / cols, flexGrow: 1 }}>
          {c}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- Choices

interface SegmentedProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, labels, style }: SegmentedProps<T>) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.segment, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o === value;
        return (
          <TouchableOpacity
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o)}
            style={[styles.segmentItem, active && { backgroundColor: colors.primary }]}>
            <Text style={[styles.segmentText, active && { color: colors.onPrimary }]}>{labels?.[o] ?? o}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface ChipGroupProps<T extends string> {
  options: readonly T[];
  value: T | T[];
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  scroll?: boolean;
}

/** Filter chips — single select when `value` is a string, multi when it is an array. */
export function ChipGroup<T extends string>({ options, value, onChange, labels, scroll }: ChipGroupProps<T>) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const selected = (o: T) => (Array.isArray(value) ? value.includes(o) : value === o);
  const chips = options.map((o) => {
    const active = selected(o);
    return (
      <TouchableOpacity
        key={o}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => onChange(o)}
        style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <Text style={[styles.chipText, active && { color: colors.onPrimary }]}>{labels?.[o] ?? o}</Text>
      </TouchableOpacity>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>;
}

/** Labelled on/off switch row. */
export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  right,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  right?: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      {right}
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.lineStrong, true: colors.secondary }}
        thumbColor={value ? colors.primary : '#FFFFFF'}
        {...({ activeThumbColor: colors.primary } as object)}
      />
    </View>
  );
}

/** Tappable checkbox with label. */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View style={[styles.checkbox, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {checked ? <Text style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '900' }}>✓</Text> : null}
      </View>
      <Text style={{ color: colors.txt, fontSize: 13, flex: 1 }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------- Badges

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral' | 'primary' | 'highlight' | 'warm';

export function toneColors(colors: ThemeColors, tone: Tone) {
  switch (tone) {
    case 'success':
      return colors.status.available;
    case 'info':
      return colors.status.reserved;
    case 'violet':
      return colors.status.onRent;
    case 'warning':
      return colors.status.maintenance;
    case 'danger':
      return colors.status.sold;
    case 'primary':
      return { text: colors.primaryText, bg: colors.primarySoft, border: colors.primaryBorder };
    case 'highlight':
      return { text: colors.onHighlight, bg: colors.highlightSoft, border: colors.highlight };
    case 'warm':
      return { text: colors.warmText, bg: colors.warmSoft, border: colors.warm };
    default:
      return colors.status.neutral;
  }
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: (color: string) => ReactNode }) {
  const colors = useThemeColors();
  const c = toneColors(colors, tone);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: c.bg,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}>
      {icon ? icon(c.text) : null}
      <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Sheet (modal form)

export function FormSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { isPhone } = useResponsive();
  return (
    <Modal visible={visible} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable style={[styles.sheetBackdrop, !isPhone && { justifyContent: 'center' }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, isPhone ? styles.sheetPhone : styles.sheetDesktop]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {title}
            </Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
              <X size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Confirmation dialog for status changes and destructive actions. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useThemeColors();
  return (
    <FormSheet
      visible={visible}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button label="Keep as is" variant="ghost" onPress={onCancel} />
          <Button label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} />
        </>
      }>
      {message ? <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{message}</Text> : null}
    </FormSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    label: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      minHeight: 44,
    },
    input: {
      flex: 1,
      color: colors.txt,
      fontSize: 14,
      paddingVertical: 10,
    },
    hint: {
      color: colors.muted,
      fontSize: 11,
      marginTop: 4,
      lineHeight: 15,
    },
    error: {
      color: colors.danger,
      fontSize: 11,
      marginTop: 4,
      fontWeight: '600',
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.bg2,
      borderRadius: 12,
      padding: 3,
      alignSelf: 'flex-start',
      flexWrap: 'wrap',
    },
    segmentItem: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 9,
    },
    segmentText: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '600',
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.lineStrong,
    },
    chipText: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '600',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    toggleLabel: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sheet: {
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    sheetPhone: {
      width: '100%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '92%',
    },
    sheetDesktop: {
      width: 560,
      maxWidth: '94%',
      borderRadius: 18,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    sheetTitle: {
      color: colors.txt,
      fontSize: 17,
      fontWeight: '800',
    },
    sheetFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
  });
