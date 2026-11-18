import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { withAlpha } from './colorUtils';

export type ShadowSpec = {
  /** Horizontal offset in px. */
  x?: number;
  /** Vertical offset in px. */
  y?: number;
  /** Blur radius in px. */
  blur?: number;
  /** 0..1 alpha applied to `color`. */
  opacity?: number;
};

/**
 * Drop shadow for a View.
 *
 * react-native-web has deprecated the `shadow*` props in favour of CSS `boxShadow`,
 * so on web we emit that directly. Native keeps the classic `shadow*` props, which
 * iOS renders as-is; Android ignores them and needs `elevation` set by the caller.
 */
export function boxShadow(color: string, { x = 0, y = 0, blur = 0, opacity = 1 }: ShadowSpec = {}): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `${x}px ${y}px ${blur}px ${withAlpha(color, opacity)}` };
  }
  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur,
  };
}

/**
 * Shadow for Text. Web uses CSS `textShadow` (the `textShadow*` props are deprecated
 * there); native keeps the `textShadow*` props.
 */
export function textShadow(color: string, { x = 0, y = 0, blur = 0, opacity = 1 }: ShadowSpec = {}): TextStyle {
  const rgba = withAlpha(color, opacity);
  if (Platform.OS === 'web') {
    // `textShadow` is a web-only style key, not part of React Native's TextStyle type.
    return { textShadow: `${x}px ${y}px ${blur}px ${rgba}` } as TextStyle;
  }
  return {
    textShadowColor: rgba,
    textShadowOffset: { width: x, height: y },
    textShadowRadius: blur,
  };
}
