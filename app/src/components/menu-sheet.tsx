import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Screen, ScreenStack } from 'react-native-screens';

import { SHEET_RESTING_DETENT } from '@/lib/cockpit-scene';
import { navLog, screenLifecycleLog } from '@/lib/nav-log';
import { useTheme } from '@/state/theme';

const cockpitLog = __DEV__ ? screenLifecycleLog('cockpit') : {};
const stackFinished = __DEV__ ? () => navLog('native.menusheet.finishTransitioning') : undefined;

/** Opaque sheet fill. A clear fill lets iOS 26 draw Liquid Glass through the sheet. */
const sheetFill = { light: '#FFFFFF', dark: '#18181A' } as const;

/**
 * One form sheet for the whole cockpit. Detent 1 is UIKit's maximum, already
 * under the island. The screen id is what the native tab-bar lift follows.
 * Every other modal is ignored.
 *
 * The sheet content must be the screen's own child. react-native-screens only
 * connects a scroll view it finds as a direct subview, and that connection is
 * what lets a drag expand the sheet before the list scrolls.
 *
 * Nothing else is presented from this stack. Product Detail, the secondary
 * pages and Sell creation are (app) stack modals above it.
 */
export function MenuSheet({
  children,
  onDetent,
}: {
  children: ReactNode;
  onDetent: (index: number) => void;
}) {
  const { scheme } = useTheme();

  return (
    <ScreenStack style={StyleSheet.absoluteFill} pointerEvents="box-none" onFinishTransitioning={stackFinished}>
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
        {...cockpitLog}
        onSheetDetentChanged={(event) => {
          if (!event.nativeEvent.isStable) {
            return;
          }

          onDetent(event.nativeEvent.index);
        }}
        style={{ flex: 1, backgroundColor: sheetFill[scheme] }}
      >
        {children}
      </Screen>
    </ScreenStack>
  );
}
