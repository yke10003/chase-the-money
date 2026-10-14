import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Children, useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import { getCurrentGoal, getDiscover, getProgress, getSellCatalog, listAllOpportunities, listSellItems } from '@/api/endpoints';
import type { Opportunity, SellItemView } from '@/api/types';
import { MoneyHunt } from '@/app/(app)/discover';
import { Icon } from '@/components/icon';
import { ActionRow, CockpitFrame, Sheet } from '@/components/moves';
import { ScoreHero } from '@/components/score-hero';
import { sellIcon } from '@/components/sell-flow';
import { ErrorState, LinkButton, LoadingState, T } from '@/components/ui';
import { categoryIcon, showsOnSellBoard } from '@/lib/sell-cache';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { useTheme } from '@/state/theme';
import { askingMinor, areaOf } from '@/lib/areas';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange } from '@/lib/money';
import { navRequest } from '@/lib/nav-log';
import { navigation } from '@/lib/navigation';
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
  const goal = useQuery({ queryKey: ['goal', 'current'], queryFn: getCurrentGoal });
  const discover = useQuery({ queryKey: ['discover'], queryFn: getDiscover, enabled: hunt });
  const progress = useQuery({ queryKey: ['progress', 'goal', 'sell'], queryFn: () => getProgress('goal', 'sell') });

  useEffect(() => {
    if (params.start === 'hunt') {
      setHunt(true);
    }
  }, [params.start]);

  const listLoading = list.isPending && list.data == null;
  const listFailed = !listLoading && (list.isError || !list.data);

  if (!layout.phone && listLoading) {
    return <LoadingState label="Loading what you're selling" />;
  }

  if (!layout.phone && listFailed) {
    return <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />;
  }

  const open = (list.data ?? []).filter((mission) => areaOf(mission) === 'sell' && missionGroup(mission) !== 'done' && missionGroup(mission) !== 'paused');
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
            kicker={layout.phone ? '' : 'This goal'}
            amount={formatAmount(made, currency)}
            caption="made selling"
            metrics={[
              ...(possible ? [{ label: 'possible', value: possible }] : []),
              { label: open.length === 1 ? 'item in progress' : 'items in progress', value: String(open.length) },
            ]}
            series={progress.data?.data.series}
            actions={[
              { label: 'Sell something', icon: 'plus', onPress: () => navigation.startCreation('sell') },
              {
                label: 'Find something',
                icon: 'search',
                onPress: () => {
                  navRequest('sell.hunt.toggle', { open: !hunt, loaded: discover.data != null });
                  setHunt(!hunt);
                },
              },
            ]}
          />
        }
        below={
          <View style={{ gap: space.lg }}>
            {/* First, so it opens where the resting cockpit sheet shows its top, not below the board. */}
            {hunt ? (discover.data ? <MoneyHunt categories={discover.data.data.money_hunt_categories} /> : <LoadingState label="Loading the hunt" />) : null}
            {listFailed ? <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} /> : null}
            {offers.length > 0 ? <T variant="bodyStrong">{offers.length === 1 ? '1 offer to answer' : `${offers.length} offers to answer`}</T> : null}
            <SellBoard
              empty={open.length > 0 ? (
                <ProductGrid columns={productColumns(layout)}>
                  {open.map((mission) => (
                    <LegacyCard key={mission.id} mission={mission} onPress={() => navigation.openMission(mission.id, { sellItemId: mission.sell_item_id })} />
                  ))}
                </ProductGrid>
              ) : listLoading ? null : (
                <T variant="body" color={color.ink2}>Nothing for sale yet.</T>
              )}
            />
            <ActionRow title="Already listed" detail="It’s on a marketplace. Track it here." icon="link" iconColor={paint.from} onPress={() => navigation.startCreation('sell-listed')} />
            <LinkButton label="Marketplaces aren’t connected" tint={color.ink3} onPress={() => setMarkets(true)} />
            {/* Part of the cockpit sheet's content, so React Native presents it from the sheet on screen (navigation.md, React Native Modals). */}
            <Sheet visible={markets} title="Marketplaces" onClose={() => setMarkets(false)}>
              <T variant="body" color={color.ink2}>Vinted, Marktplaats and Grailed aren’t connected. You list it there. This app keeps the price, the offer and whether it sold.</T>
              <T variant="small" color={color.ink3}>One item can only sit in one place for now. Several listings for the same item comes later.</T>
            </Sheet>
          </View>
        }
      />
    </>
  );
}

const GRID_GAP = 10;

/** Phone stays at two. Wider screens add a column, and stop at four. */
function productColumns(layout: { phone: boolean; tablet: boolean }): number {
  if (layout.phone) {
    return 2;
  }

  if (layout.tablet) {
    return 3;
  }

  return 4;
}

function ProductGrid({ columns, children }: { columns: number; children: ReactNode }) {
  const basis = `${100 / columns}%`;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -GRID_GAP / 2 }}>
      {Children.map(children, (child) => (
        <View style={{ width: basis as `${number}%`, maxWidth: basis as `${number}%`, paddingHorizontal: GRID_GAP / 2, marginBottom: space.lg }}>
          {child}
        </View>
      ))}
    </View>
  );
}

function itemMoney(item: SellItemView): string | null {
  const estimate = formatAmountRange(item.value_min_minor, item.value_max_minor, item.currency);

  if (estimate) {
    return estimate;
  }

  if (item.asking_price_minor == null) {
    return null;
  }

  return formatAmount(item.asking_price_minor, item.currency);
}

function itemStep(item: SellItemView): string {
  return item.setup_done ? item.stage_label : item.next_step_label;
}

function SellBoard({ empty }: { empty: ReactNode }) {
  const { color } = useTheme();
  const layout = useLayout();
  const router = useRouter();
  const items = useQuery({ queryKey: ['sell', 'items'], queryFn: async () => (await listSellItems()).data });
  const catalog = useQuery({ queryKey: ['sell', 'catalog'], queryFn: getSellCatalog });
  const visible = (items.data ?? []).filter(showsOnSellBoard);

  useEffect(() => {
    for (const item of items.data ?? []) {
      if (!item.cover_url) {
        continue;
      }

      Image.prefetch(mediaUrl(item.cover_url)).catch(() => {});
    }
  }, [items.data]);

  if (items.isPending && items.data == null) {
    return <LoadingState label="Loading what you're selling" />;
  }

  if (visible.length === 0) {
    if ((items.data ?? []).length > 0) {
      return <T variant="body" color={color.ink2}>Nothing for sale yet.</T>;
    }

    return <>{empty}</>;
  }

  return (
    <ProductGrid columns={productColumns(layout)}>
      {visible.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          icon={categoryIcon(catalog.data?.data.categories, item.category)}
          onPress={() => {
            navRequest('product.open.request', { id: item.id, from: 'sell', setupDone: item.setup_done });
            navigation.openProduct(item.id, 'sell');
          }}
        />
      ))}
    </ProductGrid>
  );
}

function ItemCard({ item, icon, onPress }: { item: SellItemView; icon: string; onPress: () => void }) {
  return (
    <ProductCard
      title={item.name?.trim() || 'Untitled item'}
      step={itemStep(item)}
      money={itemMoney(item)}
      photoUrl={item.cover_url}
      icon={icon}
      onPress={onPress}
    />
  );
}

function LegacyCard({ mission, onPress }: { mission: Opportunity; onPress: () => void }) {
  return (
    <ProductCard
      title={mission.title}
      step={mission.stage_label}
      money={formatAmountRange(mission.potential_min_minor, mission.potential_max_minor, mission.currency)}
      photoUrl={null}
      icon="package"
      onPress={onPress}
    />
  );
}

function ProductCard({
  title,
  step,
  money,
  photoUrl,
  icon,
  onPress,
}: {
  title: string;
  step: string;
  money: string | null;
  photoUrl: string | null;
  icon: string;
  onPress: () => void;
}) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${money ?? 'not valued'}, ${step}`}
      onPress={onPress}
      style={({ pressed }) => ({ width: '100%', opacity: pressed ? 0.72 : 1 })}
    >
      <View style={[styles.card, { backgroundColor: color.surface, borderColor: color.line }]}>
        <View style={[styles.photo, { backgroundColor: color.sunken }]}>
          {photoUrl ? (
            <Image key={photoUrl} source={{ uri: mediaUrl(photoUrl) }} accessibilityLabel="" resizeMode="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={styles.fallback}>
              <Icon name={sellIcon(icon)} size={64} color={color.ink} weight="duotone" />
            </View>
          )}
        </View>
        <View style={[styles.info, { borderTopColor: color.line }]}>
          <Text numberOfLines={2} style={[styles.title, { color: color.ink }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.step, { color: color.ink2 }]}>{step}</Text>
        </View>
        <View style={[styles.footer, { backgroundColor: color.footer, borderTopColor: color.line }]}>
          <Text numberOfLines={1} style={[styles.money, { color: money ? color.ink : color.ink2 }]}>{money ?? 'Not valued'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1, overflow: 'hidden' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 2, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 62 },
  footer: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  title: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 15, lineHeight: 18 },
  step: { fontFamily: font.body, fontWeight: weight.regular, fontSize: 13, lineHeight: 16 },
  money: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 15, lineHeight: 20 },
});
