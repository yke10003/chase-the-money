import type { Goal } from '@/api/types';
import { daysUntil, formatShortDate } from '@/lib/dates';

/** "October", "This week", "Until 31 Dec". */
export function goalPeriodName(goal: Goal): string {
  if (goal.rhythm === 'weekly') {
    return 'This week';
  }

  if (goal.rhythm === 'by_date') {
    return `Until ${formatShortDate(goal.ends_on)}`;
  }

  if (goal.anchor_day === 1 || goal.starts_on.endsWith('-01')) {
    const [year, month] = goal.starts_on.split('-').map((part) => Number.parseInt(part, 10));

    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  }

  return 'Monthly';
}

export function goalDaysLeft(goal: Goal): number {
  return Math.max(0, daysUntil(goal.ends_on) + 1);
}

export function goalRhythmSentence(goal: Pick<Goal, 'rhythm' | 'anchor_day' | 'starts_on' | 'ends_on'>): string {
  if (goal.rhythm === 'weekly') {
    return `Every week, starting ${WEEKDAY_NAMES[(goal.anchor_day ?? 1) - 1] ?? 'Monday'}`;
  }

  if (goal.rhythm === 'monthly') {
    return `Every month, starting on the ${ordinal(goal.anchor_day ?? 1)}`;
  }

  return `${formatShortDate(goal.starts_on)} to ${formatShortDate(goal.ends_on)}`;
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ordinal(day: number): string {
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';

  return `${day}${suffix}`;
}

const MILESTONES = [25, 50, 75, 100];

/** The highest milestone crossed between two progress readings, if any. */
export function crossedMilestone(before: number, after: number): number | null {
  const crossed = MILESTONES.filter((mark) => before < mark && after >= mark);

  return crossed.length > 0 ? crossed[crossed.length - 1] : null;
}
