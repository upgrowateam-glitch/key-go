
import React, { createContext, ReactNode, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { buildTheme, DEFAULT_THEME_SEED, ThemeColors, ThemeSeed } from './palette';
import { normalizeHex } from './colorUtils';

const STORAGE_KEY = 'keygo.theme.v1';

function loadSeed(): ThemeSeed {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_SEED;
    const parsed = JSON.parse(raw) as Partial<ThemeSeed>;
    return {
      primary: normalizeHex(parsed.primary ?? '') ?? DEFAULT_THEME_SEED.primary,
      secondary: normalizeHex(parsed.secondary ?? '') ?? DEFAULT_THEME_SEED.secondary,
    };
  } catch {
    return DEFAULT_THEME_SEED;
  }
}

function saveSeed(seed: ThemeSeed | null) {
  try {
    if (seed) globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(seed));
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private browsing, blocked site data) — the theme still applies for this session
  }
}

// Tiny external store for the seed. useSyncExternalStore lets statically rendered web pages hydrate
// with the default theme (matching the server HTML) and then switch to the stored theme.
let currentSeed: ThemeSeed = loadSeed();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => currentSeed;
const getServerSnapshot = () => DEFAULT_THEME_SEED;
function writeSeed(next: ThemeSeed | null) {
  currentSeed = next ?? DEFAULT_THEME_SEED;
  saveSeed(next);
  listeners.forEach((l) => l());
}

interface ThemeContextValue {
  seed: ThemeSeed;
  colors: ThemeColors;
  isDefault: boolean;
  setSeed: (patch: Partial<ThemeSeed>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const seed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSeed = useCallback((patch: Partial<ThemeSeed>) => {
    writeSeed({ ...currentSeed, ...patch });
  }, []);

  const resetTheme = useCallback(() => writeSeed(null), []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      seed,
      colors: buildTheme(seed),
      isDefault:
        seed.primary === DEFAULT_THEME_SEED.primary && seed.secondary === DEFAULT_THEME_SEED.secondary,
      setSeed,
      resetTheme,
    }),
    [seed, setSeed, resetTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useThemeSettings() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeSettings must be used within a ThemeProvider');
  return ctx;
}

/** Current theme color tokens. Re-renders the caller when the admin changes the theme. */
export function useThemeColors(): ThemeColors {
  return useThemeSettings().colors;
}

/**
 * Builds a StyleSheet from the current theme and rebuilds it only when the theme changes.
 * Usage: `const makeStyles = (colors: ThemeColors) => StyleSheet.create({...})`
 *        `const styles = useThemedStyles(makeStyles);`
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useThemeColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
