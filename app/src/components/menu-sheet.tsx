import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Screen, ScreenStack } from 'react-native-screens';

import { SHEET_RESTING_DETENT } from '@/lib/cockpit-scene';

/**
 * One form sheet for the whole cockpit. Detent 1 is UIKit's maximum, already
 * under the island. The screen id is what the native tab-bar lift follows.
 * Every other modal, including Sell creation, is ignored.
 *
 * The sheet content must be the screen's own child. react-native-screens only
 * connects a scroll view it finds as a direct subview, and that connection is
 * what lets a drag expand the sheet before the list scrolls.
 *
 * Sell creation is the next screen in this stack, presented full screen so the
 * keyboard cannot shrink a form sheet and reveal Sell. The cockpit sheet stays
 * mounted underneath. A second stack would hide it instead.
 */
export function MenuSheet({
  children,
  paper,
  onDetent,
  cover,
  onCoverDismiss,
}: {
  children: ReactNode;
  paper: string;
  onDetent: (index: number) => void;
  /** Full-screen sheet presented above the cockpit. Null keeps it dismissed. */
  cover?: ReactNode;
  onCoverDismiss?: () => void;
}) {
  return (
    <ScreenStack style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Screen activityState={2} pointerEvents="none" style={{ flex: 1, backgroundColor: 'transparent' }} />
      <Screen
        activityState={2}
        stackPresentation="formSheet"
        screenId="cockpit"
        sheetAllowedDetents={[SHEET_RESTING_DETENT, 1]}
        sheetInitialDetentIndex={0}
        sheetGrabberVisible
        sheetLargestUndimmedDetentIndex="last"
        sheetExpandsWhenScrolledToEdge
        gestureEnabled={false}
        onSheetDetentChanged={(event) => {
          if (!event.nativeEvent.isStable) {
            return;
          }

          onDetent(event.nativeEvent.index);
        }}
        style={{ flex: 1, backgroundColor: paper }}
      >
        {children}
      </Screen>
      {cover ? (
        <Screen
          activityState={2}
          stackPresentation="fullScreenModal"
          screenId="sell-create"
          gestureEnabled
          onDismissed={onCoverDismiss}
          style={{ flex: 1, backgroundColor: paper }}
        >
          {cover}
        </Screen>
      ) : null}
    </ScreenStack>
  );
}
