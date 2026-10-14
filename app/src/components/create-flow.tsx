import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { startPlaybook } from '@/api/endpoints';
import { GlassClose } from '@/components/glass-close';
import { Icon } from '@/components/icon';
import { InlineError, PageHeader, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { space } from '@/design/tokens';
import { confirmDiscard } from '@/lib/confirm';
import { createDiscardGuard } from '@/lib/discard';
import { errorMessage } from '@/lib/errors';
import { majorToMinor } from '@/lib/money';
import { navLog } from '@/lib/nav-log';
import { navigation } from '@/lib/navigation';
import { useRefreshProduct } from '@/state/query';

/**
 * Close and Finish for a single-screen creation form (navigation.md 5.3, T3, T4).
 *
 * The form saves nothing until it is submitted, so a changed form asks before it closes:
 * the Close button, an iOS swipe and Android back all end up in the same Keep editing / Discard question.
 * Both exits go through the coordinator, which returns to the origin tab. `usePreventRemove` must stop
 * preventing before the coordinator closes, so leaving is a state change first and the close runs in an effect.
 */
export function useCreationExit(dirty: boolean) {
  const [leaving, setLeaving] = useState<'close' | 'finish' | null>(null);
  const guard = useMemo(() => createDiscardGuard(confirmDiscard), []);

  function ask() {
    void guard.request().then((discard) => {
      navLog('creation.discard.answer', { discard });

      if (discard) {
        setLeaving('close');
      }
    });
  }

  usePreventRemove(dirty && leaving == null, () => {
    navLog('creation.leave.blocked');
    ask();
  });

  useEffect(() => {
    if (leaving === 'close') {
      navigation.closeExperience();
    } else if (leaving === 'finish') {
      navigation.finishCreation();
    }
  }, [leaving]);

  return {
    close: () => (dirty ? ask() : setLeaving('close')),
    /** Call after the request succeeded. A failed save never gets here, so the form stays open with its input. */
    finish: () => setLeaving('finish'),
  };
}

/** Starts a playbook. `onDone` runs once it is saved and the lists are refreshed. A failure stays on the form. */
export function usePlaybookStart(onDone: () => void) {
  const refresh = useRefreshProduct();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function start(playbook: string, input: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      await startPlaybook(playbook, input);
      await refresh();
      onDone();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, start };
}

/** Blank is allowed. A bad number is an error string the screen can show. */
export function readMoney(value: string): number | null | string {
  if (value.trim() === '') {
    return null;
  }

  const minor = majorToMinor(value);

  return minor == null ? 'Enter an amount like 250.' : minor;
}

/** The page of a creation route (`(app)/create/*`). On iOS phone that is a full-screen modal over the cockpit. */
export function CreateFrame({
  title,
  lede,
  backLabel,
  onClose,
  accent,
  children,
}: {
  title: string;
  lede?: string;
  backLabel: string;
  onClose: () => void;
  accent: string;
  children: ReactNode;
}) {
  const phone = useLayout().phone;
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  const body = (
    <View style={{ gap: space.lg, maxWidth: 720, width: '100%' }}>
      {ios && phone ? (
        <View style={{ flexDirection: 'row' }}>
          <GlassClose onPress={onClose} />
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onClose} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
          <Icon name="arrowLeft" size={16} color={accent} />
          <Text style={{ color: accent, fontSize: 14 }}>{backLabel}</Text>
        </Pressable>
      )}
      <View style={{ gap: space.sm, borderTopWidth: 3, borderTopColor: accent, paddingTop: space.md }}>
        <PageHeader title={title} subtitle={lede} />
        {children}
      </View>
    </View>
  );

  if (!phone) {
    return body;
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: ios ? insets.top + 8 : 8, paddingHorizontal: space.md, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {body}
    </ScrollView>
  );
}

export function FormError({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }

  return <InlineError message={errorMessage(error)} />;
}

export function FormLead({ children }: { children: string }) {
  return <T variant="bodyStrong">{children}</T>;
}
