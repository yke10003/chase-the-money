export type CockpitArea = 'home' | 'sell' | 'freelance' | 'build' | 'recover';

/** Which cockpit area a URL belongs to. Null means this route leaves the cockpit. */
export function cockpitArea(pathname: string): CockpitArea | null {
  if (pathname === '/') {
    return 'home';
  }

  if (pathname === '/sell' || pathname.startsWith('/sell/')) {
    return 'sell';
  }

  if (pathname === '/freelance' || pathname.startsWith('/freelance/')) {
    return 'freelance';
  }

  if (pathname === '/build' || pathname.startsWith('/build/')) {
    return 'build';
  }

  if (pathname === '/recover' || pathname.startsWith('/recover/')) {
    return 'recover';
  }

  return null;
}

/**
 * The tab path the cockpit hero follows. Profile, a mission or Product Detail
 * covers the tabs without changing them, so those keep the last tab path.
 * A cold link has no previous tab path, and the tabs then open on Home.
 */
export function shellPath(pathname: string, previous: string | null): string {
  if (cockpitArea(pathname) != null) {
    return pathname;
  }

  return previous ?? '/';
}

/** The five tab roots. Nested pages such as /sell/items/4 are cockpit pages, but not roots. */
export function isCockpitRoot(pathname: string): boolean {
  return pathname === '/' || pathname === '/sell' || pathname === '/freelance' || pathname === '/build' || pathname === '/recover';
}

/**
 * Resting height as a fraction of UIKit's maximum, which already stops under
 * the island. 0.5 put the top at 53% of the screen. Flighty's passport sheet
 * starts at 43%, which is this fraction.
 */
export const SHEET_RESTING_DETENT = 0.61;

/**
 * Height of the sheet from the bottom of the screen.
 * Detent 0 is the resting height. Detent 1 is UIKit's maximum.
 * react-native-screens only reports settled detents.
 */
export function sheetCover(windowHeight: number, topInset: number, detentIndex: number): number {
  const maximum = Math.max(0, windowHeight - topInset);

  if (detentIndex >= 1) {
    return maximum;
  }

  return maximum * SHEET_RESTING_DETENT;
}

/** At full height the sheet covers the hero, so the buttons outside it have nowhere to sit. */
export function outsideActionsVisible(detentIndex: number): boolean {
  return detentIndex < 1;
}
