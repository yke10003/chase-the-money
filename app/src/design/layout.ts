import { useWindowDimensions } from 'react-native';

import { breakpoint } from '@/design/tokens';

export function useLayout() {
  const { width } = useWindowDimensions();

  return {
    width,
    phone: width < breakpoint.tablet,
    tablet: width >= breakpoint.tablet && width < breakpoint.desktop,
    desktop: width >= breakpoint.desktop,
    wide: width >= breakpoint.wide,
    /** Room for a main column plus a side column next to the 248px rail. */
    twoColumn: width >= 1280,
  };
}
