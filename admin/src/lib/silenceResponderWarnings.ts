/**
 * react-native-web's responder system logs a dev-only warning whenever a
 * `mouseup` reaches the document without a matching primary-button
 * `mousedown` (right-click, middle-click, Ctrl/Alt-click, or a press that
 * started before the responder listeners were attached). The warning has no
 * runtime effect and cannot be disabled through the library, so it is
 * filtered out of the console here. Only these two exact messages are dropped.
 */
const SILENCED_PREFIXES = [
  'Cannot record touch end without a touch start.',
  'Cannot record touch move without a touch start.',
];

declare global {
  interface Window {
    __keygoResponderWarningsSilenced?: boolean;
  }
}

export function silenceResponderWarnings(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return;
  if (window.__keygoResponderWarningsSilenced) return;
  window.__keygoResponderWarningsSilenced = true;

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && SILENCED_PREFIXES.some((p) => first.startsWith(p))) return;
    originalWarn(...args);
  };
}
