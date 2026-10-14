import { useNavigation, usePreventRemove, type NavigationProp, type ParamListBase } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createDiscardGuard } from '@/lib/discard';
import { navLog } from '@/lib/nav-log';

/**
 * Asks before this screen is left while `dirty`: Close, Back and a dragged-down parent sheet all end up here.
 * `usePreventRemove` also tells the native stack to hold the gesture (preventNativeDismiss).
 * `ask` must be a stable function. Returns `leave()`, which goes back without asking. Call it after a successful save.
 *
 * Discard and `leave()` only ever go back one level from THIS screen. They never replay the
 * blocked action: for a sheet drag that action is "pop Photos", and replaying it would close
 * the editor and its parent together.
 */
export function useDiscardGuard(dirty: boolean, ask: () => Promise<boolean>) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const [leaving, setLeaving] = useState(false);
  const guard = useMemo(() => createDiscardGuard(ask), [ask]);

  usePreventRemove(dirty && !leaving, ({ data }) => {
    navLog('editor.leave.blocked', { action: data.action.type });

    void guard.request().then((discard) => {
      navLog('editor.leave.answer', { discard });

      if (discard) {
        setLeaving(true);
      }
    });
  });

  // Leaving is a state change first, so the screen has stopped preventing by the time the action is dispatched.
  useEffect(() => {
    if (leaving) {
      navLog('editor.leave.back');
      navigation.dispatch({ type: 'GO_BACK' });
    }
  }, [leaving, navigation]);

  return useCallback(() => setLeaving(true), []);
}
