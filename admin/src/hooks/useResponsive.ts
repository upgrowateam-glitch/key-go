import { useWindowDimensions } from 'react-native';

/** Layout breakpoints shared by every screen. */
export const BREAKPOINTS = { tablet: 768, desktop: 1100 } as const;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.desktop;
  return {
    width,
    height,
    isPhone: !isTablet,
    isTablet,
    isDesktop,
    /** Horizontal page padding. */
    gutter: isDesktop ? 32 : isTablet ? 24 : 16,
    /** Pick a column count: phone / tablet / desktop. */
    cols: (phone: number, tablet: number, desktop: number) => (isDesktop ? desktop : isTablet ? tablet : phone),
  };
}
