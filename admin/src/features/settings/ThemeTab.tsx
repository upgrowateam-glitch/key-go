import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, RotateCcw } from 'lucide-react-native';
import {
  Badge,
  BarChart,
  Button,
  Card,
  Field,
  Grid,
  Section,
  SplitView,
  StatusBadge,
} from '../../components/kit';
import {
  contrastRatio,
  DEFAULT_THEME_SEED,
  isValidHex,
  normalizeHex,
  useThemeColors,
  useThemedStyles,
  useThemeSettings,
  type ThemeColors,
  type ThemeSeed,
} from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { useApp } from '../../context/AppContext';

// Hue families × shades — a compact, touch-friendly color picker that works on phone and desktop
const PICKER_ROWS: string[][] = [
  ['#0C3B2E', '#14532D', '#166534', '#15803D', '#3F7D4E', '#6D9773', '#8FB996', '#B7D3B0'],
  ['#0F3D3E', '#115E59', '#0F766E', '#0D9488', '#2A9D8F', '#5FA8A0', '#88C1BA', '#B5DCD6'],
  ['#0B2545', '#13315C', '#1D4E89', '#1D5FA8', '#2563EB', '#4F7CAC', '#7FA7D4', '#B3CDEB'],
  ['#2E1A47', '#3B2167', '#4C1D95', '#6B3FB0', '#7C5CBF', '#9A7FD1', '#B9A6E0', '#D8CCF0'],
  ['#4A1D1F', '#7F1D1D', '#991B1B', '#B42318', '#C0504D', '#D9776B', '#E8A198', '#F4CBC5'],
  ['#4A2A0A', '#7C3E0B', '#9A4F0F', '#B46617', '#C97C2A', '#D99A4E', '#E8BC82', '#F3DAB8'],
  ['#1F2421', '#2F3A35', '#3F4B45', '#56625C', '#6F7A74', '#8E9892', '#B3BBB6', '#D5DAD7'],
];

type SeedKey = keyof ThemeSeed;

function ColorEditor({ label, description, seedKey }: { label: string; description: string; seedKey: SeedKey }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const { seed, setSeed } = useThemeSettings();
  const value = seed[seedKey];
  // Text being typed that isn't a valid color yet; otherwise the field shows the saved value
  const [draft, setDraft] = useState<string | null>(null);
  const hex = draft ?? value;

  const onHexChange = (text: string) => {
    const normalized = normalizeHex(text);
    if (normalized) {
      setSeed({ [seedKey]: normalized } as Partial<ThemeSeed>);
      setDraft(null);
    } else {
      setDraft(text);
    }
  };

  const invalid = hex.trim().length > 0 && !isValidHex(hex);

  return (
    <Card style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View style={[styles.bigSwatch, { backgroundColor: value }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.editorTitle}>{label}</Text>
          <Text style={styles.editorSub}>{description}</Text>
        </View>
      </View>

      <Field
        label={`${label} HEX`}
        value={hex}
        onChangeText={onHexChange}
        placeholder="#0C3B2E"
        error={invalid ? 'Enter a valid HEX color, e.g. #0C3B2E' : undefined}
        hint="Changes apply immediately and are saved on this device."
        left={<View style={[styles.miniSwatch, { backgroundColor: normalizeHex(hex) ?? colors.bg2 }]} />}
      />

      <Text style={styles.pickerLabel}>Color picker</Text>
      <View style={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel={`${label} color picker`}>
        {PICKER_ROWS.map((row) => (
          <View key={row[0]} style={{ flexDirection: 'row', gap: 6 }}>
            {row.map((c) => {
              const selected = c.toUpperCase() === value.toUpperCase();
              return (
                <TouchableOpacity
                  key={c}
                  accessibilityRole="radio"
                  accessibilityLabel={c}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setSeed({ [seedKey]: c } as Partial<ThemeSeed>);
                    setDraft(null);
                  }}
                  style={[styles.swatch, { backgroundColor: c }, selected && { borderColor: colors.txt, borderWidth: 2 }]}>
                  {selected ? <Check size={14} color={contrastRatio(c, '#FFFFFF') > 3 ? '#FFFFFF' : '#1F2421'} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}

function ContrastRow({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  const styles = useThemedStyles(makeStyles);
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= 4.5;
  return (
    <View style={styles.contrastRow}>
      <View style={[styles.contrastSample, { backgroundColor: bg }]}>
        <Text style={{ color: fg, fontWeight: '800', fontSize: 13 }}>Aa</Text>
      </View>
      <Text style={styles.contrastLabel}>{label}</Text>
      <Text style={styles.contrastRatio}>{ratio.toFixed(1)}:1</Text>
      <Badge label={pass ? 'AA pass' : ratio >= 3 ? 'Large text only' : 'Low'} tone={pass ? 'success' : ratio >= 3 ? 'warning' : 'danger'} />
    </View>
  );
}

function LivePreview() {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      {/* nav bar sample */}
      <View style={[styles.previewNav, { backgroundColor: colors.nav }]}>
        <Text style={{ color: colors.onNav, fontWeight: '800', fontSize: 16 }}>
          Key<Text style={{ color: colors.navActive }}>Go</Text>
        </Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Text style={{ color: colors.navActive, fontWeight: '700', fontSize: 12 }}>Dashboard</Text>
          <Text style={{ color: colors.navInactive, fontWeight: '600', fontSize: 12 }}>Bookings</Text>
        </View>
      </View>
      <View style={{ padding: 16, backgroundColor: colors.bg, gap: 14 }}>
        <Card>
          <Text style={styles.previewTitle}>Booking KG-XXXXXX</Text>
          <Text style={styles.editorSub}>Urban SUV · 28 Sep → 5 Oct</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <StatusBadge status="Confirmed" />
            <StatusBadge status="On Rent" />
            <StatusBadge status="Maintenance" />
            <StatusBadge status="Overdue" />
            <Badge label="Reminder · T-2" tone="highlight" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <Button label="Confirm" size="sm" />
            <Button label="Details" size="sm" variant="outline" />
            <Button label="Secondary" size="sm" variant="secondary" />
          </View>
          <Text style={[styles.editorSub, { marginTop: 10, color: colors.primaryText, fontWeight: '700' }]}>Primary link text</Text>
        </Card>
        <Card>
          <Text style={[styles.previewTitle, { marginBottom: 10 }]}>Income vs expense</Text>
          <BarChart
            labels={['Jul', 'Aug', 'Sep']}
            series={[
              { name: 'Income', values: [214, 181, 68] },
              { name: 'Expense', values: [325, 355, 399] },
            ]}
            height={110}
          />
        </Card>
      </View>
    </Card>
  );
}

export default function ThemeTab() {
  const colors = useThemeColors();
  const { isDefault, resetTheme, seed } = useThemeSettings();
  const { showToast } = useApp();
  const { cols } = useResponsive();

  const onReset = () => {
    resetTheme();
    showToast('Theme reset to the default green palette');
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Text style={{ flex: 1, minWidth: 240, color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          Change the primary and secondary colors. The whole app — admin and customer screens — updates instantly and remembers your choice on this device.
        </Text>
        <Button
          label="Reset to default"
          variant="outline"
          disabled={isDefault}
          onPress={onReset}
          icon={(c) => <RotateCcw size={15} color={c} />}
        />
      </View>

      <SplitView
        sideWidth={420}
        main={
          <View>
            <ColorEditor
              label="Primary"
              seedKey="primary"
              description="Navigation, main buttons and key actions."
            />
            <ColorEditor
              label="Secondary"
              seedKey="secondary"
              description="Supporting elements, page tint, chips and charts."
            />
          </View>
        }
        side={
          <View>
            <Section title="Live preview" style={{ marginTop: 0 }}>
              <LivePreview />
            </Section>
            <Section title="Readability check" subtitle="Text colors are adjusted automatically to stay readable.">
              <Card>
                <ContrastRow label="Button text on primary" fg={colors.onPrimary} bg={colors.primary} />
                <ContrastRow label="Primary text on white" fg={colors.primaryText} bg={colors.card} />
                <ContrastRow label="Secondary text on white" fg={colors.secondaryText} bg={colors.card} />
                <ContrastRow label="Active nav item" fg={colors.navActive} bg={colors.nav} />
                <ContrastRow label="Body text on page" fg={colors.txt} bg={colors.bg} />
              </Card>
            </Section>
            <Section title="Fixed brand colors" subtitle="Used sparingly for highlights and important information.">
              <Grid cols={cols(2, 2, 2)}>
                {[
                  { name: 'Warm orange', value: colors.warm },
                  { name: 'Yellow highlight', value: colors.highlight },
                  { name: 'Default primary', value: DEFAULT_THEME_SEED.primary },
                  { name: 'Default secondary', value: DEFAULT_THEME_SEED.secondary },
                ].map((c) => (
                  <View key={c.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.value, borderWidth: 1, borderColor: colors.line }} />
                    <View>
                      <Text style={{ color: colors.txt, fontSize: 12, fontWeight: '700' }}>{c.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{c.value}</Text>
                    </View>
                  </View>
                ))}
              </Grid>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                Current: primary {seed.primary} · secondary {seed.secondary} · page {colors.bg}
              </Text>
            </Section>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bigSwatch: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
    },
    miniSwatch: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.line,
    },
    editorTitle: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
    },
    editorSub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    pickerLabel: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8,
    },
    swatch: {
      flex: 1,
      aspectRatio: 1,
      maxWidth: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contrastRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    contrastSample: {
      width: 36,
      height: 28,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.line,
    },
    contrastLabel: {
      flex: 1,
      color: colors.txt,
      fontSize: 12,
    },
    contrastRatio: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    previewNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    previewTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '800',
    },
  });
