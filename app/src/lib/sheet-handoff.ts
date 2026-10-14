/**
 * An action that opens another native presentation (a mission, Profile, a second sheet) from inside a
 * React Native `Modal` sheet. On iOS the sheet has to finish dismissing first (navigation.md, T9), and the
 * `Modal`'s `onDismiss` is that signal, so the action waits for `dismissed()`. Elsewhere there is no such
 * event and nothing races, so it runs at once.
 *
 * One action is parked at a time. A second `run` before the first sheet has gone replaces it.
 */
export function createSheetHandoff({ ios, close, log }: { ios: boolean; close: () => void; log?: (event: string) => void }) {
  let parked: (() => void) | null = null;

  return {
    run(action: () => void) {
      if (!ios) {
        close();
        action();
        return;
      }

      log?.('sheet.handoff');
      parked = action;
      close();
    },

    /** The sheet's `onDismiss`. Also fires for a plain close, when nothing is parked. */
    dismissed() {
      const action = parked;

      if (action == null) {
        return;
      }

      parked = null;
      log?.('sheet.dismissed');
      action();
    },
  };
}
