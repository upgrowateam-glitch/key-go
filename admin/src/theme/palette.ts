import { contrastRatio, ensureContrast, mix, readableOn, withAlpha } from './colorUtils';

/** The two colors an admin can change from Theme Settings. */
export interface ThemeSeed {
  primary: string;
  secondary: string;
}

/** Default KeyGo palette (deep green / sage / warm orange / yellow). */
export const DEFAULT_THEME_SEED: ThemeSeed = {
  primary: '#0C3B2E',
  secondary: '#6D9773',
};

/** Fixed brand colors that are not user-configurable. */
export const BRAND = {
  accentWarm: '#B46617', // warm orange — sparing highlights / important info
  highlight: '#FFBA00',  // yellow — badges, active nav, key figures
  charcoal: '#1F2421',   // body text
  white: '#FFFFFF',
} as const;

const status = (text: string, bg: string, border: string) => ({ text, bg, border });

/**
 * Builds every color token the UI uses from a seed.
 * Screens must read colors from here (via `useThemeColors`) — never hardcode palette values.
 */
export function buildTheme(seed: ThemeSeed) {
  const white = BRAND.white;

  // Fills: if neither white nor charcoal text reads well on the chosen color (e.g. mid-grey),
  // nudge the fill just far enough that its text passes WCAG AA.
  const onPrimary = readableOn(seed.primary);
  const primary = ensureContrast(seed.primary, onPrimary, 4.5);
  const onSecondaryText = readableOn(seed.secondary);
  const secondary = ensureContrast(seed.secondary, onSecondaryText, 4.5);

  // Surfaces: a very pale tint of the secondary color keeps the page "soft off-white / pale green"
  const bg = mix(secondary, '#FAFAF7', 0.92);
  const bg2 = mix(secondary, white, 0.86);
  const primarySoft = mix(primary, white, 0.9);
  const secondarySoft = mix(secondary, white, 0.85);

  // Text-safe variants guarantee ≥ 4.5:1 on the tinted backgrounds they sit on (and therefore on white)
  const primaryText = ensureContrast(primary, primarySoft, 4.5);
  const secondaryText = ensureContrast(secondary, secondarySoft, 4.5);
  const warmText = ensureContrast(BRAND.accentWarm, white, 4.5);

  // Navigation uses the primary color; the active item uses yellow only if it stays readable
  const navActive = contrastRatio(BRAND.highlight, primary) >= 3 ? BRAND.highlight : onPrimary;

  return {
    // --- surfaces & text ---
    bg,
    bg2,
    card: white,
    cardElevated: white,
    line: withAlpha(BRAND.charcoal, 0.1),
    lineStrong: withAlpha(BRAND.charcoal, 0.18),
    txt: BRAND.charcoal,
    muted: '#5B6560',

    // --- primary (main actions & navigation) ---
    primary,
    onPrimary,
    primaryText,
    primarySoft,
    primaryBorder: mix(primary, white, 0.65),

    // --- secondary (supporting elements) ---
    secondary,
    onSecondary: onSecondaryText,
    secondaryText,
    secondarySoft,
    secondaryBorder: mix(secondary, white, 0.55),

    // --- navigation chrome ---
    nav: primary,
    onNav: onPrimary,
    navActive,
    navInactive: withAlpha(onPrimary, 0.68),
    navLine: withAlpha(onPrimary, 0.12),

    // --- vehicle photography: studio cut-outs are shown on a dark stage ---
    photoStage: mix(primary, '#070B09', 0.78),
    photoStageGlow: mix(primary, white, 0.22),

    // --- sparing highlights ---
    warm: BRAND.accentWarm,
    warmText,
    warmSoft: mix(BRAND.accentWarm, white, 0.88),
    highlight: BRAND.highlight,
    onHighlight: BRAND.charcoal,
    highlightSoft: mix(BRAND.highlight, white, 0.82),

    // --- legacy aliases (kept so existing screens keep working) ---
    accent: primary,
    accentText: primaryText,
    accentDark: mix(primary, '#000000', 0.2),
    accentGlow: mix(primary, white, 0.9),
    accentBorder: mix(primary, white, 0.65),
    onAccent: onPrimary,
    onAccentMuted: withAlpha(onPrimary, 0.8),
    onLight: BRAND.charcoal,
    accent2: secondary,
    accent2Text: secondaryText,
    accent2Glow: mix(secondary, white, 0.85),
    accent2Border: mix(secondary, white, 0.55),

    // --- semantic colors (fixed, accessible on white) ---
    success: '#1B7A43',
    successGlow: '#E3F4EA',
    info: '#1D5FA8',
    infoGlow: '#E3EEFB',
    warning: '#9A5B00',
    warningGlow: '#FFF3D6',
    danger: '#B42318',
    dangerGlow: '#FDE7E5',
    violet: '#6B3FB0',
    violetGlow: '#EFE8FB',

    status: {
      available: status('#1B7A43', '#E3F4EA', '#A8DDBF'),
      reserved: status('#1D5FA8', '#E3EEFB', '#AFCBEF'),
      onRent: status('#6B3FB0', '#EFE8FB', '#CDB8F0'),
      maintenance: status('#9A5B00', '#FFF3D6', '#F3D48A'),
      sold: status('#B42318', '#FDE7E5', '#F4B4AE'),
      neutral: status('#4F5A55', '#EEF1EF', '#CDD5D1'),
    },

    // Chart series: brand colors first, then accessible extras
    chart: [primary, secondary, BRAND.accentWarm, BRAND.highlight, '#1D5FA8', '#6B3FB0'],

    overlay: withAlpha(BRAND.charcoal, 0.45),
    shadow: '#0F1A15',
  };
}

export type ThemeColors = ReturnType<typeof buildTheme>;

export const KeyGoRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;
