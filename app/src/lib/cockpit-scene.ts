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

/** The five tab roots. Nested pages such as /sell/new are cockpit pages, but not roots. */
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

/**
 * The shell re-renders only when the sheet appears or disappears.
 * Moving from /sell/new to /sell/setup/:id is the same sheet. A new render of
 * the same open sheet must not count: that re-render publishes again, and
 * treating it as a new sheet loops.
 */
export function sameCreationSession(previousPath: string | null, path: string | null): boolean {
  return previousPath != null && path != null && isSellCreationPath(previousPath) && isSellCreationPath(path);
}

export function creationAvailabilityChanged(
  previousPath: string | null,
  hadContent: boolean,
  path: string,
  hasContent: boolean,
): boolean {
  if (hadContent && hasContent && sameCreationSession(previousPath, path)) {
    return false;
  }

  return previousPath !== path || hadContent !== hasContent;
}

/**
 * Keep the sheet mounted while the next creation route is still publishing.
 * A cold open still waits for content that belongs to that exact path.
 */
export function creationHandoffReady(input: {
  pathname: string;
  previousPath: string | null;
  publishedPath: string | null;
  hasNode: boolean;
}): boolean {
  if (!input.hasNode || !isSellCreationPath(input.pathname)) {
    return false;
  }

  if (input.publishedPath === input.pathname) {
    return true;
  }

  return sameCreationSession(input.previousPath, input.pathname)
    && input.publishedPath != null
    && isSellCreationPath(input.publishedPath);
}

/** New item, already-listed, and the setup steps. These open a full-screen sheet over the cockpit. */
export function isSellCreationPath(pathname: string): boolean {
  return pathname === '/sell/new' || pathname === '/sell/listed' || pathname.startsWith('/sell/setup/');
}

/** Route names inside the Sell stack that present the creation sheet. */
export function isSellCreationRouteName(name: string): boolean {
  return name === 'new' || name === 'listed' || name === 'setup/[id]' || name.startsWith('setup/');
}

type NavRoute = { name: string; state?: NavNode };
type NavNode = { key?: string; type?: string; index?: number; routes?: NavRoute[] };

function findSellRoute(state: NavNode | null | undefined): { parent: NavNode; route: NavRoute } | null {
  if (!state?.routes) {
    return null;
  }

  for (const route of state.routes) {
    if (route.name === 'sell' && route.state?.type === 'stack') {
      return { parent: state, route };
    }

    const nested = findSellRoute(route.state);

    if (nested) {
      return nested;
    }
  }

  return null;
}

export type SellStackSnap = {
  selected: boolean;
  key: string;
  focusedName: string;
  depth: number;
};

/** The Sell tab's stack, wherever it sits under the root navigator. */
export function readSellStack(state: NavNode | null | undefined): SellStackSnap | null {
  const found = findSellRoute(state);
  const stack = found?.route.state;
  const routes = stack?.routes;

  if (!found || !stack?.key || !routes || routes.length === 0) {
    return null;
  }

  const current = routes[stack.index ?? 0];
  const selected = found.parent.routes?.[found.parent.index ?? 0]?.name === 'sell';

  if (!current) {
    return null;
  }

  return {
    selected,
    key: stack.key,
    focusedName: current.name,
    depth: routes.length,
  };
}

export type CreationCoverDecision = {
  /** Mount the creation sheet. */
  present: boolean;
  /** Pop the Sell stack back to the overview. */
  pop: boolean;
  stackKey: string | null;
};

/**
 * The creation sheet is only for a route the user opened on purpose.
 * Selecting Sell while its stack is already on that route must not present it.
 * A cold deep link has no previous path, so it still presents.
 */
export function decideCreationCover(input: {
  pathname: string;
  previousPath: string | null;
  snap: SellStackSnap | null;
  previousSnap: SellStackSnap | null;
  /** This exact path was already rejected. Stay rejected until it changes. */
  blocked: boolean;
}): CreationCoverDecision {
  if (!isSellCreationPath(input.pathname)) {
    return { present: false, pop: false, stackKey: null };
  }

  const stackKey = input.snap?.key ?? null;

  if (input.blocked) {
    return { present: false, pop: true, stackKey };
  }

  const justFocused = Boolean(input.snap?.selected) && !input.previousSnap?.selected;
  const unchanged = Boolean(
    input.previousSnap
    && input.snap
    && input.previousSnap.key === input.snap.key
    && input.previousSnap.focusedName === input.snap.focusedName
    && input.previousSnap.depth === input.snap.depth,
  );
  const focusedIsCreation = input.snap ? isSellCreationRouteName(input.snap.focusedName) : false;
  // The overview often has no readable stack snapshot. A push from /sell is still
  // the user opening a product. Only a creation route revealed from another screen
  // is a leftover sheet.
  const cameFromOverview = input.previousPath === '/sell';
  const revealed = justFocused && focusedIsCreation && !cameFromOverview && (unchanged || input.previousSnap == null && input.previousPath != null && !isSellCreationPath(input.previousPath));

  if (revealed) {
    return { present: false, pop: true, stackKey };
  }

  if (input.snap && !input.snap.selected) {
    return { present: false, pop: false, stackKey: null };
  }

  return { present: true, pop: false, stackKey: null };
}

/**
 * The Sell tab keeps its stack when another tab is selected. If that stack is
 * still sitting on the creation flow, choosing Sell again reopens the sheet.
 * Returns the stack key to pop, or null while Sell itself is the selected tab
 * (an open flow or a deep link must stay).
 */
export function abandonedSellStackKey(state: NavNode | null | undefined): string | null {
  const found = findSellRoute(state);

  if (!found?.parent.routes) {
    return null;
  }

  const selected = found.parent.routes[found.parent.index ?? 0];

  if (selected?.name === 'sell') {
    return null;
  }

  const stack = found.route.state;
  const routes = stack?.routes;

  if (!stack?.key || !routes || routes.length < 2) {
    return null;
  }

  const current = routes[stack.index ?? 0];

  if (!current || !isSellCreationRouteName(current.name)) {
    return null;
  }

  return stack.key;
}

/**
 * The creation sheet is a route, but the overview that opened it should stay
 * on screen behind it. Only a published tab root from the same area qualifies.
 */
export function holdsCockpitScene(pathname: string, publishedPath: string | null): boolean {
  if (publishedPath == null || !isSellCreationPath(pathname) || !isCockpitRoot(publishedPath)) {
    return false;
  }

  return cockpitArea(publishedPath) === cockpitArea(pathname);
}
