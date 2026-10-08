import type { IconName } from '@/components/icon';
import type { Opportunity, OpportunityType } from '@/api/types';
import { daysUntil, formatShortDate } from '@/lib/dates';

export const TYPE_META: Record<OpportunityType, { label: string; icon: IconName; noun: string }> = {
  earn: { label: 'Earn', icon: 'briefcase', noun: 'Work' },
  sell: { label: 'Sell', icon: 'tag', noun: 'Things you own' },
  recover: { label: 'Recover', icon: 'handCoins', noun: 'Money owed to you' },
  save: { label: 'Save', icon: 'scissors', noun: 'Costs' },
};

export const TYPES: OpportunityType[] = ['earn', 'sell', 'recover', 'save'];

const PLAYBOOK_LABELS: Record<string, string> = {
  sell_item: 'Sell',
  freelance: 'Freelance',
  recover_money: 'Recover',
  reduce_expense: 'Cut a cost',
};

export function missionKind(opportunity: Pick<Opportunity, 'playbook' | 'type'>): string {
  if (opportunity.playbook && PLAYBOOK_LABELS[opportunity.playbook]) {
    return PLAYBOOK_LABELS[opportunity.playbook];
  }

  return TYPE_META[opportunity.type].label;
}

/**
 * Banked moved the goal. Expected was promised or agreed. Possible is an estimate.
 * Neutral is a fact that is not money changing hands (what a cost used to be).
 */
export type Certainty = 'banked' | 'expected' | 'possible' | 'neutral';

const CERTAINTY_BY_LABEL: Record<string, Certainty> = {
  Received: 'banked',
  'Saved this period': 'banked',
  Agreed: 'expected',
  'Still expected': 'expected',
  Expected: 'expected',
  Proposed: 'possible',
  Worth: 'possible',
  Asking: 'possible',
  Offer: 'possible',
};

export function certaintyFor(label: string): Certainty {
  return CERTAINTY_BY_LABEL[label] ?? 'neutral';
}

export const CERTAINTY_LABEL: Record<Exclude<Certainty, 'neutral'>, string> = {
  banked: 'Banked',
  expected: 'Expected',
  possible: 'Possible',
};

export type Attention = 'overdue' | 'today' | 'soon' | 'later' | null;

export function attentionFor(dueOn: string | null | undefined): Attention {
  if (!dueOn) {
    return null;
  }

  const days = daysUntil(dueOn);

  if (days < 0) {
    return 'overdue';
  }

  if (days === 0) {
    return 'today';
  }

  if (days <= 7) {
    return 'soon';
  }

  return 'later';
}

export type MissionGroup = 'ready' | 'waiting' | 'idle' | 'paused' | 'done';

export function missionGroup(opportunity: Opportunity): MissionGroup {
  if (opportunity.status === 'completed' || opportunity.status === 'abandoned') {
    return 'done';
  }

  if (opportunity.status === 'paused') {
    return 'paused';
  }

  const next = opportunity.next_action;

  if (!next) {
    return 'idle';
  }

  if (next.due_on && daysUntil(next.due_on) > 0) {
    return 'waiting';
  }

  return 'ready';
}

/**
 * Turns server copy such as "Follow up on 2026-10-13." into "Follow up on 13 Oct."
 */
export function humanizeDates(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) => formatShortDate(iso));
}

type Journey = { steps: string[]; indexFor: (stage: string | null) => number };

/**
 * Display-only map of where a playbook stage sits in its story. The server still owns transitions.
 */
const JOURNEYS: Record<string, Journey> = {
  sell_item: {
    steps: ['Value', 'Prepare', 'List', 'Offer', 'Sold', 'Paid'],
    indexFor: (stage) => ({ idea: 0, valuing: 0, preparing: 1, ready_to_list: 2, listed: 2, offer: 3, sold: 4, paid: 5 } as Record<string, number>)[stage ?? ''] ?? 0,
  },
  freelance: {
    steps: ['Reach out', 'Propose', 'Agreed', 'Work', 'Invoice', 'Paid'],
    indexFor: (stage) => ({ idea: 0, contact: 1, proposal: 1, agreed: 2, working: 3, invoiced: 4, paid: 5 } as Record<string, number>)[stage ?? ''] ?? 0,
  },
  recover_money: {
    steps: ['Pin it down', 'Waiting', 'Received'],
    indexFor: (stage) => ({ identified: 0, requested: 1, expected: 1, overdue: 1, received: 2 } as Record<string, number>)[stage ?? ''] ?? 0,
  },
  reduce_expense: {
    steps: ['Find it', 'Review', 'Decide', 'Done'],
    indexFor: (stage) => ({ identified: 0, reviewing: 1, action_taken: 2, confirmed: 3 } as Record<string, number>)[stage ?? ''] ?? 0,
  },
};

export function journeyFor(playbook: string | null): Journey | null {
  return playbook ? JOURNEYS[playbook] ?? null : null;
}

const GOOD_OUTCOMES = new Set(['paid', 'sold', 'received', 'cancelled', 'reduced']);

export function isGoodOutcome(outcome: string | null): boolean {
  return outcome != null && GOOD_OUTCOMES.has(outcome);
}

/** Server XP descriptions in product language. */
export function describeProgress(title: string | null | undefined): string {
  const bonus = title?.match(/^Outcome bonus at €(\d+)/);

  if (bonus) {
    return `Milestone bonus: first €${Number(bonus[1]).toLocaleString('en-GB')} on a mission`;
  }

  return title ?? 'Progress';
}
