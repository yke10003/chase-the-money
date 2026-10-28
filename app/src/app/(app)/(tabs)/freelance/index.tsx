import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation, type NavigationProp, type ParamListBase } from 'expo-router/react-navigation';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { getCurrentGoal, getDiscover, getProgress, listAllOpportunities, startPlaybook } from '@/api/endpoints';
import type { Opportunity } from '@/api/types';
import { Skills } from '@/app/(app)/discover';
import { AreaList } from '@/components/area-list';
import { ActionQueue, ActionRow, CockpitFrame, Sheet } from '@/components/moves';
import { ScoreHero } from '@/components/score-hero';
import { Button, ErrorState, Field, InlineError, LinkButton, LoadingState, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { areaOf } from '@/lib/areas';
import { relativeDay } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange } from '@/lib/money';
import { attentionFor, missionGroup } from '@/lib/mission';
import { navRequest } from '@/lib/nav-log';
import { navigation } from '@/lib/navigation';
import { createSheetHandoff } from '@/lib/sheet-handoff';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

export default function FreelanceScreen() {
  const { color, accent } = useTheme();
  const layout = useLayout();
  const paint = accent.earn;
  const params = useLocalSearchParams<{ start?: string }>();
  const screen = useNavigation<NavigationProp<ParamListBase>>();
  const list = useQuery({ queryKey: ['opportunities', 'all'], queryFn: () => listAllOpportunities() });
  const goal = useQuery({ queryKey: ['goal', 'current'], queryFn: getCurrentGoal });
  const week = useQuery({ queryKey: ['progress', '7d'], queryFn: () => getProgress('7d') });
  const progress = useQuery({ queryKey: ['progress', 'goal', 'earn'], queryFn: () => getProgress('goal', 'earn') });
  const [sheet, setSheet] = useState<'message' | 'later' | null>(params.start === 'message' || params.start === 'work' ? 'message' : null);
  // Another presentation (a mission, Profile, the other sheet) opens only after the open sheet has finished dismissing (navigation.md, T9).
  const handoff = useMemo(() => createSheetHandoff({ ios: Platform.OS === 'ios', close: () => setSheet(null), log: navRequest }), []);

  useEffect(() => {
    if (params.start === 'message' || params.start === 'work') {
      setSheet('message');
      // Consumed. Left in place, the same request later (another "Message someone else") would not change the param, so it would not open.
      screen.setParams({ start: undefined });
    }
  }, [params.start, screen]);

  if (list.isLoading) {
    return <LoadingState label="Loading your work" />;
  }

  if (list.isError || !list.data) {
    return <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />;
  }

  const mine = list.data.filter((mission) => areaOf(mission) === 'freelance');
  const open = mine.filter((mission) => {
    const group = missionGroup(mission);

    return group !== 'done' && group !== 'paused';
  });
  const guided = open.filter((mission) => mission.playbook === 'freelance');
  const custom = open.filter((mission) => mission.playbook == null);
  const proposed = guided.reduce((sum, mission) => sum + (mission.potential_max_minor ?? 0), 0);
  const expected = guided.reduce((sum, mission) => sum + (mission.expected_amount_minor ?? 0), 0);
  const currency = open[0]?.currency ?? goal.data?.currency ?? 'EUR';
  const earned = progress.data?.data.realized_earn_minor ?? 0;
  const proposedLabel = proposed > 0 ? formatAmount(proposed, currency) : null;
  const actions = [
    { label: 'Add a lead', icon: 'plus' as const, onPress: () => navigation.startCreation('freelance') },
    { label: 'Message someone', icon: 'chat' as const, onPress: () => setSheet('message') },
  ];

  return (
    <>
      <CockpitFrame
        title="Freelance"
        actions={actions}
        moves={
          <ScoreHero
            wash="earn"
            paint={paint}
            kicker={layout.phone ? '' : 'This goal'}
            amount={formatAmount(earned, currency)}
            caption="earned"
            metrics={[
              ...(proposedLabel ? [{ label: 'proposed', value: proposedLabel }] : []),
              ...(expected > 0 ? [{ label: 'still expected', value: formatAmount(expected, currency) }] : []),
            ]}
            series={progress.data?.data.series}
            note={week.data && week.data.data.xp > 0 ? `+${week.data.data.xp} XP this week` : null}
            actions={actions}
          />
        }
        below={
          <View style={{ gap: space.xl }}>
            <View style={{ gap: space.sm }}>
              <T variant="eyebrow">Pipeline</T>
              {guided.length > 0 ? (
                <View style={{ gap: 12 }}>
                  {guided.map((mission) => (
                    <LeadCard key={mission.id} mission={mission} onPress={() => navigation.openMission(mission.id)} />
                  ))}
                </View>
              ) : (
                <T variant="body" color={color.ink2}>No active leads yet.</T>
              )}
            </View>
            <ActionQueue>
              <ActionRow title="Make some noise" detail="One post, wherever you already show up." icon="megaphone" iconColor={paint.from} unavailable onPress={() => setSheet('later')} />
              <ActionRow title="Reach someone new" detail="A cold note, or an agency." icon="send" iconColor={paint.from} unavailable onPress={() => setSheet('later')} />
            </ActionQueue>
            {custom.length > 0 ? (
              <View style={{ gap: space.xs }}>
                <T variant="eyebrow">Your own steps</T>
                <AreaList missions={custom} />
              </View>
            ) : null}
            {/*
              The sheets are part of the cockpit sheet's content, so React Native presents them from that
              sheet's view controller. Rendered beside the page, they sit in the covered tab's controller,
              which UIKit refuses to present from while the cockpit sheet is up (no `sheet.shown`).
            */}
            <MessageSheet
              visible={sheet === 'message'}
              onClose={() => setSheet(null)}
              onStarted={(id) => handoff.run(() => navigation.openMission(id))}
              onEditSkills={() => handoff.run(() => navigation.openSecondary('/settings?tab=profile'))}
              onDismiss={handoff.dismissed}
            />
            <Sheet visible={sheet === 'later'} title="Not tracked yet" onClose={() => setSheet(null)} onDismiss={handoff.dismissed}>
              <T variant="body" color={color.ink2}>
                A public post and a cold note will live here. They aren’t a move you can finish in the app yet.
              </T>
              <T variant="body">One message to someone who already knows your work is ready now.</T>
              <Button label="Message someone" iconRight="arrowRight" onPress={() => handoff.run(() => setSheet('message'))} />
            </Sheet>
          </View>
        }
      />
    </>
  );
}

function LeadCard({ mission, onPress }: { mission: Opportunity; onPress: () => void }) {
  const { color, accent } = useTheme();
  const action = mission.next_action;
  const attention = attentionFor(action?.due_on);
  const range = formatAmountRange(mission.potential_min_minor, mission.potential_max_minor, mission.currency);
  const money = mission.expected_amount_minor != null
    ? `${formatAmount(mission.expected_amount_minor, mission.currency)} expected`
    : range
      ? `${range} proposed`
      : null;
  const when = attention === 'overdue' ? 'Overdue' : attention === 'today' ? 'Due today' : action?.due_on ? relativeDay(action.due_on) : null;
  const letter = mission.title.trim().charAt(0).toUpperCase() || '•';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: 16, backgroundColor: color.surface, alignItems: 'center' }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: accent.earn.from, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: font.semi, fontWeight: weight.bold, fontSize: 18, color: accent.earn.on }}>{letter}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, color: color.ink }}>{mission.title}</Text>
        {money ? <Text style={{ fontSize: 14, color: color.ink2 }}>{money}</Text> : null}
        <Text numberOfLines={1} style={{ fontSize: 13, color: attention === 'overdue' ? color.overdue : color.ink3 }}>
          {mission.stage_label}
          {action ? ` · ${action.title}` : ''}
          {when ? ` · ${when}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function MessageSheet({
  visible,
  onClose,
  onStarted,
  onEditSkills,
  onDismiss,
}: {
  visible: boolean;
  onClose: () => void;
  onStarted: (id: number) => void;
  onEditSkills: () => void;
  onDismiss: () => void;
}) {
  const { color } = useTheme();
  const refresh = useRefreshProduct();
  const discover = useQuery({ queryKey: ['discover'], queryFn: getDiscover, enabled: visible });
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function start() {
    const name = who.trim();

    if (name === '') {
      setError(new Error('Name the person, or the work.'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await startPlaybook('freelance', { title: name, current_state: 'lead' });
      await refresh();
      onStarted(created.data.id);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Message someone" onClose={onClose} onDismiss={onDismiss}>
      <T variant="body" color={color.ink2}>One note. XP lands when it’s sent.</T>
      <Field label="Who is it for?" value={who} onChangeText={setWho} placeholder="Alex at Studio K" autoFocus />
      {error ? <InlineError message={errorMessage(error)} /> : null}
      <Button label={busy ? 'Starting…' : 'Start the note'} iconRight="arrowRight" busy={busy} onPress={() => void start()} />
      {discover.data ? (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <T variant="eyebrow">Or start from a skill</T>
          <Skills missions={discover.data.data.skill_missions} bare onStarted={onStarted} onEdit={onEditSkills} />
        </View>
      ) : null}
    </Sheet>
  );
}
