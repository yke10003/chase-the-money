import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getCurrentGoal, getDiscover, getProgress, listAllOpportunities } from '@/api/endpoints';
import { Recovery } from '@/app/(app)/discover';
import { AreaList } from '@/components/area-list';
import { CockpitFrame } from '@/components/moves';
import { ScoreHero } from '@/components/score-hero';
import { ErrorState, LoadingState, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { space } from '@/design/tokens';
import { useTheme } from '@/state/theme';
import { areaOf } from '@/lib/areas';
import { errorMessage } from '@/lib/errors';
import { formatAmount } from '@/lib/money';
import { navigation } from '@/lib/navigation';
import { attentionFor, missionGroup } from '@/lib/mission';

export default function RecoverScreen() {
  const { color, accent } = useTheme();
  const layout = useLayout();
  const paint = accent.recover;
  const params = useLocalSearchParams<{ start?: string }>();
  const [finding, setFinding] = useState(params.start === 'find');
  const list = useQuery({ queryKey: ['opportunities', 'all'], queryFn: () => listAllOpportunities() });
  const goal = useQuery({ queryKey: ['goal', 'current'], queryFn: getCurrentGoal });
  const discover = useQuery({ queryKey: ['discover'], queryFn: getDiscover, enabled: finding });
  const progress = useQuery({ queryKey: ['progress', 'goal', 'recover'], queryFn: () => getProgress('goal', 'recover') });

  useEffect(() => {
    if (params.start === 'find') {
      setFinding(true);
    }
  }, [params.start]);

  if (list.isLoading) {
    return <LoadingState label="Loading money owed to you" />;
  }

  if (list.isError || !list.data) {
    return <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />;
  }

  const open = list.data.filter((mission) => areaOf(mission) === 'recover' && missionGroup(mission) !== 'done' && missionGroup(mission) !== 'paused');
  const expected = open.reduce((sum, mission) => sum + (mission.expected_amount_minor ?? 0), 0);
  const overdue = open.filter((mission) => attentionFor(mission.next_action?.due_on) === 'overdue').length;
  const currency = open[0]?.currency ?? goal.data?.currency ?? 'EUR';
  const recovered = progress.data?.data.realized_recover_minor ?? 0;
  const actions = [
    { label: 'Add expected money', icon: 'plus' as const, onPress: () => navigation.startCreation('recover') },
    { label: 'Find money', icon: 'search' as const, onPress: () => setFinding((value) => !value) },
  ];

  return (
    <CockpitFrame
      title="Recover"
      actions={actions}
      moves={
        <ScoreHero
          wash="recover"
          paint={paint}
          kicker={layout.phone ? '' : 'This goal'}
          amount={formatAmount(recovered, currency)}
          caption="recovered"
          metrics={[
            ...(expected > 0 ? [{ label: 'expected', value: formatAmount(expected, currency) }] : []),
            ...(overdue > 0 ? [{ label: overdue === 1 ? 'overdue' : 'overdue', value: String(overdue) }] : []),
          ]}
          series={progress.data?.data.series}
          actions={actions}
        />
      }
      below={
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <T variant="eyebrow">Due</T>
            {open.length > 0 ? <AreaList missions={[...open].sort((a, b) => (a.next_action?.due_on ?? '9999').localeCompare(b.next_action?.due_on ?? '9999'))} /> : <T variant="body" color={color.ink2}>Nothing to collect yet.</T>}
          </View>
          {finding ? (discover.data ? <Recovery prompts={discover.data.data.recovery_prompts} onStarted={(id) => navigation.openMission(id)} /> : <LoadingState label="Loading" />) : null}
        </View>
      }
    />
  );
}
