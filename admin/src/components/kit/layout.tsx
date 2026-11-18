import { useRouter } from '@/shims/expo-router';
import { ArrowLeft, Info } from 'lucide-react-native';
import React, { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';

export const MAX_CONTENT_WIDTH = 1600;

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Content max width; screens with forms can use a narrower value. */
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra space at the bottom (e.g. above a sticky action bar). */
  bottomInset?: number;
  footer?: ReactNode;
}

/** Page container: themed background, centered max-width column and responsive gutters. */
export function Screen({ children, scroll = true, maxWidth = MAX_CONTENT_WIDTH, contentStyle, bottomInset = 48, footer }: ScreenProps) {
  const colors = useThemeColors();
  const { gutter } = useResponsive();
  const inner = (
    <View style={[{ width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16 }, contentStyle]}>
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomInset }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer}
    </View>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  back?: boolean | (() => void);
  actions?: ReactNode;
}

/** Title block at the top of a page, with optional back button and actions (wraps below on phones). */
export function PageHeader({ title, subtitle, eyebrow, back, actions }: PageHeaderProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { isPhone } = useResponsive();
  const onBack = typeof back === 'function' ? back : () => (router.canGoBack() ? router.back() : router.replace('/dashboard' as any));
  return (
    <View style={[styles.header, isPhone && { flexDirection: 'column', alignItems: 'stretch' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        {back ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn} onPress={onBack}>
            <ArrowLeft size={18} color={colors.txt} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {actions ? <View style={[styles.actions, isPhone && { marginTop: 12 }]}>{actions}</View> : null}
    </View>
  );
}

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'soft' | 'primary' | 'highlight';
  padded?: boolean;
  onPress?: () => void;
}

export function Card({ children, style, tone = 'default', padded = true, onPress }: CardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const toneStyle: ViewStyle =
    tone === 'soft'
      ? { backgroundColor: colors.secondarySoft, borderColor: colors.secondaryBorder }
      : tone === 'primary'
        ? { backgroundColor: colors.primary, borderColor: colors.primary }
        : tone === 'highlight'
          ? { backgroundColor: colors.highlightSoft, borderColor: colors.highlight }
          : {};
  const content = [styles.card, padded && { padding: 16 }, toneStyle, style];
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={content} accessibilityRole="button">
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={content}>{children}</View>;
}

interface SectionProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A titled group of content within a page. */
export function Section({ title, subtitle, action, children, style }: SectionProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[{ marginTop: 24 }, style]}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

/** Responsive grid: children flow into `cols` equal columns. */
export function Grid({
  children,
  cols,
  gap = 12,
  style,
}: {
  children: ReactNode;
  cols: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }, style]}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / cols}%`, paddingHorizontal: gap / 2, marginBottom: gap }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Two-pane layout on wide screens (main + side), stacked on phones. */
export function SplitView({ main, side, sideWidth = 360 }: { main: ReactNode; side: ReactNode; sideWidth?: number }) {
  const { isDesktop } = useResponsive();
  if (!isDesktop) {
    return (
      <View>
        {main}
        {side}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0 }}>{main}</View>
      <View style={{ width: sideWidth }}>{side}</View>
    </View>
  );
}

/** Small notice used to flag simulated features (no backend / no real integration). */
export function SimulatedNote({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.note} accessibilityRole="text">
      <Info size={14} color={colors.info} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const colors = useThemeColors();
  return <View style={[{ height: 1, backgroundColor: colors.line, marginVertical: 12 }, style]} />;
}

/** Sticky bottom action bar (checkout, forms). */
export function ActionBar({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const { gutter } = useResponsive();
  return (
    <View style={styles.actionBar}>
      <View style={{ width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {children}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      color: colors.secondaryText,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    title: {
      color: colors.txt,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 13,
      marginTop: 2,
      lineHeight: 18,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 1,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
      marginBottom: 12,
    },
    sectionTitle: {
      color: colors.txt,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    sectionSub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    note: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.infoGlow,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 8,
    },
    noteText: {
      flex: 1,
      color: colors.info,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    actionBar: {
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingVertical: 12,
    },
  });
