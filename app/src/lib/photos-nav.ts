/**
 * Gesture ownership for the Photos sheet (navigation.md, 3.3 and 5.6).
 *
 * Photos is one native form sheet owned by Product Detail (stack 3). Edit Photo
 * and Edit Collage are pushes inside that sheet (stack 4), so a native swipe on
 * the sheet always targets the Photos route, never the editor. That is how one
 * swipe used to close both. Rules:
 *
 * - Photos overview: the sheet can be dragged down. No horizontal pop.
 * - Editor open: the sheet cannot be dragged and the editor has no swipe-back.
 *   The editor leaves only through its own Back/Close, which asks first when dirty.
 *
 * Plain data on purpose: the layouts spread these, and tests read them directly.
 */

/** Options for stack 4 screens (`photos/_layout.tsx`). Nothing here may pop by gesture. */
export const photosStackGestures = {
  gestureEnabled: false,
  fullScreenGestureEnabled: false,
} as const;

/** `focusedChild` is the focused route name inside the Photos stack, undefined before it mounts. */
export function photosSheetGestureEnabled(focusedChild: string | undefined): boolean {
  return focusedChild == null || focusedChild === 'index';
}
