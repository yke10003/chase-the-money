import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { getCurrentGoal, getDiscover, getProgress, listAllOpportunities, listSellItems } from '@/api/endpoints';
import type { Opportunity, SellItemView } from '@/api/types';
import { MoneyHunt } from '@/app/(app)/discover';
import { ActionRow, CockpitFrame, Sheet } from '@/components/moves';
import { ObjectFallback, ScoreHero } from '@/components/score-hero';
import { ErrorState, LinkButton, LoadingState, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { useTheme } from '@/state/theme';
import { askingMinor, areaOf } from '@/lib/areas';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange } from '@/lib/money';
import { missionGroup } from '@/lib/mission';

export default function SellScreen() {
  const { color, accent } = useTheme();
  const layout = useLayout();
  const paint = accent.sell;
  const params = useLocalSearchParams<{ start?: string }>();
  const router = useRouter();
  const [hunt, setHunt] = useState(params.start === 'hunt');
  const [markets, setMarkets] = useState(false);
  const list = useQuery({ queryKey: ['opportunities', 'all'], queryFn: () => listAllOpportunities() });
  const items = useQuery({ queryKey: ['sell', 'items'], queryFn: async () => (await listSellItems()).data });
  const goal = useQuery({ queryKey: ['goal', 'current'], queryFn: getCurrentGoal });
  const discover = useQuery({ queryKey: ['discover'], queryFn: getDiscover, enabled: hunt });
  const progress = useQuery({ queryKey: ['progress', 'goal', 'sell'], queryFn: () => getProgress('goal', 'sell') });

  useEffect(() => {
    if (params.start === 'hunt') {
      setHunt(true);
    }
  }, [params.start]);

  if (list.isLoading) {
    return <LoadingState label="Loading what you're selling" />;
  }

  if (list.isError || !list.data) {
    return <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />;
  }

  const open = list.data.filter((mission) => areaOf(mission) === 'sell' && missionGroup(mission) !== 'done' && missionGroup(mission) !== 'paused');
  const offers = open.filter((mission) => mission.stage === 'offer');
  const currency = open[0]?.currency ?? goal.data?.currency ?? progress.data?.data.currency ?? 'EUR';
  const made = progress.data?.data.realized_sell_minor ?? 0;
  const possibleMax = open.reduce((sum, mission) => sum + (mission.potential_max_minor ?? askingMinor(mission) ?? 0), 0);
  const possibleMin = open.reduce((sum, mission) => sum + (mission.potential_min_minor ?? askingMinor(mission) ?? 0), 0);
  const possible = possibleMax > 0 ? formatAmountRange(possibleMin || null, possibleMax, currency) : null;

  return (
    <>
      <CockpitFrame
        title="Sell"
        moves={
          <ScoreHero
            wash="sell"
            paint={paint}
            kicker={layout.phone ? 'Sell' : 'This goal'}
            amount={formatAmount(made, currency)}
            caption="made selling"
            metrics={[
              ...(possible ? [{ label: 'possible', value: possible }] : []),
              { label: open.length === 1 ? 'item in progress' : 'items in progress', value: String(open.length) },
            ]}
            series={progress.data?.data.series}
            actions={[
              { label: 'Sell something', icon: 'plus', onPress: () => router.push('/sell/new') },
              { label: 'Find something', icon: 'search', onPress: () => setHunt((value) => !value) },
            ]}
          />
        }
        below={
          <View style={{ gap: space.lg }}>
            {offers.length > 0 ? <T variant="bodyStrong">{offers.length === 1 ? '1 offer to answer' : `${offers.length} offers to answer`}</T> : null}
            {(items.data ?? []).length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
                {(items.data ?? []).map((item) => (
                  <View key={item.id} style={{ width: layout.phone ? '100%' : '50%', padding: 6 }}>
                    <ItemCard item={item} onPress={() => router.push(item.setup_done ? `/sell/items/${item.id}` : `/sell/setup/${item.id}`)} />
                  </View>
                ))}
              </View>
            ) : open.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
                {open.map((mission) => (
                  <View key={mission.id} style={{ width: layout.phone ? '100%' : '50%', padding: 6 }}>
                    <LegacyCard mission={mission} onPress={() => router.push(`/opportunities/${mission.id}`)} />
                  </View>
                ))}
              </View>
            ) : (
              <T variant="body" color={color.ink2}>Nothing for sale yet.</T>
            )}
            <ActionRow title="Already listed" detail="It’s on a marketplace. Track it here." icon="link" iconColor={paint.from} onPress={() => router.push('/sell/listed')} />
            <LinkButton label="Marketplaces aren’t connected" tint={color.ink3} onPress={() => setMarkets(true)} />
            {hunt ? (discover.data ? <MoneyHunt categories={discover.data.data.money_hunt_categories} /> : <LoadingState label="Loading the hunt" />) : null}
          </View>
        }
      />
      <Sheet visible={markets} title="Marketplaces" onClose={() => setMarkets(false)}>
        <T variant="body" color={color.ink2}>Vinted, Marktplaats and Grailed aren’t connected. You list it there. This app keeps the price, the offer and whether it sold.</T>
        <T variant="small" color={color.ink3}>One item can only sit in one place for now. Several listings for the same item comes later.</T>
      </Sheet>
    </>
  );
}

function ItemCard({ item, onPress }: { item: SellItemView; onPress: () => void }) {
  const { color, accent } = useTheme();
  const paint = accent.sell;
  const range = formatAmountRange(item.value_min_minor, item.value_max_minor, item.currency);
  const asking = item.asking_price_minor != null ? formatAmount(item.asking_price_minor, item.currency) : null;
  const price = asking ?? range;
  const priceLabel = asking ? 'asking' : range ? 'possible' : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: color.surface }}
    >
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} accessibilityLabel="" style={{ width: '100%', height: 180 }} />
      ) : (
        <ObjectFallback label={item.name ?? 'Item'} paint={paint} />
      )}
      <View style={{ padding: space.md, gap: 4 }}>
        <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 17, color: color.ink }}>{item.name ?? 'Untitled item'}</Text>
        {price ? <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 15, color: color.ink2 }}>{price} {priceLabel}</Text> : null}
        <Text style={{ fontSize: 13, color: color.ink3 }}>{item.setup_done ? item.stage_label : 'Setup incomplete'}</Text>
        <Text style={{ fontSize: 14, color: color.ink, marginTop: 6 }}>{item.setup_done ? (item.next?.title ?? 'Open') : `Continue · ${item.next_step_label}`} →</Text>
      </View>
    </Pressable>
  );
}

function LegacyCard({ mission, onPress }: { mission: Opportunity; onPress: () => void }) {
  const { color, accent } = useTheme();
  const paint = accent.sell;
  const range = formatAmountRange(mission.potential_min_minor, mission.potential_max_minor, mission.currency);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: color.surface }}>
      <ObjectFallback label={mission.title} paint={paint} />
      <View style={{ padding: space.md, gap: 4 }}>
        <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 17, color: color.ink }}>{mission.title}</Text>
        {range ? <Text style={{ fontSize: 15, color: color.ink2 }}>{range} possible</Text> : null}
        <Text style={{ fontSize: 13, color: color.ink3 }}>{mission.stage_label}</Text>
      </View>
    </Pressable>
  );
}
