import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../theme';

export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    heroRow: {
      flexDirection: 'row',
    },
    heroImageWrap: {
      backgroundColor: colors.photoStage,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
    paintChip: {
      position: 'absolute',
      left: 12,
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.line,
    },
    paintDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.lineStrong,
    },
    paintText: {
      color: colors.txt,
      fontSize: 11,
      fontWeight: '700',
    },
    codeChip: {
      backgroundColor: colors.bg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.line,
    },
    codeText: { color: colors.txt, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
    statusBox: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      padding: 12,
    },
    muted: {
      color: colors.muted,
      fontSize: 12,
    },
    hint: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    body: {
      color: colors.txt,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: 12,
    },
    label: {
      color: colors.txt,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 8,
    },
    kLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 2,
    },
    kValue: {
      color: colors.txt,
      fontSize: 16,
      fontWeight: '800',
    },
    kValueSm: {
      color: colors.txt,
      fontSize: 13,
      fontWeight: '700',
    },
    cardTitle: {
      color: colors.txt,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 12,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    link: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    error: {
      color: colors.danger,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
    },
  });
