import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { completeAction, getSellItem } from '@/api/endpoints';
import { Icon } from '@/components/icon';
import { Button, Field, InlineError, LoadingState, MoneyField, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange, majorToMinor } from '@/lib/money';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

export default function SellItemScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const refresh = useRefreshProduct();
  const { color, typeColor } = useTheme();
  const phone = useLayout().phone;
  const sell = typeColor.sell;
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = itemQuery.data?.data;

  if (itemQuery.isLoading || !item) {
    return <LoadingState label="Loading the item" />;
  }

  if (itemQuery.isError) {
    return <InlineError message={errorMessage(itemQuery.error)} />;
  }

  const record = item;
  const range = formatAmountRange(record.value_min_minor, record.value_max_minor, record.currency);
  const asking = item.asking_price_minor != null ? formatAmount(item.asking_price_minor, item.currency) : null;
  const next = item.next;

  async function finishAction() {
    if (!next) {
      return;
    }

    const input: Record<string, unknown> = {};

    for (const field of next.fields ?? []) {
      const raw = values[field.key] ?? '';

      if (field.type === 'money') {
        if (raw.trim() === '' && !field.required) {
          continue;
        }

        const amount = majorToMinor(raw);

        if (amount == null) {
          setError(`Enter ${field.label.toLowerCase()}.`);
          return;
        }

        input[field.key] = amount;
      } else if (raw.trim() !== '') {
        input[field.key] = raw.trim();
      } else if (field.required) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      await completeAction(record.opportunity_id, next.id, input);
      await refresh();
      await itemQuery.refetch();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.lg, paddingBottom: 40 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Sell" onPress={() => router.replace('/sell')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={16} color={sell.ink} />
        <Text style={{ color: sell.ink }}>Sell</Text>
      </Pressable>
      <View style={{ flexDirection: phone ? 'column' : 'row', gap: space.xl, alignItems: 'flex-start' }}>
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} accessibilityLabel={item.name ?? 'Item photo'} style={{ width: phone ? '100%' : 360, aspectRatio: 1, borderRadius: 20 }} />
      ) : (
        <View style={{ width: phone ? '100%' : 360, height: phone ? 180 : 360, borderRadius: 20, backgroundColor: sell.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.display, fontWeight: weight.bold, fontSize: 48, color: sell.ink }}>{(item.name ?? 'Item').trim().charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, flexShrink: 1, gap: space.lg, minWidth: 0, maxWidth: phone ? '100%' : 520 }}>
      <View style={{ gap: 4 }}>
        <T variant="eyebrow">{item.subcategory_label ?? item.category_label}</T>
        <T variant="title">{item.name ?? 'Untitled item'}</T>
        {range ? <T variant="body">{range} possible</T> : null}
        {asking ? <T variant="body" color={color.ink2}>{asking} asking{item.listed_on ? ` on ${item.listed_on}` : ''}</T> : null}
        {!item.setup_done ? <T variant="body" color={color.ink2}>Setup incomplete. Next: {item.next_step_label}</T> : <T variant="small" color={color.ink3}>{item.stage_label}</T>}
      </View>
      {item.photos.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {item.photos.slice(0, 6).map((photo) => (
            <Image key={photo.id} source={{ uri: photo.url }} style={{ width: 64, height: 64, borderRadius: 10 }} />
          ))}
        </View>
      ) : null}
      {!item.setup_done ? <Button label="Continue setup" iconRight="arrowRight" size="lg" onPress={() => router.push(`/sell/setup/${item.id}`)} /> : null}
      {item.setup_done && next ? (
        <View style={{ gap: space.md }}>
          <T variant="heading">{next.title}</T>
          {next.description ? <T variant="body" color={color.ink2}>{next.description}</T> : null}
          {(next.fields ?? []).map((field) => field.type === 'money' ? (
            <MoneyField key={field.key} label={field.label} value={values[field.key] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
          ) : (
            <Field key={field.key} label={field.label} value={values[field.key] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} autoCapitalize={field.key.includes('url') ? 'none' : 'sentences'} />
          ))}
          {error ? <InlineError message={error} /> : null}
          <Button label={next.completion === 'form' ? 'Save' : 'Done'} size="lg" busy={busy} onPress={() => void finishAction()} />
        </View>
      ) : null}
      {item.comparables.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <T variant="eyebrow">Similar sales</T>
          {item.comparables.map((comparable) => (
            <Text key={comparable.id} style={{ color: color.ink2 }}>{comparable.state === 'sold' ? 'Sold' : 'Asking'} {formatAmount(comparable.amount_minor, item.currency)} · {comparable.platform}</Text>
          ))}
        </View>
      ) : null}
      </View>
      </View>
    </View>
  );
}
