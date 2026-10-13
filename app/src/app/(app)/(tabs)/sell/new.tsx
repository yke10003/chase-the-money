import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { createSellItem, getSellCatalog } from '@/api/endpoints';
import { ChoiceBlock, JourneyContinue, SellJourney, useLeaveSell } from '@/components/sell-flow';
import { InlineError, LoadingState } from '@/components/ui';
import { space } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useRefreshProduct } from '@/state/query';

export default function SellNewScreen() {
  const router = useRouter();
  const leave = useLeaveSell();
  const refresh = useRefreshProduct();
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: ['sell', 'catalog'], queryFn: getSellCatalog });
  const [phase, setPhase] = useState<'category' | 'sub'>('category');
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = catalog.data?.data.categories.find((item) => item.key === category) ?? null;

  async function create(nextCategory: string, nextSubcategory: string | null) {
    setBusy(true);
    setError(null);

    try {
      const created = await createSellItem({ category: nextCategory, subcategory: nextSubcategory });
      const token = startSellWrite(created.data.id);
      await rememberSellItem(client, created.data, token);
      await refresh();
      await rememberSellItem(client, created.data, token);
      router.replace(`/sell/setup/${created.data.id}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  function continueOn() {
    if (!chosen) {
      return;
    }

    if (phase === 'category') {
      if (chosen.subcategories.length === 1) {
        void create(chosen.key, chosen.subcategories[0].key);
        return;
      }

      setPhase('sub');
      return;
    }

    if (subcategory) {
      void create(chosen.key, subcategory);
    }
  }

  return (
    <SellJourney
      step="category"
      title={phase === 'sub' ? 'Which kind?' : 'What kind of thing are you selling?'}
      lede={phase === 'sub' ? chosen?.label : 'This shapes the photos and the questions.'}
      onBack={phase === 'sub' ? () => setPhase('category') : undefined}
      onExit={leave}
      footer={<JourneyContinue label="Continue" busy={busy} disabled={phase === 'sub' ? subcategory == null : category == null} onPress={continueOn} />}
    >
      {catalog.isLoading ? <LoadingState label="Loading" /> : null}
      {error ? <InlineError message={error} /> : null}
      {phase === 'category' ? (
        <View style={{ gap: space.sm }}>
          {(catalog.data?.data.categories ?? []).map((item) => (
            <ChoiceBlock key={item.key} label={item.label} icon={item.icon} selected={category === item.key} onPress={() => { setCategory(item.key); setSubcategory(null); }} />
          ))}
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          {chosen?.subcategories.map((item) => (
            <ChoiceBlock key={item.key} label={item.label} selected={subcategory === item.key} onPress={() => setSubcategory(item.key)} />
          ))}
        </View>
      )}
    </SellJourney>
  );
}
