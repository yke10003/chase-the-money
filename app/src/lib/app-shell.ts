export type AppWrapper = 'FocusShell' | 'NativeTabWash' | 'AppShell';

/**
 * Profile can be open before a goal exists. The dev pages opened from Profile
 * stay too, because sending them to onboarding swaps the wrapper and remounts the cockpit.
 */
export function openWithoutGoal(pathname: string): boolean {
  return pathname === '/onboarding' || pathname === '/settings' || pathname === '/listing-lab' || pathname === '/bloom';
}

/**
 * The element type that hosts the (app) stack. A different type remounts the
 * whole stack, cockpit included, so on iOS phone it must not depend on the
 * route the user is on. Onboarding is outside the shell.
 */
export function appWrapper(input: { os: string; phone: boolean; pathname: string }): AppWrapper {
  if (input.pathname === '/onboarding') {
    return 'FocusShell';
  }

  if (input.os === 'ios' && input.phone) {
    return 'NativeTabWash';
  }

  return 'AppShell';
}

export type TopLevelPresentation = {
  presentation: 'fullScreenModal' | 'card';
  animation: 'slide_from_bottom' | 'none';
};

/**
 * Profile, Progress, All activity and mission detail share one (secondary)
 * route, and Sell creation is one create/sell route. On iOS phone the cockpit
 * sheet is already presented, so a card would sit underneath it. Everywhere
 * else they stay ordinary pages in AppShell.
 */
export function secondaryPresentation(os: string, phone: boolean): TopLevelPresentation {
  if (os === 'ios' && phone) {
    return { presentation: 'fullScreenModal', animation: 'slide_from_bottom' };
  }

  return { presentation: 'card', animation: 'none' };
}
