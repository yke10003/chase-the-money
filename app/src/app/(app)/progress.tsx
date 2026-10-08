import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getProgress } from '@/api/endpoints';
import type { OpportunityType, ProgressView } from '@/api/types';
import { Icon } from '@/components/icon';
import { Button, EmptyState, ErrorState, GoalMeter, LinkButton, LoadingState, PageHeader, Panel, Segmented, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { formatShortDate } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { goalDaysLeft, goalPeriodName } from '@/lib/goal';
import { formatAmount } from '@/lib/money';
import { TYPE_META, TYPES } from '@/lib/mission';
import { useTheme } from '@/state/theme';

function useProgressUi() {
  const theme = useTheme();
  const styles = useMemo(() => createProgressStyles(theme.color), [theme.color]);

  return { ...theme, styles, typeScale: theme.type };
}

const PERIODS = [
  { value: 'goal', label: 'This goal' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
] as const;

type Period = (typeof PERIODS)[number]['value'];

const PERIOD_PHRASE: Record<Period, string> = {
  goal: 'this goal period',
  '7d': 'the last 7 days',
  '30d': 'the last 30 days',
  year: 'the last year',
  all: 'total',
};

const TYPE_VERB: Record<OpportunityType, string> = {
  earn: 'Earned',
  sell: 'Sold',
  recover: 'Recovered',
  save: 'Saved',
};

export default function ProgressScreen() {
  const { color, styles, typeScale } = useProgressUi();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('goal');
  const report = useQuery({ queryKey: ['progress', period], queryFn: () => getProgress(period), placeholderData: (previous) => previous });
  const layout = useLayout();

  if (report.isLoading) {
    return <LoadingState label="Loading progress" />;
  }

  if (report.isError || !report.data) {
    return <ErrorState message={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  }

  const view = report.data.data;

  return (
    <View style={{ gap: space.xl }}>
      <PageHeader
        title="Progress"
        subtitle={period === 'all' ? 'All received money.' : `${formatShortDate(view.starts_on)} – ${formatShortDate(view.ends_on)}`}
        action={<Segmented value={period} options={[...PERIODS]} onChange={setPeriod} />}
      />
      <View style={{ flexDirection: layout.phone ? 'column' : 'row', alignItems: layout.phone ? 'flex-start' : 'flex-end', gap: space.lg }}>
        <View style={{ flex: 1, gap: space.sm }}>
          <T variant="eyebrow">Realized{period === 'all' ? '' : ` · ${PERIOD_PHRASE[period]}`}</T>
          <Text style={[typeScale.hero, { fontSize: layout.phone ? 52 : 64, lineHeight: layout.phone ? 52 : 64, color: view.realized_amount_minor > 0 ? color.money : color.ink }]}>
            {formatAmount(view.realized_amount_minor, view.currency)}
          </Text>
          {period === 'goal' && view.goal ? <GoalMeter percent={view.goal.progress_percent} height={6} /> : null}
        </View>
        <View style={{ gap: 2 }}>
          <Text style={[styles.xpFigure, { color: color.xp }]}>{view.xp}</Text>
          <T variant="small">XP {view.period === 'all' ? 'all time' : 'this period'}</T>
        </View>
      </View>
      <View style={{ flexDirection: layout.twoColumn ? 'row' : 'column', gap: space.xl, alignItems: 'flex-start' }}>
        <View style={{ flex: layout.twoColumn ? 1.75 : undefined, width: layout.twoColumn ? undefined : '100%', gap: space.lg }}>
          <Banked view={view} period={period} />
          {view.series ? <Chart view={view} /> : null}
        </View>
        <View style={{ flex: layout.twoColumn ? 1 : undefined, width: layout.twoColumn ? undefined : '100%', gap: space.lg }}>
          <GoalCard view={view} />
          <Effort view={view} />
          <LinkButton label="All activity, including costs" icon="arrowRight" onPress={() => router.push('/opportunities')} />
        </View>
      </View>
    </View>
  );
}

function Banked({ view, period }: { view: ProgressView; period: Period }) {
  const { color, styles, typeScale, typeColor } = useProgressUi();
  const router = useRouter();
  const layout = useLayout();
  const byType: Record<OpportunityType, number> = {
    earn: view.realized_earn_minor,
    sell: view.realized_sell_minor,
    recover: view.realized_recover_minor,
    save: view.realized_save_minor,
  };
  const total = view.realized_amount_minor;

  return (
    <View style={{ gap: space.lg }}>
      <T variant="eyebrow">Where it came from</T>

      {total > 0 ? (
        <>
          <View style={styles.stack}>
            {TYPES.filter((type) => byType[type] > 0).map((type) => (
              <View key={type} style={{ flex: byType[type], backgroundColor: typeColor[type].base }} />
            ))}
          </View>
          <View style={styles.breakdown}>
            {TYPES.map((type) => (
              <View key={type} style={[styles.breakdownItem, { width: layout.phone ? '48%' : '23.5%' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={TYPE_META[type].icon} size={15} color={typeColor[type].base} />
                  <Text style={[typeScale.small, { color: typeColor[type].ink, fontFamily: font.semi }]}>{TYPE_VERB[type]}</Text>
                </View>
                <Text style={[typeScale.figure, { fontSize: 22, color: byType[type] > 0 ? color.ink : color.ink3 }]}>{formatAmount(byType[type], view.currency)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={{ gap: space.sm, alignItems: 'flex-start' }}>
          <T variant="body" color={color.ink2}>
            Nothing received {period === 'all' ? 'yet' : `in ${PERIOD_PHRASE[period]}`}.
          </T>
          <Button label="Find a quick win" tone="secondary" icon="storefront" onPress={() => router.push('/sell')} />
        </View>
      )}
    </View>
  );
}

function Chart({ view }: { view: ProgressView }) {
  const { color, styles, typeScale } = useProgressUi();
  const series = view.series ?? [];
  const max = Math.max(0, ...series.map((point) => point.amount_minor));
  const best = series.reduce<{ period: string; amount_minor: number } | null>((top, point) => (point.amount_minor > (top?.amount_minor ?? 0) ? point : top), null);
  const monthly = view.period === 'year';

  if (max === 0) {
    return null;
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: space.sm }}>
        <T variant="eyebrow">Over time</T>
        {best ? (
          <T variant="small">
            Best {monthly ? 'month' : 'day'}: <Text style={{ fontFamily: font.semi, color: color.ink }}>{formatAmount(best.amount_minor, view.currency)}</Text> on {monthly ? best.period : formatShortDate(best.period)}
          </T>
        ) : null}
      </View>
      <View style={styles.chart}>
        {series.map((point) => {
          const height = point.amount_minor > 0 ? Math.max(6, Math.round((point.amount_minor / max) * 140)) : 2;

          return (
            <View key={point.period} accessibilityLabel={`${point.period}: ${formatAmount(point.amount_minor, view.currency)}`} style={styles.barSlot}>
              <View style={[styles.bar, { height, backgroundColor: point.amount_minor > 0 ? color.money : color.line }]} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="small" color={color.ink3}>{monthly ? series[0]?.period : formatShortDate(series[0]?.period)}</T>
        <T variant="small" color={color.ink3}>{monthly ? series[series.length - 1]?.period : formatShortDate(series[series.length - 1]?.period)}</T>
      </View>
    </View>
  );
}

function GoalCard({ view }: { view: ProgressView }) {
  const { color, typeScale } = useProgressUi();
  const goal = view.goal;

  if (!goal) {
    return (
      <Panel padding="lg">
        <EmptyState icon="target" title="No goal right now" body="Set a new target from your profile." />
      </Panel>
    );
  }

  const daysLeft = goalDaysLeft(goal);

  return (
    <View style={{ gap: space.md }}>
      <T variant="eyebrow">{goalPeriodName(goal)} goal</T>
      <Text style={[typeScale.figure, { fontSize: 28, lineHeight: 32 }]}>
        <Text style={{ color: goal.realized_amount_minor > 0 ? color.money : color.ink }}>{formatAmount(goal.realized_amount_minor, goal.currency)}</Text>
        <Text style={{ color: color.ink3, fontFamily: font.semi, fontSize: 16 }}> of {formatAmount(goal.amount_minor, goal.currency)}</Text>
      </Text>
      <GoalMeter percent={goal.progress_percent} height={10} />
      <T variant="small">
        {goal.progress_percent >= 100
          ? 'Reached. Anything more is a bonus.'
          : `${goal.progress_percent}% there · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
      </T>
    </View>
  );
}

function Effort({ view }: { view: ProgressView }) {
  const { styles } = useProgressUi();
  return (
    <View style={{ gap: space.md }}>
      <T variant="eyebrow">Effort</T>
      <View style={styles.effortGrid}>
        <Stat value={view.actions_completed} label={view.actions_completed === 1 ? 'step done' : 'steps done'} />
        <Stat value={view.opportunities_completed} label={view.opportunities_completed === 1 ? 'mission closed' : 'missions closed'} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { typeScale } = useProgressUi();
  return (
    <View style={{ gap: 2, minWidth: 90 }}>
      <Text style={[typeScale.figure, { fontSize: 22 }]}>{value}</Text>
      <T variant="small">{label}</T>
    </View>
  );
}

function createProgressStyles(color: Palette) {
  return StyleSheet.create({
  xpFigure: { fontFamily: font.displayHeavy, fontWeight: weight.bold, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  stack: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden', gap: 2, backgroundColor: color.sunken },
  breakdown: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  breakdownItem: { gap: 4, paddingTop: space.sm, borderTopWidth: 1, borderColor: color.line },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 3, borderBottomWidth: 1, borderColor: color.line },
  barSlot: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  xp: { flexDirection: 'row', alignItems: 'baseline', gap: 6, backgroundColor: color.xpSoft, borderRadius: radius.md, padding: space.sm, alignSelf: 'flex-start' },
  effortGrid: { flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' },
  });
}
