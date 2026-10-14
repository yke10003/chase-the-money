import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import { getHome, getProgress, listAllOpportunities } from '@/api/endpoints';
import type { Goal, HomeView, Opportunity, OpportunityType, StarterMission, SuggestedAction } from '@/api/types';
import { Icon, type IconName } from '@/components/icon';
import { ActionQueue, ActionRow } from '@/components/moves';
import { MobileStage, ScoreHero, homePaint } from '@/components/score-hero';
import { ErrorState, LoadingState, Segmented, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette } from '@/design/palette';
import { font, radius, space, type as bareType, weight } from '@/design/tokens';
import { dateParts } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { goalPeriodName } from '@/lib/goal';
import { formatAmount, formatAmountRange } from '@/lib/money';
import { describeProgress, missionGroup, type Attention } from '@/lib/mission';
import { navigation } from '@/lib/navigation';
import { useTheme } from '@/state/theme';

function useHomeStyles() {
  const theme = useTheme();
  const styles = useMemo(() => createHomeStyles(theme.color, theme.scheme), [theme.color, theme.scheme]);

  return { ...theme, styles, typeScale: theme.type };
}

const TIMES = [
  { value: '10', label: '10 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: 'any', label: 'Any' },
] as const;

type TimeValue = (typeof TIMES)[number]['value'];

const STARTER_TYPES: Record<string, OpportunityType | 'build'> = {
  value_item: 'sell',
  colleagues: 'earn',
  build: 'build',
  recover: 'recover',
  expense: 'save',
};

const STARTER_ICONS: Record<string, IconName> = {
  value_item: 'tag',
  colleagues: 'chat',
  build: 'lightbulb',
  recover: 'handCoins',
  expense: 'scissors',
};

const STARTER_HREFS: Record<string, string> = {
  money_hunt: '/sell?start=hunt',
  recovery: '/recover?start=find',
  expenses: '/opportunities?start=cost',
  skills: '/freelance?start=message',
  freelance_colleagues: '/freelance?start=message',
  build: '/build',
};

export default function HomeScreen() {
  const params = useLocalSearchParams<{ welcome?: string }>();
  const [time, setTime] = useState<TimeValue>('any');
  const minutes = time === 'any' ? null : Number(time);
  const home = useQuery({ queryKey: ['home', minutes], queryFn: () => getHome(minutes), placeholderData: (previous) => previous });
  const missions = useQuery({ queryKey: ['opportunities', 'all'], queryFn: () => listAllOpportunities() });
  const layout = useLayout();
  const [welcome, setWelcome] = useState(params.welcome === '1');

  if (home.isLoading) {
    return <LoadingState label="Loading home" />;
  }

  if (home.isError || !home.data) {
    return <ErrorState message={errorMessage(home.error)} onRetry={() => home.refetch()} />;
  }

  const view = home.data.data;
  const all = missions.data ?? [];
  const waiting = all
    .filter((mission) => missionGroup(mission) === 'waiting')
    .sort((a, b) => (a.next_action?.due_on ?? '').localeCompare(b.next_action?.due_on ?? ''));
  const hasMissions = all.some((mission) => missionGroup(mission) !== 'done');
  const split = layout.width >= 1180 && (waiting.length > 0 || view.recent_wins.length > 0);

  const body = (
    <View style={{ flexDirection: split ? 'row' : 'column', gap: space.xl, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, width: split ? undefined : '100%', gap: space.lg, minWidth: 0 }}>
        <NowSection view={view} missions={all} time={time} onTime={setTime} hasMissions={hasMissions} everStarted={all.length > 0} />
      </View>
      {split || waiting.length > 0 || view.recent_wins.length > 0 ? (
        <View style={{ width: split ? 320 : '100%', gap: space.lg }}>
          <WaitingSection missions={waiting} />
          <WinsSection view={view} />
        </View>
      ) : null}
    </View>
  );

  if (layout.phone && view.goal) {
    return (
      <MobileStage title="Home" hero={<Scoreboard goal={view.goal} view={view} />}>
        {welcome ? <WelcomeBand goal={view.goal} onDismiss={() => setWelcome(false)} /> : null}
        {body}
      </MobileStage>
    );
  }

  return (
    <View style={{ gap: space.xxl }}>
      {welcome && view.goal ? <WelcomeBand goal={view.goal} onDismiss={() => setWelcome(false)} /> : null}
      {view.goal ? <Scoreboard goal={view.goal} view={view} /> : null}
      {body}
    </View>
  );
}

function WelcomeBand({ goal, onDismiss }: { goal: Goal; onDismiss: () => void }) {
  const { color, styles, typeScale } = useHomeStyles();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, useNativeDriver: false }).start();
  }, [enter]);

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
      <View style={styles.welcome}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[typeScale.heading, { color: color.onInk }]}>You’re set. Make the first move.</Text>
          <Text style={[typeScale.body, { color: '#3A3832' }]}>
            {formatAmount(goal.amount_minor, goal.currency)} this period. Start with whichever move feels easiest.
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={8}>
          <Icon name="x" size={18} color={color.onInk} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function Scoreboard({ goal, view }: { goal: Goal; view: HomeView }) {
  const progress = useQuery({ queryKey: ['progress', 'goal'], queryFn: () => getProgress('goal') });
  const possible = formatAmountRange(view.pipeline.potential_min_minor, view.pipeline.potential_max_minor, view.currency);
  const expected = view.pipeline.expected_amount_minor;
  const week = view.weekly_momentum;
  const metrics = [
    expected > 0 ? { label: 'expected', value: formatAmount(expected, view.currency) } : null,
    possible ? { label: 'possible', value: possible } : null,
  ].filter((metric): metric is { label: string; value: string } => metric !== null);

  return (
    <ScoreHero
      wash="home"
      paint={homePaint}
      kicker={goalPeriodName(goal)}
      amount={formatAmount(goal.realized_amount_minor, goal.currency)}
      caption={`of ${formatAmount(goal.amount_minor, goal.currency)} realized`}
      metrics={metrics}
      series={progress.data?.data.series}
      note={week.xp > 0 ? `+${week.xp} XP this week` : 'No XP this week'}
    />
  );
}

function NowSection({
  view,
  missions,
  time,
  onTime,
  hasMissions,
  everStarted,
}: {
  view: HomeView;
  missions: Opportunity[];
  time: TimeValue;
  onTime: (value: TimeValue) => void;
  hasMissions: boolean;
  everStarted: boolean;
}) {
  const { typeScale } = useHomeStyles();
  const [featured, ...rest] = view.suggested_actions;
  const nothingFits = time !== 'any' && view.suggested_actions.length === 0;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.md, flexWrap: 'wrap' }}>
        {featured ? null : <Text style={[typeScale.title, { fontSize: 28, lineHeight: 34 }]}>What do you want to move?</Text>}
        {hasMissions ? <View style={{ marginLeft: 'auto' }}><Segmented value={time} options={TIMES.map((item) => ({ value: item.value, label: item.label }))} onChange={onTime} /></View> : null}
      </View>

      {featured ? <FeaturedAction action={featured} missions={missions} /> : null}

      {rest.length > 0 ? (
        <ActionQueue>
          {rest.map((action) => (
            <ActionLine key={action.id} action={action} />
          ))}
        </ActionQueue>
      ) : null}

      {view.actions_without_estimate.length > 0 ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <T variant="eyebrow">When you have longer</T>
          <ActionQueue>
            {view.actions_without_estimate.map((action) => (
              <ActionLine key={action.id} action={action} />
            ))}
          </ActionQueue>
        </View>
      ) : null}

      {view.suggested_actions.length === 0 ? (
        <Starters
          missions={view.starter_missions}
          heading={
            nothingFits
              ? `Nothing open fits in ${TIMES.find((item) => item.value === time)?.label}.`
              : hasMissions
                ? 'Nothing needs you right now.'
                : everStarted
                  ? 'All clear.'
                  : null
          }
        />
      ) : null}
    </View>
  );
}

function FeaturedAction({ action, missions }: { action: SuggestedAction; missions: Opportunity[] }) {
  const { color, typeScale } = useHomeStyles();
  const mission = missions.find((item) => item.id === action.opportunity_id);
  const range = mission ? formatAmountRange(mission.potential_min_minor, mission.potential_max_minor, mission.currency) : null;
  const money = mission?.expected_amount_minor != null
    ? `${formatAmount(mission.expected_amount_minor, mission.currency)} expected`
    : range
      ? `${range} possible`
      : null;
  const attention = whyAttention(action.why);
  const status = attention === 'overdue' ? 'Overdue' : attention === 'today' ? 'Due today' : action.why;
  const minutes = timeLabel(action);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}, ${action.opportunity_title}`}
      onPress={() => navigation.openMission(action.opportunity_id, { sellItemId: action.sell_item_id })}
      style={(state) => [{
        gap: 6,
        padding: space.lg,
        borderRadius: 18,
        backgroundColor: color.surface,
      }, (state as PressableStateCallbackType & { hovered?: boolean }).hovered && { backgroundColor: color.sunken }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
    >
      <Text style={[typeScale.eyebrow, { color: color.ink3 }]}>Best next move</Text>
      <Text style={[typeScale.heading, { fontSize: 26, lineHeight: 32 }]}>{action.title}</Text>
      <Text style={[typeScale.body, { color: color.ink2 }]}>
        {action.opportunity_title}
        {status ? ` · ${status}` : ''}
      </Text>
      {money ? <Text style={[typeScale.figure, { fontSize: 20 }]}>{money}</Text> : null}
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', marginTop: 4 }}>
        {minutes ? <Text style={[typeScale.small, { color: color.ink3 }]}>{minutes}</Text> : null}
        {action.xp_reward ? <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 13, color: color.xp }}>+{action.xp_reward} XP</Text> : null}
      </View>
    </Pressable>
  );
}

function ActionLine({ action }: { action: SuggestedAction }) {
  const { color, accent } = useHomeStyles();
  const paint = accent[action.opportunity_type];
  const minutes = timeLabel(action);
  const attention = whyAttention(action.why);
  const status = attention === 'overdue' ? 'Overdue' : attention === 'today' ? 'Due today' : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}, ${action.opportunity_title}`}
      onPress={() => navigation.openMission(action.opportunity_id, { sellItemId: action.sell_item_id })}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 56,
        paddingVertical: 10,
        backgroundColor: (state as PressableStateCallbackType & { hovered?: boolean }).hovered ? color.sunken : 'transparent',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
      })}
    >
      <Icon name={iconFor(action.opportunity_type)} size={18} color={paint.from} />
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, color: color.ink }}>{action.title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: status ? color.overdue : color.ink2 }}>
          {action.opportunity_title}
          {minutes ? ` · ${minutes}` : ''}
          {status ? ` · ${status}` : ''}
        </Text>
      </View>
      {action.xp_reward ? <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 13, color: color.xp }}>+{action.xp_reward} XP</Text> : null}
    </Pressable>
  );
}

function whyAttention(why: string | null): Attention {
  if (why === 'Overdue') {
    return 'overdue';
  }

  if (why === 'Due today') {
    return 'today';
  }

  if (why === 'Due soon') {
    return 'soon';
  }

  return null;
}

function timeLabel(action: SuggestedAction): string | null {
  if (action.playbook_key === 'do_the_work') {
    return 'The work';
  }

  return action.estimated_minutes ? `~${action.estimated_minutes} min` : null;
}

function iconFor(type: OpportunityType): IconName {
  if (type === 'sell') {
    return 'tag';
  }

  if (type === 'recover') {
    return 'handCoins';
  }

  if (type === 'save') {
    return 'scissors';
  }

  return 'briefcase';
}

function Starters({ missions, heading }: { missions: StarterMission[]; heading: string | null }) {
  const { color, accent } = useHomeStyles();
  const router = useRouter();

  return (
    <View style={{ gap: space.md }}>
      {heading ? <T variant="body" color={color.ink2}>{heading}</T> : null}
      <ActionQueue>
        {missions.map((mission) => {
          const kind = STARTER_TYPES[mission.key] ?? 'earn';

          return (
            <ActionRow
              key={mission.key}
              title={mission.title}
              detail={mission.detail}
              icon={STARTER_ICONS[mission.key] ?? 'arrowRight'}
              iconColor={accent[kind === 'build' ? 'build' : kind].from}
              onPress={() => router.push(STARTER_HREFS[mission.destination] ?? '/sell')}
            />
          );
        })}
      </ActionQueue>
    </View>
  );
}

function WaitingSection({ missions }: { missions: Opportunity[] }) {
  const { typeScale } = useHomeStyles();

  if (missions.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: space.sm, width: '100%' }}>
      <T variant="eyebrow">Upcoming</T>
      {missions.slice(0, 6).map((mission, index) => {
        const due = mission.next_action?.due_on;
        const parts = due ? dateParts(due) : null;
        const money = mission.expected_amount_minor != null ? formatAmount(mission.expected_amount_minor, mission.currency) : null;

        return (
          <Pressable
            key={mission.id}
            accessibilityRole="button"
            onPress={() => navigation.openMission(mission.id, { sellItemId: mission.sell_item_id })}
            style={{ flexDirection: 'row', gap: space.md, alignItems: 'baseline', paddingTop: index === 0 ? 4 : 10 }}
          >
            <View style={{ width: 52 }}>
              <Text style={[typeScale.figure, { fontSize: 15 }]}>{parts ? parts.day : '—'}</Text>
              <Text style={typeScale.small}>{parts?.month ?? ''}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text numberOfLines={1} style={typeScale.bodyStrong}>{mission.title}</Text>
              <Text numberOfLines={1} style={typeScale.small}>
                {mission.next_action?.title ?? mission.stage_label}
                {money ? ` · ${money} expected` : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function WinsSection({ view }: { view: HomeView }) {
  const { color, styles } = useHomeStyles();
  if (view.recent_wins.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: space.sm, width: '100%' }}>
      <T variant="eyebrow">Recent</T>
      {view.recent_wins.slice(0, 5).map((win, index) => (
        <View key={`${win.kind}-${win.occurred_at}-${index}`} style={styles.win}>
          {win.kind === 'impact' && win.amount_minor != null && win.currency ? (
            <Text style={[styles.winAmount, { color: color.money }]}>+{formatAmount(win.amount_minor, win.currency)}</Text>
          ) : (
            <Text style={[styles.winAmount, { color: color.xp }]}>+{win.xp} XP</Text>
          )}
          <T variant="small" numberOfLines={1} style={{ flex: 1 }}>{describeProgress(win.title)}</T>
        </View>
      ))}
    </View>
  );
}

function createHomeStyles(color: Palette, _scheme: 'dark' | 'light') {
  return StyleSheet.create({
  welcome: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: color.ink, borderRadius: radius.lg, padding: space.lg },
  board: { backgroundColor: color.surface, borderRadius: radius.hero, borderWidth: 1, borderColor: color.line, padding: space.xl, gap: space.md },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 72,
    padding: 10,
    paddingRight: 14,
    borderRadius: 18,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
  },
  lineIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  lineTitle: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, color: color.ink },
  lineMeta: { ...bareType.small, color: color.ink2 },
  win: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  winAmount: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 15, minWidth: 72 },
  });
}
