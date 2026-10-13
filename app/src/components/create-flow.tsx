import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { startPlaybook } from '@/api/endpoints';
import { useCockpit, useCockpitBody } from '@/components/cockpit-context';
import { Icon } from '@/components/icon';
import { InlineError, PageHeader, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { space } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { majorToMinor } from '@/lib/money';
import { useRefreshProduct } from '@/state/query';

export function usePlaybookStart(doneHref: string) {
  const refresh = useRefreshProduct();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function start(playbook: string, input: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      await startPlaybook(playbook, input);
      await refresh();
      router.replace(doneHref);
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

export function CreateFrame({
  title,
  lede,
  backHref,
  backLabel,
  accent,
  children,
}: {
  title: string;
  lede?: string;
  backHref: string;
  backLabel: string;
  accent: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const phone = useLayout().phone;
  const insets = useSafeAreaInsets();
  const body = (
    <View style={{ gap: space.lg, maxWidth: 720, width: '100%' }}>
      <Pressable accessibilityRole="button" onPress={() => router.push(backHref)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={16} color={accent} />
        <Text style={{ color: accent, fontSize: 14 }}>{backLabel}</Text>
      </Pressable>
      <View style={{ gap: space.sm, borderTopWidth: 3, borderTopColor: accent, paddingTop: space.md }}>
        <PageHeader title={title} subtitle={lede} />
        {children}
      </View>
    </View>
  );

  const phoneBody = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {body}
    </ScrollView>
  );
  const cockpit = useCockpit();
  useCockpitBody(cockpit && phone && Platform.OS === 'ios' ? phoneBody : null);

  if (Platform.OS === 'ios' && phone && cockpit) {
    return null;
  }

  if (Platform.OS === 'ios' && phone) {
    return phoneBody;
  }

  return body;
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
