import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import {
  completeAction,
  createAction,
  deleteOpportunity,
  getOpportunity,
  opportunityCommand,
  pauseOpportunity,
  reportEvent,
  resumeOpportunity,
  updateOpportunity,
  updatePlaybook,
} from '@/api/endpoints';
import type { Goal, OpportunityDetail, PlaybookOutcome, PlaybookView } from '@/api/types';
import { useFeedback } from '@/components/feedback';
import { Icon } from '@/components/icon';
import { PlaybookFields } from '@/components/playbook-fields';
import {
  Button,
  CertaintySwatch,
  Disclosure,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  LinkButton,
  LoadingState,
  Panel,
  PressableRow,
  Segmented,
  T,
  Tag,
  TypeGlyph,
  XpTag,
} from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { confirmAction } from '@/lib/confirm';
import { dateParts, daysUntil, formatShortDate, relativeDay } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { crossedMilestone, goalPeriodName } from '@/lib/goal';
import { formatAmount, formatAmountRange } from '@/lib/money';
import { areaHref, areaOf } from '@/lib/areas';
import { CERTAINTY_LABEL, certaintyFor, describeProgress, humanizeDates, isGoodOutcome, journeyFor, missionKind } from '@/lib/mission';
import { navigation } from '@/lib/navigation';
import { resumeSellSetup } from '@/lib/sell';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

function useDetailUi() {
  const theme = useTheme();
  const styles = useMemo(() => createDetailStyles(theme.color), [theme.color]);

  return { ...theme, styles, typeScale: theme.type };
}

type Run = (work: () => Promise<unknown>, title: string) => Promise<boolean>;

export default function OpportunityDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const detail = useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => getOpportunity(id),
    enabled: Number.isFinite(id),
  });

  const sellItemId = detail.data?.data.sell_item_id ?? null;
  const setupDone = detail.data?.data.setup_done ?? null;

  // An old link to a Sell mission. Unfinished setup resumes creation. A finished item opens Product Detail.
  useEffect(() => {
    if (sellItemId == null) {
      return;
    }

    if (!resumeSellSetup(sellItemId, setupDone)) {
      navigation.openProduct(sellItemId);
    }
  }, [sellItemId, setupDone]);

  if (!Number.isFinite(id)) {
    return <ErrorState message="That mission link is not valid." />;
  }

  if (detail.isLoading) {
    return <LoadingState label="Loading mission" />;
  }

  if (detail.isError || !detail.data) {
    return <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />;
  }

  if (sellItemId != null) {
    return <LoadingState label="Opening your item" />;
  }

  return <Detail key={id} opportunity={detail.data.data} />;
}

function sumXp(opportunity: OpportunityDetail): number {
  return opportunity.xp_events.reduce((sum, event) => sum + event.amount, 0);
}

function sumBanked(opportunity: OpportunityDetail): number {
  return opportunity.impacts.reduce((sum, impact) => sum + impact.amount_minor, 0);
}

function Detail({ opportunity }: { opportunity: OpportunityDetail }) {
  const { color, styles } = useDetailUi();
  const refresh = useRefreshProduct();
  const queryClient = useQueryClient();
  const feedback = useFeedback();
  const router = useRouter();
  const layout = useLayout();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const view = opportunity.playbook_view;
  const closed = opportunity.status === 'completed' || opportunity.status === 'abandoned';

  const run: Run = async (work, title) => {
    setError(null);
    setBusy(true);
    const xpBefore = sumXp(opportunity);
    const bankedBefore = sumBanked(opportunity);
    const goalBefore = queryClient.getQueryData<Goal | null>(['goal', 'current']);

    try {
      await work();
      const fresh = await getOpportunity(opportunity.id);
      queryClient.setQueryData(['opportunity', opportunity.id], fresh);
      await refresh();
      const goalAfter = queryClient.getQueryData<Goal | null>(['goal', 'current']);
      const xp = sumXp(fresh.data) - xpBefore;
      const banked = sumBanked(fresh.data) - bankedBefore;
      const milestone = goalBefore && goalAfter ? crossedMilestone(goalBefore.progress_percent, goalAfter.progress_percent) : null;
      const finished = fresh.data.status === 'completed' && !closed;

      const moved = goalBefore && goalAfter && goalAfter.progress_percent !== goalBefore.progress_percent;
      const hit = goalBefore && goalAfter && goalBefore.progress_percent < 100 && goalAfter.progress_percent >= 100;

      feedback({
        title: banked > 0 ? (finished ? 'In the bag.' : 'Received.') : title,
        banked: banked > 0 ? formatAmount(banked, opportunity.currency) : null,
        xp: xp > 0 ? xp : null,
        note: hit && goalAfter
          ? `${goalPeriodName(goalAfter)} goal reached.`
          : moved && goalBefore && goalAfter
            ? `Goal moved from ${goalBefore.progress_percent}% to ${goalAfter.progress_percent}%.`
            : milestone && goalAfter
              ? `You’re past ${milestone}% of your ${goalPeriodName(goalAfter).toLowerCase()} goal.`
              : finished && banked === 0
                ? 'Closed.'
                : null,
        again: title === 'Done: Reach out' ? { label: 'Message someone else', tab: 'freelance', start: 'message' } : null,
      });

      return true;
    } catch (caught) {
      setError(caught);

      return false;
    } finally {
      setBusy(false);
    }
  };

  let main: ReactNode;

  if (opportunity.status === 'paused') {
    main = (
      <Panel padding="xl" style={{ gap: space.md }}>
        <Tag label="Paused" icon="pause" />
        <T variant="heading">Set aside for now</T>
        <T variant="body" color={color.ink2}>Nothing is lost. Pick it back up whenever you are ready and it continues where you left off.</T>
        <Button label="Resume mission" icon="play" busy={busy} onPress={() => run(() => resumeOpportunity(opportunity.id), 'Back in play')} />
      </Panel>
    );
  } else if (closed) {
    main = <Result opportunity={opportunity} view={view} />;
  } else if (view) {
    main = <GuidedNow opportunity={opportunity} view={view} run={run} busy={busy} />;
  } else {
    main = <CustomNow opportunity={opportunity} run={run} busy={busy} />;
  }

  return (
    <View style={{ gap: space.lg }}>
      {/* On iOS phone the modal frame draws Back and Close. */}
      {Platform.OS === 'ios' && layout.phone ? null : (
        <LinkButton label="Back" icon="arrowLeft" onPress={() => (router.canGoBack() ? router.back() : router.dismissTo(areaHref(areaOf(opportunity))))} />
      )}
      <Header opportunity={opportunity} view={view} />
      {error ? <InlineError message={errorMessage(error)} /> : null}

      <View style={{ flexDirection: layout.twoColumn ? 'row' : 'column', gap: space.xl, alignItems: 'flex-start' }}>
        <View style={{ flex: layout.twoColumn ? 1.7 : undefined, width: layout.twoColumn ? undefined : '100%', gap: space.lg }}>
          {main}
          <History opportunity={opportunity} />
        </View>
        <View style={{ flex: layout.twoColumn ? 1 : undefined, width: layout.twoColumn ? undefined : '100%', gap: space.lg }}>
          <MoneyPanel opportunity={opportunity} view={view} />
          <Journey opportunity={opportunity} />
          <Manage opportunity={opportunity} view={view} run={run} busy={busy} />
        </View>
      </View>
    </View>
  );
}

function Header({ opportunity, view }: { opportunity: OpportunityDetail; view: PlaybookView | null }) {
  const { color, typeColor, typeScale } = useDetailUi();
  const layout = useLayout();
  const state = view?.stage_label ?? (opportunity.status === 'explore' ? 'Getting started' : opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1));
  const tint = typeColor[opportunity.type];

  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
      <TypeGlyph type={opportunity.type} size={layout.phone ? 44 : 60} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={[typeScale.eyebrow, { color: tint.ink }]}>{missionKind(opportunity)}</Text>
          <Text style={typeScale.eyebrow}>·</Text>
          <Text style={[typeScale.eyebrow, { color: color.ink2 }]}>{opportunity.status === 'paused' ? 'Paused' : state}</Text>
        </View>
        <T variant="title" style={layout.phone ? { fontSize: 26, lineHeight: 30 } : null}>{opportunity.title}</T>
      </View>
    </View>
  );
}

/* ---------- Now ---------- */

function GuidedNow({ opportunity, view, run, busy }: { opportunity: OpportunityDetail; view: PlaybookView; run: Run; busy: boolean }) {
  const { color, typeColor, styles, typeScale } = useDetailUi();
  const action = view.action;
  const xpReward = action ? opportunity.actions.find((item) => item.id === action.id)?.xp_reward ?? null : null;
  const waiting = action != null && !action.actionable && action.due_on != null;
  const isFollowUp = action?.playbook_key === 'follow_up';
  const canComplete = action != null && action.actionable && !isFollowUp;
  const asksQuestion = action == null && view.headline.endsWith('?') && view.outcomes.length > 0;

  if (asksQuestion) {
    return <Outcomes opportunity={opportunity} outcomes={view.outcomes} heading={view.headline} run={run} busy={busy} prominent />;
  }

  return (
    <View style={{ gap: space.lg }}>
      {waiting && action?.due_on ? (
        <WaitingCard dueOn={action.due_on} headline={view.headline} detail={view.detail} actionTitle={action.title} />
      ) : (
        <Panel padding="xl" style={[styles.now, { borderColor: typeColor[opportunity.type].base }]}>
          <View style={[styles.nowAccent, { backgroundColor: typeColor[opportunity.type].base, width: 6 }]} />
          <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center', flexWrap: 'wrap' }}>
            <T variant="eyebrow" color={color.ink}>{isFollowUp ? 'Your move' : canComplete ? 'Do this now' : 'Where it stands'}</T>
            {action?.due_on && isFollowUp ? <Tag label={`Due ${relativeDay(action.due_on)}`} icon="clock" /> : null}
          </View>
          <T variant="display" style={{ fontSize: 30, lineHeight: 34 }}>{canComplete && action ? action.title : view.headline}</T>
          {view.detail || action?.description ? (
            <T variant="body" color={color.ink2}>{humanizeDates(canComplete ? action?.description ?? view.detail : view.detail ?? action?.description)}</T>
          ) : null}
          {canComplete && action ? (
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
              {action.minutes_label ? (
                <View style={styles.meta}>
                  <Icon name="clock" size={16} color={color.ink2} />
                  <T variant="small">{action.minutes_label.replace(/^About /, '~')}</T>
                </View>
              ) : null}
              {xpReward ? <XpTag amount={xpReward} large /> : null}
            </View>
          ) : null}
          {isFollowUp ? <T variant="small">Follow up, then tell us how it went below.</T> : null}

          {canComplete && action && action.completion === 'form' ? (
            <View style={styles.formArea}>
              <PlaybookFields
                key={`action-${action.id}`}
                fields={action.fields}
                submitLabel={doneLabel(action.playbook_key)}
                currency={opportunity.currency}
                confirmsMoney={action.playbook_key === 'got_paid'}
                busy={busy}
                onSubmit={(input) => void run(() => completeAction(opportunity.id, action.id, input), `Done: ${action.title}`)}
              />
            </View>
          ) : null}
          {canComplete && action && action.completion === 'simple' ? (
            <Button label={doneLabel(action.playbook_key)} icon="check" size="lg" busy={busy} onPress={() => void run(() => completeAction(opportunity.id, action.id, {}), `Done: ${action.title}`)} />
          ) : null}
        </Panel>
      )}

      {view.outcomes.length > 0 ? (
        <Outcomes opportunity={opportunity} outcomes={view.outcomes} heading={waiting ? 'Heard back already?' : isFollowUp || !canComplete ? 'What happened?' : 'Something changed?'} run={run} busy={busy} />
      ) : null}
    </View>
  );
}

function doneLabel(key: string | null): string {
  switch (key) {
    case 'value_item':
      return 'Save the value';
    case 'list_item':
      return 'It’s listed';
    case 'send_proposal':
      return 'Proposal sent';
    case 'send_invoice':
      return 'Invoice sent';
    case 'reach_out':
      return 'I reached out';
    case 'do_the_work':
      return 'The work is done';
    case 'got_paid':
      return 'Bank it';
    default:
      return 'Mark as done';
  }
}

function waitLabel(dueOn: string): string {
  const days = daysUntil(dueOn);

  if (days <= 0) {
    return 'due soon';
  }

  return days === 1 ? '1 day to go' : `${days} days to go`;
}

function WaitingCard({ dueOn, headline, detail, actionTitle }: { dueOn: string; headline: string; detail: string | null; actionTitle: string }) {
  const { color, styles } = useDetailUi();
  const parts = dateParts(dueOn);

  return (
    <Panel padding="xl" tone="sunken" style={styles.waiting}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateMonth}>{parts.month}</Text>
        <Text style={styles.dateDay}>{parts.day}</Text>
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="hourglass" size={16} color={color.ink2} weight="bold" />
          <T variant="eyebrow" color={color.ink2}>Waiting · {waitLabel(dueOn)}</T>
        </View>
        <T variant="heading">{headline}</T>
        <T variant="body" color={color.ink2}>
          {detail ? humanizeDates(detail) : `${actionTitle} on ${parts.weekday}.`}
        </T>
        <T variant="small" color={color.ink3}>It will move to the top of Home on {parts.weekday} {parts.day} {parts.month}.</T>
      </View>
    </Panel>
  );
}

function Outcomes({
  opportunity,
  outcomes,
  heading,
  run,
  busy,
  prominent = false,
}: {
  opportunity: OpportunityDetail;
  outcomes: PlaybookOutcome[];
  heading: string;
  run: Run;
  busy: boolean;
  prominent?: boolean;
}) {
  const { color, styles, typeScale } = useDetailUi();
  const [open, setOpen] = useState<string | null>(null);
  const positive = outcomes.filter((outcome) => outcome.tone !== 'danger');
  const negative = outcomes.filter((outcome) => outcome.tone === 'danger');

  function renderOutcome(outcome: PlaybookOutcome) {
    const selected = open === outcome.key;
    const danger = outcome.tone === 'danger';

    return (
      <View key={outcome.key} style={[styles.outcome, selected && styles.outcomeOpen, selected && danger && { borderColor: color.danger }]}>
        <PressableRow
          onPress={() => setOpen(selected ? null : outcome.key)}
          accessibilityLabel={outcome.label}
          style={{ paddingHorizontal: space.md, paddingVertical: 14 }}
        >
          <View style={[styles.outcomeDot, outcome.tone === 'primary' && { borderColor: color.ink }, outcome.confirms_money && { borderColor: color.money, backgroundColor: color.moneySoft }, danger && { borderColor: color.danger }]}>
            {outcome.confirms_money ? <Icon name="handCoins" size={13} color={color.moneyInk} weight="bold" /> : null}
          </View>
          <Text style={[typeScale.bodyStrong, { flex: 1 }, danger && { color: color.danger }]}>{outcome.label}</Text>
          <Icon name={selected ? 'caretDown' : 'caretRight'} size={15} color={color.ink3} />
        </PressableRow>
        {selected ? (
          <View style={styles.outcomeBody}>
            {outcome.fields.length === 0 ? (
              <View style={{ gap: space.sm }}>
                <T variant="small">{outcomeConsequence(outcome)}</T>
                <Button
                  label={`Confirm: ${outcome.label}`}
                  tone={danger ? 'danger' : 'primary'}
                  busy={busy}
                  onPress={() => void run(() => reportEvent(opportunity.id, { outcome: outcome.key }), outcome.label).then((ok) => ok && setOpen(null))}
                />
              </View>
            ) : (
              <PlaybookFields
                key={`${outcome.key}-${outcome.fields.map((field) => field.prefill_minor ?? field.default ?? '').join('-')}`}
                fields={outcome.fields}
                submitLabel={outcome.confirms_money ? 'Bank it' : `Save: ${outcome.label}`}
                currency={opportunity.currency}
                confirmsMoney={outcome.confirms_money}
                tone={danger ? 'danger' : 'primary'}
                busy={busy}
                onSubmit={(input) => void run(() => reportEvent(opportunity.id, { outcome: outcome.key, ...input }), outcome.label).then((ok) => ok && setOpen(null))}
              />
            )}
          </View>
        ) : null}
      </View>
    );
  }

  const list = (
    <>
      <View style={{ gap: space.xs }}>{positive.map(renderOutcome)}</View>
      {negative.length > 0 ? <View style={{ gap: space.xs, marginTop: space.xs }}>{negative.map(renderOutcome)}</View> : null}
    </>
  );

  if (prominent) {
    return (
      <Panel padding="xl" style={[styles.now, { borderColor: color.ink }]}>
        <View style={[styles.nowAccent, { backgroundColor: color.ink }]} />
        <T variant="eyebrow" color={color.ink}>Your call</T>
        <T variant="display" style={{ fontSize: 30, lineHeight: 34 }}>{heading}</T>
        {list}
      </Panel>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <T variant="heading">{heading}</T>
      {list}
    </View>
  );
}

function outcomeConsequence(outcome: PlaybookOutcome): string {
  if (outcome.tone === 'danger' || outcome.key === 'stop' || outcome.key === 'not_sold' || outcome.key === 'keep') {
    return 'This closes the mission. Anything you already banked and the XP from your effort stay.';
  }

  if (outcome.key === 'reject_offer') {
    return 'The listing stays up and you can take the next offer.';
  }

  return 'This updates the mission and sets up the next step.';
}

function CustomNow({ opportunity, run, busy }: { opportunity: OpportunityDetail; run: Run; busy: boolean }) {
  const { color, styles } = useDetailUi();
  const next = opportunity.actions
    .filter((action) => action.status === 'open')
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)[0];

  if (!next) {
    return (
      <Panel padding="lg">
        <EmptyState icon="flag" title="What’s the first step?" body="This is your own mission. Add a step under Manage, and it shows up here and on Home." />
      </Panel>
    );
  }

  return (
    <Panel padding="xl" style={[styles.now, { borderColor: color.ink }]}>
      <View style={[styles.nowAccent, { backgroundColor: color.ink }]} />
      <T variant="eyebrow" color={color.ink}>Do this now</T>
      <T variant="display" style={{ fontSize: 30, lineHeight: 34 }}>{next.title}</T>
      {next.description ? <T variant="body" color={color.ink2}>{next.description}</T> : null}
      {next.xp_reward ? <XpTag amount={next.xp_reward} /> : null}
      <Button label="Mark as done" icon="check" size="lg" busy={busy} onPress={() => void run(() => completeAction(opportunity.id, next.id, {}), `Done: ${next.title}`)} />
    </Panel>
  );
}

/* ---------- Result ---------- */

const CLOSING_LINES: Record<string, string> = {
  no_change: 'Reviewed and kept. Decision made.',
  declined: 'They passed. Not every proposal lands.',
  stopped_pursuing: 'Dropped. That time is free for something better.',
  written_off: 'Written off. One less thing hanging over you.',
  claim_rejected: 'Claim rejected. At least you checked.',
  not_sold: 'Didn’t sell this time. It’s still yours.',
  decided_not_to_sell: 'You kept it. Your call.',
};

function Result({ opportunity, view }: { opportunity: OpportunityDetail; view: PlaybookView | null }) {
  const { color, styles, typeScale } = useDetailUi();
  const router = useRouter();
  const banked = sumBanked(opportunity);
  const xp = sumXp(opportunity);
  const recurring = opportunity.impacts.find((impact) => impact.annualized_amount_minor != null);
  const good = isGoodOutcome(opportunity.outcome) || (banked > 0 && opportunity.outcome == null);
  const label = view?.stage_label ?? 'Finished';

  return (
    <Panel padding="xl" tone={good ? 'surface' : 'sunken'} style={[{ gap: space.lg }, good && { borderColor: color.money, borderWidth: 2 }]}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <View style={[styles.resultMark, { backgroundColor: good ? color.money : color.ink3 }]}>
          <Icon name={good ? 'check' : 'flag'} size={18} color={color.onInk} weight="bold" />
        </View>
        <T variant="eyebrow" color={good ? color.moneyInk : color.ink2}>
          {label}
          {opportunity.completed_at ? ` · ${formatShortDate(opportunity.completed_at)}` : ''}
        </T>
      </View>

      {banked > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={[typeScale.hero, { color: color.money }]}>{formatAmount(banked, opportunity.currency)}</Text>
          <T variant="body" color={color.ink2}>{opportunity.type === 'save' ? 'saved this period, counted toward your goal.' : 'banked and counted toward your goal.'}</T>
        </View>
      ) : (
        <T variant="heading">{good ? 'Done.' : CLOSING_LINES[opportunity.outcome ?? ''] ?? 'Closed without money.'}</T>
      )}

      {recurring?.annualized_amount_minor != null && recurring.recurring_amount_minor != null ? (
        <View style={styles.recurring}>
          <Icon name="trendUp" size={18} color={color.ink2} />
          <T variant="small" style={{ flex: 1 }}>
            {formatAmount(recurring.recurring_amount_minor, opportunity.currency)} a {recurring.recurrence_interval ?? 'month'} less from now on, about {formatAmount(recurring.annualized_amount_minor, opportunity.currency)} a year. Only this period’s saving counts toward the goal.
          </T>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        {xp > 0 ? <XpTag amount={xp} /> : null}
        <T variant="small">{xp > 0 ? (good ? 'earned along the way.' : 'from the effort you put in. That still counts.') : ''}</T>
      </View>

      <Divider />
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button label="Back to Home" icon="house" onPress={() => router.dismissTo('/')} />
        <Button label="Back to this area" tone="secondary" icon="arrowLeft" onPress={() => router.dismissTo(areaHref(areaOf(opportunity)))} />
      </View>
    </Panel>
  );
}

/* ---------- Side ---------- */

function MoneyPanel({ opportunity, view }: { opportunity: OpportunityDetail; view: PlaybookView | null }) {
  const { color, styles, typeScale } = useDetailUi();
  const closed = opportunity.status === 'completed' || opportunity.status === 'abandoned';
  const raw = view?.money.length
    ? view.money
    : opportunity.expected_amount_minor != null
      ? [{ label: 'Expected', amount_minor: opportunity.expected_amount_minor, currency: opportunity.currency }]
      : [];
  const lines = closed
    ? raw.map((line) => (certaintyFor(line.label) === 'expected' && line.label !== 'Agreed' ? { ...line, label: 'Was expected' } : line))
    : raw;

  return (
    <Panel padding="lg" style={{ gap: space.md }}>
      <T variant="eyebrow">Money</T>
      {lines.length === 0 ? (
        <T variant="small">No figure yet. It gets one as soon as there’s a real number: a quote, a valuation, or an amount owed.</T>
      ) : (
        <View style={{ gap: space.sm }}>
          {lines.map((line) => {
            const certainty = certaintyFor(line.label);

            return (
              <View key={line.label} style={styles.moneyLine}>
                <CertaintySwatch certainty={certainty} size={14} />
                <View style={{ flex: 1 }}>
                  <T variant="small" color={color.ink2}>{line.label}</T>
                </View>
                <Text style={[typeScale.figure, { fontSize: certainty === 'banked' ? 22 : 18, color: certainty === 'banked' ? color.money : certainty === 'possible' ? color.ink2 : color.ink }]}>
                  {line.label === 'Worth'
                    ? formatAmountRange(opportunity.potential_min_minor, opportunity.potential_max_minor, line.currency) ?? formatAmount(line.amount_minor, line.currency)
                    : formatAmount(line.amount_minor, line.currency)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      {lines.length > 0 ? (
        <View style={styles.legend}>
          {(['banked', 'expected', 'possible'] as const)
            .filter((certainty) => lines.some((line) => certaintyFor(line.label) === certainty))
            .map((certainty) => (
              <View key={certainty} style={styles.legendItem}>
                <CertaintySwatch certainty={certainty} size={10} />
                <T variant="small" style={{ fontSize: 12 }}>{CERTAINTY_LABEL[certainty]}</T>
              </View>
            ))}
        </View>
      ) : null}
    </Panel>
  );
}

function Journey({ opportunity }: { opportunity: OpportunityDetail }) {
  const { color, styles, typeColor, typeScale } = useDetailUi();
  const journey = journeyFor(opportunity.playbook);

  if (!journey) {
    return null;
  }

  const closedWell = opportunity.status === 'completed' && isGoodOutcome(opportunity.outcome);
  const closedEarly = (opportunity.status === 'completed' || opportunity.status === 'abandoned') && !closedWell;
  const current = closedWell ? journey.steps.length - 1 : journey.indexFor(opportunity.stage);
  const tint = typeColor[opportunity.type];

  return (
    <Panel padding="lg" style={{ gap: space.md }}>
      <T variant="eyebrow">The story so far</T>
      <View>
        {journey.steps.map((step, index) => {
          const done = index < current || closedWell;
          const here = index === current && !closedWell;
          const last = index === journey.steps.length - 1;

          return (
            <View key={step} style={styles.step}>
              <View style={{ alignItems: 'center', width: 18 }}>
                <View
                  style={[
                    styles.stepDot,
                    done && { backgroundColor: color.ink, borderColor: color.ink },
                    here && { borderColor: tint.base, borderWidth: 3, width: 16, height: 16, borderRadius: 8 },
                    here && closedEarly && { borderColor: color.ink3 },
                  ]}
                />
                {last ? null : <View style={[styles.stepLine, done && { backgroundColor: color.ink }]} />}
              </View>
              <Text
                style={[
                  typeScale.small,
                  { paddingBottom: last ? 0 : 14 },
                  done && { color: color.ink },
                  here && { color: color.ink, fontFamily: font.semi },
                ]}
              >
                {step}
                {here && closedEarly ? ` · ${opportunity.playbook_view?.stage_label ?? 'Closed'}` : ''}
              </Text>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

function Manage({ opportunity, view, run, busy }: { opportunity: OpportunityDetail; view: PlaybookView | null; run: Run; busy: boolean }) {
  const { color, styles } = useDetailUi();
  const router = useRouter();
  const refresh = useRefreshProduct();
  const [title, setTitle] = useState('');
  const [effort, setEffort] = useState<'quick' | 'medium' | 'deep'>('quick');
  const [name, setName] = useState(opportunity.title);
  const [notes, setNotes] = useState(opportunity.notes ?? '');
  const open = opportunity.status !== 'completed' && opportunity.status !== 'abandoned';

  return (
    <View style={{ gap: space.sm, paddingHorizontal: space.xs }}>
      <T variant="eyebrow">Manage</T>
      <Disclosure label="Name and notes">
        <View style={{ gap: space.sm }}>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Links, who you talked to, anything useful" />
          <Button label="Save" tone="secondary" size="sm" busy={busy} onPress={() => void run(() => updateOpportunity(opportunity.id, { title: name, notes }), 'Saved')} />
        </View>
      </Disclosure>
      {view && view.editable.length > 0 ? (
        <Disclosure label="Fix a date or amount">
          <View style={{ gap: space.sm }}>
            <T variant="small">Banked money stays as history and can’t be edited.</T>
            <PlaybookFields
              key={`edit-${view.editable.map((field) => field.prefill_minor ?? field.default ?? '').join('-')}`}
              fields={view.editable}
              submitLabel="Save corrections"
              currency={opportunity.currency}
              tone="secondary"
              busy={busy}
              onSubmit={(input) => void run(() => updatePlaybook(opportunity.id, input), 'Corrected')}
            />
          </View>
        </Disclosure>
      ) : null}
      {opportunity.playbook == null && open ? (
        <Disclosure label="Add a step" initiallyOpen={opportunity.actions.length === 0}>
          <View style={{ gap: space.sm }}>
            <Field label="What will you do?" value={title} onChangeText={setTitle} />
            <Segmented
              label="How big is it?"
              value={effort}
              options={[
                { value: 'quick', label: 'Quick' },
                { value: 'medium', label: 'Medium' },
                { value: 'deep', label: 'Deep work' },
              ]}
              onChange={setEffort}
            />
            <Button
              label="Add step"
              tone="secondary"
              size="sm"
              busy={busy}
              onPress={async () => {
                if (title.trim() === '') {
                  return;
                }
                if (await run(() => createAction(opportunity.id, { title: title.trim(), effort }), 'Step added')) {
                  setTitle('');
                }
              }}
            />
          </View>
        </Disclosure>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', marginTop: space.xs }}>
        {opportunity.status !== 'paused' && open ? (
          <Button
            label="Pause"
            tone="ghost"
            size="sm"
            icon="pause"
            onPress={async () => {
              if (await confirmAction('Pause this mission?', 'It leaves Home until you resume it. Nothing is lost.')) {
                void run(() => pauseOpportunity(opportunity.id), 'Paused');
              }
            }}
          />
        ) : null}
        {opportunity.playbook == null && open ? (
          <Button label="Mark finished" tone="ghost" size="sm" icon="check" onPress={() => void run(() => opportunityCommand(opportunity.id, 'complete'), 'Mission finished')} />
        ) : null}
        <Button
          label="Delete"
          tone="danger"
          size="sm"
          icon="trash"
          onPress={async () => {
            if (await confirmAction('Delete this mission?', 'The mission and its steps are removed. Money you banked and XP you earned stay in your history.')) {
              await deleteOpportunity(opportunity.id);

              if (router.canGoBack()) {
                router.back();
              } else {
                router.dismissTo(areaHref(areaOf(opportunity)));
              }

              // The tabs underneath stay mounted, so their lists do not refetch on their own.
              void refresh();
            }
          }}
        />
      </View>
    </View>
  );
}

function History({ opportunity }: { opportunity: OpportunityDetail }) {
  const { color, styles } = useDetailUi();
  type Entry = { key: string; at: string; title: string; money?: string; xp?: number };
  const xpByAction = new Set(opportunity.xp_events.map((event) => event.opportunity_action_id));
  const entries: Entry[] = [
    ...opportunity.impacts.map((impact) => ({
      key: `impact-${impact.id}`,
      at: impact.occurred_at ?? impact.created_at ?? '',
      title: impact.note ?? 'Money recorded',
      money: formatAmount(impact.amount_minor, impact.currency),
    })),
    ...opportunity.xp_events.map((event) => ({
      key: `xp-${event.id}`,
      at: event.occurred_at ?? '',
      title: describeProgress(event.description),
      xp: event.amount,
    })),
    ...opportunity.actions
      .filter((action) => action.status === 'completed' && !xpByAction.has(action.id))
      .map((action) => ({ key: `action-${action.id}`, at: action.completed_at ?? '', title: action.title })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (entries.length === 0) {
    return null;
  }

  return (
    <Disclosure label={`History · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}>
      <View style={{ gap: 0 }}>
        {entries.map((entry) => (
          <View key={entry.key} style={styles.historyRow}>
            <T variant="small" style={{ width: 64 }} color={color.ink3}>{entry.at ? formatShortDate(entry.at) : ''}</T>
            <T variant="small" color={color.ink} style={{ flex: 1 }}>{entry.title}</T>
            {entry.money ? <Text style={[styles.historyFigure, { color: color.money }]}>+{entry.money}</Text> : null}
            {entry.xp ? <Text style={[styles.historyFigure, { color: color.xp }]}>+{entry.xp} XP</Text> : null}
          </View>
        ))}
      </View>
    </Disclosure>
  );
}

function createDetailStyles(color: Palette) {
  return StyleSheet.create({
  now: { gap: space.md, overflow: 'hidden', borderWidth: 1 },
  nowAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  formArea: { marginTop: space.xs, paddingTop: space.md, borderTopWidth: 1, borderColor: color.line },
  waiting: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  dateBlock: { width: 76, borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.lineStrong, alignItems: 'center', paddingVertical: space.xs, overflow: 'hidden' },
  dateMonth: { fontFamily: font.bold, fontWeight: weight.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: color.overdue },
  dateDay: { fontFamily: font.displayHeavy, fontWeight: weight.bold, fontSize: 34, lineHeight: 38, color: color.ink, letterSpacing: -0.6 },
  outcome: { borderWidth: 1, borderColor: color.line, borderRadius: radius.md, backgroundColor: color.surface, overflow: 'hidden' },
  outcomeOpen: { borderColor: color.ink },
  outcomeDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  outcomeBody: { paddingHorizontal: space.md, paddingBottom: space.md, paddingTop: space.xs, gap: space.sm },
  resultMark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  recurring: { flexDirection: 'row', gap: space.xs, alignItems: 'flex-start', backgroundColor: color.sunken, borderRadius: radius.md, padding: space.sm },
  moneyLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legend: { flexDirection: 'row', gap: space.md, paddingTop: space.sm, borderTopWidth: 1, borderColor: color.line },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  step: { flexDirection: 'row', gap: space.sm },
  stepDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: color.lineStrong, backgroundColor: color.surface, marginTop: 3 },
  stepLine: { width: 2, flex: 1, backgroundColor: color.line, marginVertical: 2 },
  historyRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: color.line },
  historyFigure: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 13 },
  });
}
