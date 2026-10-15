import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { listAllOpportunities } from '@/api/endpoints';
import { Expenses } from '@/app/(app)/discover';
import type { Opportunity, OpportunityType } from '@/api/types';
import { Icon } from '@/components/icon';
import {
  AttentionTag,
  Button,
  CertaintySwatch,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  PressableRow,
  Segmented,
  T,
  Tag,
} from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { formatShortDate, relativeDay } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange } from '@/lib/money';
import { attentionFor, isGoodOutcome, missionGroup, missionKind, TYPE_META, TYPES, type Certainty, type MissionGroup } from '@/lib/mission';
import { navigation } from '@/lib/navigation';
import { resumeSellSetup } from '@/lib/sell';
import { useTheme } from '@/state/theme';

function useActivityUi() {
  const theme = useTheme();
  const styles = useMemo(() => createActivityStyles(theme.color), [theme.color]);

  return { ...theme, styles, typeScale: theme.type };
}

type Tab = 'open' | 'paused' | 'done';

const SECTIONS: Array<{ group: MissionGroup; title: string; hint: string }> = [
  { group: 'ready', title: 'Ready for you', hint: 'Something you can do now' },
  { group: 'waiting', title: 'Waiting on others', hint: 'Nothing to do until the date' },
  { group: 'idle', title: 'Needs a first step', hint: 'Your own missions without a step yet' },
];

export default function MissionsScreen() {
  const { color, styles, typeColor } = useActivityUi();
  const router = useRouter();
  const params = useLocalSearchParams<{ start?: string }>();
  const [tab, setTab] = useState<Tab>('open');
  const [type, setType] = useState<OpportunityType | null>(null);
  const [search, setSearch] = useState('');
  const layout = useLayout();
  const list = useQuery({ queryKey: ['opportunities', 'all'], queryFn: () => listAllOpportunities() });

  if (list.isLoading) {
    return <LoadingState label="Loading missions" />;
  }

  if (list.isError || !list.data) {
    return <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />;
  }

  const all = list.data;
  const query = search.trim().toLowerCase();
  const inTab = all.filter((mission) => {
    const group = missionGroup(mission);

    if (tab === 'open') {
      return group === 'ready' || group === 'waiting' || group === 'idle';
    }

    return group === tab;
  });
  const filtered = inTab
    .filter((mission) => type == null || mission.type === type)
    .filter((mission) => query === '' || mission.title.toLowerCase().includes(query));
  const counts = {
    open: all.filter((mission) => ['ready', 'waiting', 'idle'].includes(missionGroup(mission))).length,
    paused: all.filter((mission) => missionGroup(mission) === 'paused').length,
    done: all.filter((mission) => missionGroup(mission) === 'done').length,
  };

  if (all.length === 0) {
    return (
      <View style={{ gap: space.xl }}>
        <PageHeader title="All activity" subtitle="Sell, freelance, recoveries, and the occasional cost. The day-to-day lives in those areas." />
        <Panel padding="xl">
          <EmptyState
            icon="flag"
            title="Nothing here yet"
            body="Start from Sell, Freelance or Recover. This page is the full list, not the place you work from."
            action={
              <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
                <Button label="Sell" onPress={() => router.dismissTo('/sell')} />
                <Button label="Freelance" tone="secondary" onPress={() => router.dismissTo('/freelance')} />
                <Button label="Recover" tone="secondary" onPress={() => router.dismissTo('/recover')} />
                <Button label="Custom mission" tone="ghost" onPress={() => router.navigate('/opportunities/new')} />
              </View>
            }
          />
        </Panel>
      </View>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <PageHeader
        title="All activity"
        subtitle={`${counts.open} in play${counts.done > 0 ? ` · ${counts.done} done` : ''}. Costs you reviewed stay here too.`}
        action={
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Button label="Custom mission" tone="secondary" onPress={() => router.navigate('/opportunities/new')} />
            <Button label="Review a cost" tone="secondary" onPress={() => router.setParams({ start: 'cost' })} />
          </View>
        }
      />

      {params.start === 'cost' ? <Expenses /> : null}
      <View style={styles.toolbar}>
        <Segmented
          value={tab}
          options={[
            { value: 'open', label: `In play ${counts.open}` },
            { value: 'paused', label: `Paused ${counts.paused}` },
            { value: 'done', label: `Done ${counts.done}` },
          ]}
          onChange={setTab}
        />
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', alignItems: 'center' }}>
          {TYPES.map((item) => {
            const selected = type === item;
            const tint = typeColor[item];

            return (
              <Pressable
                key={item}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => setType(selected ? null : item)}
                style={[styles.typeFilter, selected && { backgroundColor: tint.soft, borderColor: tint.base }]}
              >
                <Icon name={TYPE_META[item].icon} size={15} color={selected ? tint.ink : color.ink2} weight={selected ? 'fill' : 'regular'} />
                <Text style={[styles.typeFilterText, selected && { color: tint.ink }]}>{TYPE_META[item].label}</Text>
              </Pressable>
            );
          })}
          <View style={{ width: layout.phone ? '100%' : 200 }}>
            <Field value={search} onChangeText={setSearch} placeholder="Search" accessibilityLabel="Search missions" />
          </View>
        </View>
      </View>

      {filtered.length === 0 ? (
        <Panel padding="lg">
          <EmptyState
            icon={tab === 'done' ? 'trophy' : tab === 'paused' ? 'pause' : 'search'}
            title={query || type ? 'Nothing matches' : tab === 'done' ? 'Nothing finished yet' : tab === 'paused' ? 'Nothing paused' : 'Nothing in play'}
            body={
              query || type
                ? 'Try another type, or clear the search.'
                : tab === 'done'
                  ? 'Finished missions land here, with what they brought in.'
                  : tab === 'paused'
                    ? 'Pause a mission when it is not the right time. It stays out of the way until you resume it.'
                    : 'Start from Sell, Freelance, or Recover.'
            }
          />
        </Panel>
      ) : tab === 'open' ? (
        SECTIONS.map((section) => {
          const rows = filtered
            .filter((mission) => missionGroup(mission) === section.group)
            .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

          if (rows.length === 0) {
            return null;
          }

          return (
            <View key={section.group} style={{ gap: space.xs }}>
              <View style={styles.sectionHead}>
                <T variant="eyebrow" color={color.ink}>{section.title}</T>
                <T variant="small" color={color.ink3}>{rows.length} · {section.hint}</T>
              </View>
              <Panel padding="none" style={{ paddingVertical: space.xxs }}>
                {rows.map((mission) => (
                  <MissionRow key={mission.id} mission={mission} />
                ))}
              </Panel>
            </View>
          );
        })
      ) : (
        <Panel padding="none" style={{ paddingVertical: space.xxs }}>
          {filtered.map((mission) => (
            <MissionRow key={mission.id} mission={mission} />
          ))}
        </Panel>
      )}
    </View>
  );
}

function sortKey(mission: Opportunity): string {
  return mission.next_action?.due_on ?? `9999${mission.title}`;
}

function moneyFor(mission: Opportunity): { text: string; certainty: Certainty } | null {
  if (mission.status === 'completed' || mission.status === 'abandoned') {
    return null;
  }

  if (mission.expected_amount_minor != null) {
    return { text: formatAmount(mission.expected_amount_minor, mission.currency), certainty: 'expected' };
  }

  const range = formatAmountRange(mission.potential_min_minor, mission.potential_max_minor, mission.currency);

  return range ? { text: range, certainty: 'possible' } : null;
}

function MissionRow({ mission }: { mission: Opportunity }) {
  const { color, styles, typeColor, typeScale } = useActivityUi();
  const router = useRouter();
  // A Sell mission opens its product. That is a top-level page, so the coordinator closes this one first.
  const open = () => {
    if (resumeSellSetup(mission.sell_item_id, mission.setup_done)) {
      return;
    }

    if (mission.sell_item_id != null) {
      navigation.openProduct(mission.sell_item_id);
      return;
    }

    router.navigate(`/opportunities/${mission.id}`);
  };
  const layout = useLayout();
  const group = missionGroup(mission);
  const next = mission.next_action;
  const attention = group === 'ready' ? attentionFor(next?.due_on) : null;
  const money = moneyFor(mission);

  let nextLine: string;
  if (group === 'done') {
    nextLine = mission.completed_at ? `Finished ${formatShortDate(mission.completed_at)}` : 'Finished';
  } else if (group === 'paused') {
    nextLine = 'Paused';
  } else if (group === 'waiting' && next?.due_on) {
    nextLine = `${next.title} ${relativeDay(next.due_on)}`;
  } else if (next) {
    nextLine = `Next: ${next.title}`;
  } else if (mission.playbook) {
    nextLine = 'Report what happened';
  } else {
    nextLine = 'Add a first step';
  }

  return (
    <PressableRow onPress={open} style={styles.row} accessibilityLabel={mission.title}>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
          <T variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{mission.title}</T>
        </View>
        <Text numberOfLines={1} style={typeScale.small}>
          <Text style={{ color: typeColor[mission.type].ink, fontFamily: font.semi }}>{missionKind(mission)}</Text>
          <Text> · {mission.status === 'paused' ? 'Paused' : mission.stage_label}</Text>
          {layout.desktop ? null : <Text> · {nextLine}</Text>}
        </Text>
      </View>
      {layout.desktop ? (
        <View style={styles.nextCol}>
          {group === 'waiting' ? <Icon name="hourglass" size={15} color={color.ink3} /> : group === 'done' ? <Icon name={isGoodOutcome(mission.outcome) ? 'checkCircle' : 'flag'} size={15} color={isGoodOutcome(mission.outcome) ? color.money : color.ink3} /> : null}
          <T variant="small" numberOfLines={1} color={group === 'ready' ? color.ink : color.ink2} style={{ flex: 1 }}>{nextLine}</T>
        </View>
      ) : null}
      {attention && attention !== 'later' && !layout.phone ? <AttentionTag attention={attention} /> : null}
      <View style={[styles.moneyCol, layout.phone && { minWidth: 0 }]}>
        {money ? (
          <>
            <CertaintySwatch certainty={money.certainty} size={10} />
            <Text style={[typeScale.figure, { fontSize: 15, color: money.certainty === 'possible' ? color.ink2 : color.ink }]}>{money.text}</Text>
          </>
        ) : group === 'done' && isGoodOutcome(mission.outcome) ? (
          <Tag label="Banked" icon="check" tint={color.moneyInk} bg={color.moneySoft} />
        ) : null}
      </View>
      <Icon name="caretRight" size={15} color={color.ink3} />
    </PressableRow>
  );
}

function createActivityStyles(color: Palette) {
  return StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  typeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: color.surface,
  },
  typeFilterText: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 14, color: color.ink2 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingHorizontal: space.xxs },
  row: { marginHorizontal: space.xxs, paddingVertical: 14 },
  nextCol: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 280 },
  moneyCol: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 110 },
  });
}
