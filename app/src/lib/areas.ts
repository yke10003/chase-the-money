import type { Opportunity, OpportunityType } from '@/api/types';

/**
 * Where a mission shows up. Build has no records yet.
 * A custom Earn mission has no playbook, so it sits with Freelance until Build has its own records.
 * Save stays out of the primary navigation and is reachable from All activity.
 */
export type Area = 'sell' | 'freelance' | 'recover' | 'save';

export function areaOf(mission: Pick<Opportunity, 'playbook' | 'type'>): Area | null {
  if (mission.playbook === 'sell_item' || mission.type === 'sell') {
    return 'sell';
  }

  if (mission.playbook === 'recover_money' || mission.type === 'recover') {
    return 'recover';
  }

  if (mission.playbook === 'reduce_expense' || mission.type === 'save') {
    return 'save';
  }

  if (mission.playbook === 'freelance' || mission.type === 'earn') {
    return 'freelance';
  }

  return null;
}

export function areaHref(area: Area | null): string {
  if (area === 'sell' || area === 'freelance' || area === 'recover') {
    return `/${area}`;
  }

  return '/opportunities';
}

export function askingMinor(mission: Opportunity): number | null {
  const value = mission.context?.asking_price_minor;

  return typeof value === 'number' ? value : null;
}

export const AREA_LABEL: Record<OpportunityType, string> = {
  earn: 'Freelance',
  sell: 'Sell',
  recover: 'Recover',
  save: 'A cost',
};
