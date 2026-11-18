// Small color helpers used to derive a readable theme from user-chosen HEX colors.

export type RGB = { r: number; g: number; b: number };

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(value: string) {
  return HEX_RE.test(value.trim());
}

/** Normalises "#abc" / "abc" / "#AABBCC" to "#AABBCC". Returns null when invalid. */
export function normalizeHex(value: string): string | null {
  const m = HEX_RE.exec(value.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toUpperCase()}`;
}

export function hexToRgb(hex: string): RGB {
  const h = (normalizeHex(hex) ?? '#000000').slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB) {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Linear blend: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

export function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance. */
export function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Picks whichever of `light` / `dark` reads better on `bg`. */
export function readableOn(bg: string, light = '#FFFFFF', dark = '#1F2421') {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}

/**
 * Darkens (or lightens) `color` step by step until it reaches `min` contrast against `bg`.
 * Used so a light brand color can still be used for text and icons on white surfaces.
 */
export function ensureContrast(color: string, bg: string, min = 4.5) {
  if (contrastRatio(color, bg) >= min) return normalizeHex(color) ?? color;
  const towards = luminance(bg) > 0.5 ? '#000000' : '#FFFFFF';
  for (let t = 0.05; t <= 1; t += 0.05) {
    const candidate = mix(color, towards, t);
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return towards;
}
