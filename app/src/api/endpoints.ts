import { apiRequest, apiUpload } from '@/api/client';
import { ApiError } from '@/lib/errors';
import type {
  DiscoverView,
  Goal,
  HomeView,
  Opportunity,
  OpportunityDetail,
  OpportunityFilters,
  OpportunityType,
  Paginated,
  SellCatalog,
  SellItemView,
  PersonalizationCatalog,
  ProgressView,
  SettlementMode,
  User,
  UserProfile,
} from '@/api/types';

export async function getMe(): Promise<User | null> {
  try {
    const body = await apiRequest<{ data: User }>('/v1/me');

    return body.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export function register(input: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<{ data: User }> {
  return apiRequest('/v1/register', { method: 'POST', body: input });
}

export function login(input: { email: string; password: string }): Promise<{ data: User }> {
  return apiRequest('/v1/login', { method: 'POST', body: input });
}

export function logout(): Promise<void> {
  return apiRequest('/v1/logout', { method: 'POST' });
}

export function deleteAccount(password: string): Promise<void> {
  return apiRequest('/v1/account', { method: 'DELETE', body: { password } });
}

export async function getCurrentGoal(): Promise<Goal | null> {
  const body = await apiRequest<{ data: Goal | null }>('/v1/goals/current');

  return body.data;
}

export function createGoal(input: {
  amount_minor: number;
  currency: string;
  starts_on?: string;
  ends_on?: string;
  rhythm?: 'weekly' | 'monthly' | 'by_date';
  anchor_day?: number | null;
  included_types?: OpportunityType[];
  status?: string;
}): Promise<{ data: Goal }> {
  return apiRequest('/v1/goals', { method: 'POST', body: input });
}

export function updateGoal(
  id: number,
  input: Partial<{
    amount_minor: number;
    currency: string;
    starts_on: string;
    ends_on: string;
    included_types: OpportunityType[];
  }>,
): Promise<{ data: Goal }> {
  return apiRequest(`/v1/goals/${id}`, { method: 'PATCH', body: input });
}

export function getHome(availableMinutes: number | null): Promise<{ data: HomeView }> {
  const query = availableMinutes ? `?available_minutes=${availableMinutes}` : '';

  return apiRequest(`/v1/home${query}`);
}

export function listOpportunities(filters: OpportunityFilters): Promise<Paginated<Opportunity>> {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set('status', filters.status);
  }

  if (filters.type) {
    params.set('type', filters.type);
  }

  if (filters.needs_action) {
    params.set('needs_action', '1');
  }

  if (filters.search) {
    params.set('search', filters.search);
  }

  if (filters.sort) {
    params.set('sort', filters.sort);
  }

  const query = params.toString();

  return apiRequest(`/v1/opportunities${query ? `?${query}` : ''}`);
}

/**
 * Every mission across pages. The API pages by 25; a personal board stays small enough to read in full.
 */
export async function listAllOpportunities(filters: OpportunityFilters = {}): Promise<Opportunity[]> {
  const params = new URLSearchParams();

  if (filters.type) {
    params.set('type', filters.type);
  }

  if (filters.search) {
    params.set('search', filters.search);
  }

  const all: Opportunity[] = [];
  let page = 1;
  let last = 1;

  do {
    params.set('page', String(page));
    const body = await apiRequest<Paginated<Opportunity>>(`/v1/opportunities?${params.toString()}`);
    all.push(...body.data);
    last = body.meta?.last_page ?? 1;
    page++;
  } while (page <= last && page <= 20);

  return all;
}

export function getOpportunity(id: number): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/opportunities/${id}`);
}

export function createOpportunity(input: Record<string, unknown>): Promise<{ data: OpportunityDetail }> {
  return apiRequest('/v1/opportunities', { method: 'POST', body: input });
}

export function updateOpportunity(id: number, input: Record<string, unknown>): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/opportunities/${id}`, { method: 'PATCH', body: input });
}

export function deleteOpportunity(id: number): Promise<void> {
  return apiRequest(`/v1/opportunities/${id}`, { method: 'DELETE' });
}

export function opportunityCommand(id: number, command: 'complete' | 'abandon' | 'reopen', body?: unknown): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/opportunities/${id}/${command}`, { method: 'POST', body: body ?? {} });
}

export function createAction(opportunityId: number, input: Record<string, unknown>) {
  return apiRequest(`/v1/opportunities/${opportunityId}/actions`, { method: 'POST', body: input });
}

export function updateAction(opportunityId: number, actionId: number, input: Record<string, unknown>) {
  return apiRequest(`/v1/opportunities/${opportunityId}/actions/${actionId}`, { method: 'PATCH', body: input });
}

export function deleteAction(opportunityId: number, actionId: number): Promise<void> {
  return apiRequest(`/v1/opportunities/${opportunityId}/actions/${actionId}`, { method: 'DELETE' });
}

export function completeAction(opportunityId: number, actionId: number, input: Record<string, unknown> = {}) {
  return apiRequest(`/v1/opportunities/${opportunityId}/actions/${actionId}/complete`, { method: 'POST', body: input });
}

export function reportEvent(
  opportunityId: number,
  input: Record<string, unknown>,
): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/opportunities/${opportunityId}/events`, { method: 'POST', body: input });
}

export function updatePlaybook(
  opportunityId: number,
  input: Record<string, unknown>,
): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/opportunities/${opportunityId}/playbook`, { method: 'PATCH', body: input });
}

export function pauseOpportunity(opportunityId: number): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/opportunities/${opportunityId}/pause`, { method: 'POST' });
}

export function resumeOpportunity(opportunityId: number): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/opportunities/${opportunityId}/resume`, { method: 'POST' });
}

export function startPlaybook(playbook: string, input: Record<string, unknown>): Promise<{ data: OpportunityDetail }> {
  return apiRequest(`/v1/playbooks/${playbook}`, { method: 'POST', body: input });
}

export function getCatalog(): Promise<{ data: PersonalizationCatalog }> {
  return apiRequest('/v1/profile/catalog');
}

export function getProfile(): Promise<{ data: UserProfile }> {
  return apiRequest('/v1/profile');
}

export function saveProfile(input: Record<string, unknown>): Promise<{ data: UserProfile }> {
  return apiRequest('/v1/profile', { method: 'PUT', body: input });
}

export function getDiscover(): Promise<{ data: DiscoverView }> {
  return apiRequest('/v1/discover');
}

export function recordImpact(
  opportunityId: number,
  input: {
    amount_minor: number;
    currency: string;
    occurred_at?: string;
    note?: string | null;
    settlement: SettlementMode;
    remaining_expected_minor?: number;
    complete?: boolean;
    recurring_amount_minor?: number;
    recurrence_interval?: 'month' | 'year';
  },
) {
  return apiRequest(`/v1/opportunities/${opportunityId}/impacts`, { method: 'POST', body: input });
}

export function getSellCatalog(): Promise<{ data: SellCatalog }> {
  return apiRequest('/v1/sell/catalog');
}

export function listSellItems(): Promise<{ data: SellItemView[] }> {
  return apiRequest('/v1/sell/items');
}

export function getSellItem(id: number): Promise<{ data: SellItemView }> {
  return apiRequest(`/v1/sell/items/${id}`);
}

export function createSellItem(input: {
  category: string;
  subcategory?: string | null;
  name?: string | null;
  worth_minor?: number | null;
}): Promise<{ data: SellItemView }> {
  return apiRequest('/v1/sell/items', { method: 'POST', body: input });
}

export function createListedItem(input: {
  title: string;
  category: string;
  subcategory?: string | null;
  listed_on: string;
  listing_url?: string | null;
  asking_price_minor: number;
  listed_on_date?: string | null;
}): Promise<{ data: SellItemView }> {
  return apiRequest('/v1/sell/items/listed', { method: 'POST', body: input });
}

export function updateSellItem(
  id: number,
  input: {
    name?: string | null;
    brand?: string | null;
    condition?: string | null;
    details?: Record<string, string>;
    advance?: boolean;
  },
): Promise<{ data: SellItemView }> {
  return apiRequest(`/v1/sell/items/${id}`, { method: 'PATCH', body: input });
}

export function finishSellItem(
  id: number,
  input: {
    unknown?: boolean;
    value_min_minor?: number | null;
    value_max_minor?: number | null;
    value_confidence?: 'sure' | 'rough' | null;
  },
): Promise<{ data: SellItemView }> {
  return apiRequest(`/v1/sell/items/${id}/finish`, { method: 'POST', body: input });
}

export function uploadSellPhoto(id: number, body: FormData): Promise<{ data: SellItemView }> {
  return apiUpload(`/v1/sell/items/${id}/photos`, body);
}

export function reorderSellPhotos(id: number, ids: number[]): Promise<{ data: SellItemView }> {
  return apiRequest(`/v1/sell/items/${id}/photos/reorder`, { method: 'POST', body: { ids } });
}

export function coverSellPhoto(id: number, photoId: number): Promise<{ data: SellItemView }> {
  return apiRequest(`/v1/sell/items/${id}/photos/${photoId}/cover`, { method: 'POST' });
}

export function deleteSellPhoto(id: number, photoId: number): Promise<{ data: SellItemView }> {
  return apiRequest(`/v1/sell/items/${id}/photos/${photoId}`, { method: 'DELETE' });
}

export function addSellComparable(
  id: number,
  input: { url: string; amount_minor: number; state: 'sold' | 'asking' | 'unknown'; note?: string | null },
): Promise<{ data: SellItemView }> {
  return apiRequest(`/v1/sell/items/${id}/comparables`, { method: 'POST', body: input });
}

export function deleteSellComparable(id: number, comparableId: number): Promise<void> {
  return apiRequest(`/v1/sell/items/${id}/comparables/${comparableId}`, { method: 'DELETE' });
}

export function getProgress(period: string, type?: OpportunityType): Promise<{ data: ProgressView }> {
  const query = new URLSearchParams({ period });

  if (type) {
    query.set('type', type);
  }

  return apiRequest(`/v1/progress?${query.toString()}`);
}
