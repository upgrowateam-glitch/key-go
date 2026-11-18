import React, { useRef, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Image, ImageSourcePropType, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle, LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { Camera, CheckCircle2, Eraser, Eye, ImageOff, MapPin, ScanLine, Trash2, Upload } from 'lucide-react-native';
import { useThemeColors, useThemedStyles, type ThemeColors } from '../../theme';
import { CarZone, DamageMark, VerificationStatus } from '../../types';
import { Badge, Tone } from './controls';

// ---------------------------------------------------------------- Vehicle photography

/** Aspect ratio of every catalog photo (studio showroom shots, 2:1). Large photo frames use it too. */
export const VEHICLE_PHOTO_ASPECT = 2;
/** Studio floor/wall tone, shown behind a photo while it loads. */
const STUDIO_GREY = '#E4E7E9';

/**
 * Catalog vehicle photo. All fleet photos share one studio showroom style and a 2:1 frame with space
 * around the car, so `cover` never cuts the car off, even in smaller thumbnails.
 * Without a `source` a labelled placeholder is shown — never substitute another car's photo.
 */
export function VehiclePhoto({
  source,
  style,
  radius = 12,
  accessibilityLabel,
}: {
  source?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const [placeholderWidth, setPlaceholderWidth] = useState(0);
  const frame = [{ borderRadius: radius, overflow: 'hidden' as const }, style];

  if (!source) {
    return (
      <View
        style={[{ backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 4 }, frame]}
        onLayout={(e) => setPlaceholderWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel="Photo unavailable">
        <ImageOff size={placeholderWidth >= 120 ? 22 : 16} color={colors.muted} />
        {/* Tiny thumbnails sit next to the vehicle name, so the icon alone is enough there */}
        {placeholderWidth >= 88 ? (
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
            Photo unavailable
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor: STUDIO_GREY }, frame]}>
      {/* Explicit 100% size: react-native-web otherwise applies the asset's pixel size to bundled images */}
      <Image
        source={source}
        resizeMode="cover"
        style={photoStyles.fill}
        accessibilityLabel={accessibilityLabel}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

const photoStyles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
});

// ---------------------------------------------------------------- Photo capture placeholders

/** Grid of photo slots. Tapping simulates capturing/uploading (no camera access in the UI phase). */
export function PhotoCaptureGrid({
  slots,
  captured,
  onToggle,
  columns = 3,
}: {
  slots: string[];
  captured: string[];
  onToggle: (slot: string) => void;
  columns?: number;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
      {slots.map((slot) => {
        const done = captured.includes(slot);
        return (
          <View key={slot} style={{ width: `${100 / columns}%`, padding: 5 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${slot} photo ${done ? 'captured' : 'not captured'}`}
              onPress={() => onToggle(slot)}
              style={[styles.photoSlot, done && { borderStyle: 'solid', borderColor: colors.secondary, backgroundColor: colors.secondarySoft }]}>
              {done ? <CheckCircle2 size={22} color={colors.secondaryText} /> : <Camera size={22} color={colors.muted} />}
              <Text style={[styles.photoLabel, done && { color: colors.secondaryText }]} numberOfLines={1}>
                {slot}
              </Text>
              <Text style={styles.photoHint}>{done ? 'Captured' : 'Tap to capture'}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

/** Document upload / scan placeholder row. */
export function DocumentSlot({
  title,
  subtitle,
  meta,
  status,
  busy,
  onUpload,
  onScan,
  onView,
  onRemove,
}: {
  title: string;
  subtitle?: string;
  /** Second detail line, typically the stored file's name and size. */
  meta?: string;
  status: VerificationStatus;
  /** Disables the actions while a file is being stored. */
  busy?: boolean;
  onUpload?: () => void;
  onScan?: () => void;
  onView?: () => void;
  onRemove?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const tone: Tone = status === 'Verified' ? 'success' : status === 'Pending' ? 'warning' : status === 'Rejected' ? 'danger' : 'neutral';
  const action = (label: string, icon: React.ReactNode, onPress: () => void, danger?: boolean) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${label} ${title}`}
      disabled={busy}
      style={[styles.docBtn, danger && { borderColor: colors.danger }, busy && { opacity: 0.5 }]}
      onPress={onPress}>
      {icon}
      <Text style={[styles.docBtnText, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.docSlot}>
      <View style={{ flex: 1, minWidth: 160 }}>
        <Text style={styles.docTitle}>{title}</Text>
        {subtitle ? <Text style={styles.docSub}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.docSub}>{meta}</Text> : null}
        <View style={{ marginTop: 6 }}>
          <Badge label={status} tone={tone} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        {onView ? action('View', <Eye size={14} color={colors.primaryText} />, onView) : null}
        {onScan ? action('Scan', <ScanLine size={14} color={colors.primaryText} />, onScan) : null}
        {onUpload ? action(status === 'Not uploaded' ? 'Upload' : 'Replace', <Upload size={14} color={colors.primaryText} />, onUpload) : null}
        {onRemove ? action('Remove', <Trash2 size={14} color={colors.danger} />, onRemove, true) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Signature pad

/** Draw-to-sign pad. Emits SVG path data; nothing is uploaded. */
export function SignaturePad({
  value,
  onChange,
  height = 160,
  signerName,
}: {
  value: string;
  onChange: (path: string) => void;
  height?: number;
  signerName?: string;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  // Current path while drawing; read/written only inside the touch handlers
  const pathRef = useRef(value);

  const point = (e: GestureResponderEvent, cmd: 'M' | 'L') => {
    const { locationX, locationY } = e.nativeEvent;
    pathRef.current = `${pathRef.current} ${cmd}${locationX.toFixed(1)} ${locationY.toFixed(1)}`.trim();
    onChange(pathRef.current);
  };

  return (
    <View>
      <View
        style={[styles.sigPad, { height }]}
        accessibilityLabel="Signature pad. Draw your signature."
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          pathRef.current = value; // continue from the latest saved strokes (may have been cleared)
          point(e, 'M');
        }}
        onResponderMove={(e) => point(e, 'L')}>
        <Svg width="100%" height="100%" pointerEvents="none">
          <Line x1="16" x2="96%" y1={height - 34} y2={height - 34} stroke={colors.lineStrong} strokeDasharray="4 4" />
          {value ? <Path d={value} stroke={colors.txt} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </Svg>
        {!value ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Text style={styles.sigPlaceholder}>Sign here with your finger or mouse</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <Text style={styles.docSub}>{signerName ? `Signer: ${signerName}` : ' '}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => onChange('')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 }}>
          <Eraser size={14} color={colors.muted} />
          <Text style={styles.docSub}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Damage diagram

const ZONE_SHAPES: { zone: CarZone; x: number; y: number; w: number; h: number; r?: number }[] = [
  { zone: 'Front bumper', x: 52, y: 14, w: 96, h: 22, r: 10 },
  { zone: 'Bonnet', x: 52, y: 38, w: 96, h: 72, r: 6 },
  { zone: 'Windshield', x: 58, y: 112, w: 84, h: 36, r: 6 },
  { zone: 'Roof', x: 58, y: 150, w: 84, h: 104, r: 6 },
  { zone: 'Rear glass', x: 58, y: 256, w: 84, h: 32, r: 6 },
  { zone: 'Boot', x: 52, y: 290, w: 96, h: 60, r: 6 },
  { zone: 'Rear bumper', x: 52, y: 352, w: 96, h: 22, r: 10 },
  { zone: 'Left front door', x: 30, y: 136, w: 20, h: 72, r: 5 },
  { zone: 'Left rear door', x: 30, y: 212, w: 20, h: 72, r: 5 },
  { zone: 'Right front door', x: 150, y: 136, w: 20, h: 72, r: 5 },
  { zone: 'Right rear door', x: 150, y: 212, w: 20, h: 72, r: 5 },
  { zone: 'Left front wheel', x: 10, y: 60, w: 18, h: 48, r: 6 },
  { zone: 'Right front wheel', x: 172, y: 60, w: 18, h: 48, r: 6 },
  { zone: 'Left rear wheel', x: 10, y: 290, w: 18, h: 48, r: 6 },
  { zone: 'Right rear wheel', x: 172, y: 290, w: 18, h: 48, r: 6 },
];

/** Top-down car diagram. Tap a panel to mark/unmark damage on it. */
export function CarDamageDiagram({
  marks,
  onZonePress,
  width = 220,
  readOnly,
}: {
  marks: DamageMark[];
  onZonePress?: (zone: CarZone) => void;
  width?: number;
  readOnly?: boolean;
}) {
  const colors = useThemeColors();
  const height = (width / 200) * 390;
  const severityFill = (zone: CarZone) => {
    const m = marks.filter((d) => d.zone === zone);
    if (!m.length) return null;
    if (m.some((d) => d.severity === 'Major')) return colors.status.sold;
    if (m.some((d) => d.severity === 'Moderate')) return colors.status.maintenance;
    return { bg: colors.highlightSoft, text: colors.warmText, border: colors.highlight };
  };

  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel="Vehicle damage diagram, top view. Front of the car is at the top.">
      <Svg width={width} height={height} viewBox="0 0 200 390">
        {/* body outline */}
        <Rect x={40} y={8} width={120} height={372} rx={46} fill={colors.bg2} stroke={colors.lineStrong} strokeWidth={1.5} />
        {ZONE_SHAPES.map((z) => {
          const sev = severityFill(z.zone);
          const count = marks.filter((d) => d.zone === z.zone).length;
          return (
            <G key={z.zone} onPress={readOnly ? undefined : () => onZonePress?.(z.zone)}>
              <Rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                rx={z.r ?? 4}
                fill={sev ? sev.bg : colors.card}
                stroke={sev ? sev.border : colors.lineStrong}
                strokeWidth={sev ? 2 : 1}
              />
              {count > 0 ? (
                <>
                  <Circle cx={z.x + z.w / 2} cy={z.y + z.h / 2} r={8} fill={colors.danger} />
                  <SvgText x={z.x + z.w / 2} y={z.y + z.h / 2 + 3.5} fontSize="10" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">
                    {count}
                  </SvgText>
                </>
              ) : null}
            </G>
          );
        })}
        <SvgText x={100} y={6} fontSize="8" fill={colors.muted} textAnchor="middle">
          FRONT
        </SvgText>
        <SvgText x={100} y={389} fontSize="8" fill={colors.muted} textAnchor="middle">
          REAR
        </SvgText>
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- GPS map placeholder

export interface MapMarker {
  id: string;
  label: string;
  /** Position within the map, 0..1 */
  x: number;
  y: number;
  tone?: 'primary' | 'warning' | 'danger' | 'neutral';
}

/** Stylised map with vehicle pins. Simulated — no maps SDK or live GPS in the UI phase. */
export function GpsMapPlaceholder({
  markers,
  height = 240,
  caption,
  route,
}: {
  markers: MapMarker[];
  height?: number;
  caption?: string;
  /** Optional trail for a single trip, as 0..1 points */
  route?: { x: number; y: number }[];
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const [w, setW] = useState(600);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const pinColor = (t?: MapMarker['tone']) =>
    t === 'danger' ? colors.danger : t === 'warning' ? colors.warm : t === 'neutral' ? colors.muted : colors.primary;
  const roads = [0.18, 0.42, 0.7, 0.88];

  return (
    <View style={[styles.map, { height }]} onLayout={onLayout} accessibilityLabel="Simulated GPS map">
      <Svg width={w} height={height}>
        <Rect x={0} y={0} width={w} height={height} fill={colors.secondarySoft} />
        {/* blocks & parks */}
        <Rect x={w * 0.05} y={height * 0.05} width={w * 0.22} height={height * 0.28} rx={8} fill={colors.card} opacity={0.6} />
        <Rect x={w * 0.55} y={height * 0.5} width={w * 0.3} height={height * 0.25} rx={8} fill={colors.secondaryBorder} opacity={0.5} />
        {roads.map((r) => (
          <Line key={`h${r}`} x1={0} x2={w} y1={height * r} y2={height * r} stroke={colors.card} strokeWidth={7} />
        ))}
        {roads.map((r) => (
          <Line key={`v${r}`} y1={0} y2={height} x1={w * r} x2={w * r} stroke={colors.card} strokeWidth={7} />
        ))}
        <Line x1={0} y1={height} x2={w} y2={0} stroke={colors.highlightSoft} strokeWidth={10} />
        {route && route.length > 1 ? (
          <Polyline
            points={route.map((p) => `${p.x * w},${p.y * height}`).join(' ')}
            fill="none"
            stroke={colors.primary}
            strokeWidth={4}
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
        ) : null}
        {markers.map((m) => (
          <G key={m.id}>
            <Circle cx={m.x * w} cy={m.y * height} r={16} fill={pinColor(m.tone)} opacity={0.18} />
            <Circle cx={m.x * w} cy={m.y * height} r={7} fill={pinColor(m.tone)} stroke="#FFFFFF" strokeWidth={2} />
          </G>
        ))}
      </Svg>
      {markers.map((m) => (
        <View key={m.id} pointerEvents="none" style={[styles.pinLabel, { left: Math.min(w - 150, Math.max(4, m.x * w + 10)), top: Math.max(4, m.y * height - 30) }]}>
          <MapPin size={11} color={pinColor(m.tone)} />
          <Text style={styles.pinText} numberOfLines={1}>
            {m.label}
          </Text>
        </View>
      ))}
      <View style={styles.mapCaption}>
        <Text style={styles.mapCaptionText}>{caption ?? 'Simulated GPS view · connect a telematics provider later'}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Fuel level

const FUEL_STEPS = [0, 25, 50, 75, 100] as const;
const FUEL_LABELS: Record<number, string> = { 0: 'Empty', 25: '¼', 50: '½', 75: '¾', 100: 'Full' };

export function FuelLevelPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(makeStyles);
  const nearest = FUEL_STEPS.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a), 0 as number);
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Fuel level">
      {FUEL_STEPS.map((s) => {
        const active = s <= nearest && nearest > 0 ? true : s === 0 && nearest === 0;
        const selected = s === nearest;
        return (
          <TouchableOpacity
            key={s}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(s)}
            style={[styles.fuelCell, active && { backgroundColor: colors.secondary, borderColor: colors.secondary }, selected && { borderColor: colors.primary, borderWidth: 2 }]}>
            <Text style={[styles.fuelText, active && { color: colors.onSecondary }]}>{FUEL_LABELS[s]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    photoSlot: {
      height: 96,
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.lineStrong,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 6,
    },
    photoLabel: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
    },
    photoHint: {
      color: colors.muted,
      fontSize: 10,
    },
    docSlot: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    docTitle: {
      color: colors.txt,
      fontSize: 14,
      fontWeight: '700',
    },
    docSub: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    docBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.card,
    },
    docBtnText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '700',
    },
    sigPad: {
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.lineStrong,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    sigPlaceholder: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: '40%',
      textAlign: 'center',
      color: colors.muted,
      fontSize: 13,
    },
    map: {
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
    },
    pinLabel: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.line,
      maxWidth: 150,
    },
    pinText: {
      color: colors.txt,
      fontSize: 11,
      fontWeight: '700',
    },
    mapCaption: {
      position: 'absolute',
      left: 10,
      bottom: 10,
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    mapCaptionText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '600',
    },
    fuelCell: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    fuelText: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
    },
  });
