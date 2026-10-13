import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { createListedItem, getSellCatalog } from '@/api/endpoints';
import { ChoiceBlock, JourneyContinue, SellJourney } from '@/components/sell-flow';
import { Field, InlineError, LoadingState, MoneyField } from '@/components/ui';
import { space } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { majorToMinor } from '@/lib/money';
import { navigation } from '@/lib/navigation';
import { rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useRefreshProduct } from '@/state/query';

export default function ListedItemScreen() {
  const refresh = useRefreshProduct();
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: ['sell', 'catalog'], queryFn: getSellCatalog });
  const [category, setCategory] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [url, setUrl] = useState('');
  const [asking, setAsking] = useState('');
  const [listedOn, setListedOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const title = name.trim();
    const price = majorToMinor(asking);

    if (!category) {
      setError('Pick what kind of thing it is.');
      return;
    }

    if (title === '') {
      setError('Name the item.');
      return;
    }

    if (place.trim() === '') {
      setError('Where is it listed?');
      return;
    }

    if (price == null) {
      setError('Enter the asking price.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await createListedItem({
        title,
        category,
        listed_on: place.trim(),
        listing_url: url.trim() || null,
        asking_price_minor: price,
        listed_on_date: listedOn.trim() || null,
      });
      const token = startSellWrite(created.data.id);
      await rememberSellItem(client, created.data, token);
      await refresh();
      await rememberSellItem(client, created.data, token);
      navigation.finishCreation('Listing added');
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <SellJourney
      step="estimate"
      title="It's already listed"
      lede="We'll track the asking price. You can add photos after."
      onExit={() => navigation.closeExperience()}
      footer={<JourneyContinue label="Add the listing" busy={busy} onPress={() => void save()} />}
    >
      {catalog.isLoading ? <LoadingState label="Loading" /> : null}
      <Field label="What are you selling?" value={name} onChangeText={setName} placeholder="Versace jacket" large />
      <View style={{ gap: space.sm }}>
        {(catalog.data?.data.categories ?? []).map((item) => (
          <ChoiceBlock key={item.key} label={item.label} icon={item.icon} selected={category === item.key} onPress={() => setCategory(item.key)} />
        ))}
      </View>
      <Field label="Where is it listed?" value={place} onChangeText={setPlace} placeholder="Vinted" />
      <Field label="Listing link" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" hint="Optional" />
      <MoneyField label="Asking price" value={asking} onChangeText={setAsking} />
      <Field label="Listed on" value={listedOn} onChangeText={setListedOn} placeholder="2026-10-01" hint="Optional" />
      {error ? <InlineError message={error} /> : null}
    </SellJourney>
  );
}
