export type OpportunityType = 'earn' | 'sell' | 'recover' | 'save';

export type OpportunityStatus = 'explore' | 'active' | 'waiting' | 'completed' | 'abandoned' | 'paused';

export type ActionStatus = 'open' | 'completed';

export type GoalStatus = 'active' | 'completed' | 'abandoned';

export type SettlementMode = 'none' | 'partial' | 'full';

export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string | null;
};

export type Goal = {
  id: number;
  amount_minor: number;
  currency: string;
  starts_on: string;
  ends_on: string;
  status: GoalStatus;
  rhythm: 'weekly' | 'monthly' | 'by_date';
  anchor_day: number | null;
  recurring: boolean;
  included_types: OpportunityType[];
  realized_amount_minor: number;
  remaining_amount_minor: number;
  progress_percent: number;
  created_at: string | null;
  updated_at: string | null;
};

export type OpportunityAction = {
  id: number;
  opportunity_id: number;
  title: string;
  description: string | null;
  status: ActionStatus;
  estimated_minutes: number | null;
  xp_reward: number | null;
  sort_order: number;
  system_owned: boolean;
  playbook_key: string | null;
  due_on: string | null;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Opportunity = {
  id: number;
  type: OpportunityType;
  playbook: string | null;
  title: string;
  context: Record<string, unknown> | null;
  notes: string | null;
  status: OpportunityStatus;
  stage: string | null;
  outcome: string | null;
  stage_label: string;
  agreed_amount_minor: number | null;
  potential_min_minor: number | null;
  potential_max_minor: number | null;
  expected_amount_minor: number | null;
  currency: string;
  expected_on: string | null;
  effort: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  next_action: OpportunityAction | null;
};

export type PlaybookField = {
  key: string;
  label: string;
  type: 'money' | 'date' | 'text' | 'choice';
  required: boolean;
  prefill_minor: number | null;
  default: string | null;
  options?: Array<{ value: string; label: string }>;
};

export type PlaybookOutcome = {
  key: string;
  label: string;
  tone: 'primary' | 'secondary' | 'danger' | string;
  confirms_money: boolean;
  fields: PlaybookField[];
};

export type PlaybookActionView = {
  id: number;
  title: string;
  description: string | null;
  playbook_key: string | null;
  due_on: string | null;
  actionable: boolean;
  minutes_label: string | null;
  blocked_reason: string | null;
  completion: 'simple' | 'form';
  fields: PlaybookField[];
};

export type PlaybookView = {
  stage_label: string;
  headline: string;
  detail: string | null;
  money: Array<{ label: string; amount_minor: number; currency: string }>;
  action: PlaybookActionView | null;
  outcomes: PlaybookOutcome[];
  editable: PlaybookField[];
};

export type OpportunityDetail = Opportunity & {
  playbook_view: PlaybookView | null;
  actions: OpportunityAction[];
  impacts: FinancialImpact[];
  xp_events: XpEvent[];
};

export type FinancialImpact = {
  id: number;
  opportunity_id: number | null;
  type: OpportunityType;
  opportunity_title: string | null;
  amount_minor: number;
  currency: string;
  recurring_amount_minor: number | null;
  recurrence_interval: 'month' | 'year' | null;
  annualized_amount_minor: number | null;
  occurred_at: string | null;
  note: string | null;
  created_at: string | null;
};

export type XpEvent = {
  id: number;
  opportunity_id: number | null;
  opportunity_action_id: number | null;
  amount: number;
  reason: string;
  description: string | null;
  occurred_at: string | null;
};

export type Paginated<T> = {
  data: T[];
  meta?: { total?: number; current_page?: number; last_page?: number };
};

export type SuggestedAction = OpportunityAction & {
  opportunity_title: string;
  opportunity_type: OpportunityType;
  expected_on: string | null;
  why: string | null;
};

export type HomeView = {
  currency: string;
  goal: Goal | null;
  pipeline: {
    expected_amount_minor: number;
    potential_min_minor: number | null;
    potential_max_minor: number | null;
    unknown_potential_count: number;
  };
  suggested_actions: SuggestedAction[];
  actions_without_estimate: SuggestedAction[];
  money_in_motion: Opportunity[];
  weekly_momentum: {
    starts_on: string;
    ends_on: string;
    xp: number;
    actions_completed: number;
    opportunities_completed: number;
  };
  snapshot: Array<{
    type: OpportunityType;
    open_count: number;
    expected_amount_minor: number;
    potential_min_minor: number | null;
    potential_max_minor: number | null;
    unknown_potential_count: number;
  }>;
  recent_wins: Array<{
    kind: string;
    occurred_at: string | null;
    title: string | null;
    amount_minor: number | null;
    currency: string | null;
    xp: number | null;
  }>;
  starter_missions: StarterMission[];
};

export type StarterMission = {
  key: string;
  title: string;
  detail: string;
  destination: string;
};

export type CatalogOption = { key: string; label: string };

export type PersonalizationCatalog = {
  work_categories: CatalogOption[];
  skills: Record<string, string[]>;
  experience_levels: CatalogOption[];
  willing: CatalogOption[];
  excluded: CatalogOption[];
  availability: CatalogOption[];
  starting_capital: CatalogOption[];
  situation: CatalogOption[];
  money_hunt_categories: string[];
};

export type UserProfile = {
  work_categories: string[];
  experience_level: string | null;
  availability: string | null;
  starting_capital: string | null;
  willing: string[];
  excluded: string[];
  situation: string[];
  skills: Array<{ name: string; proficiency: string | null }>;
};

export type SkillMission = {
  title: string;
  detail: string;
  playbook: string;
  current_state: string;
  area: string | null;
};

export type DiscoverView = {
  money_hunt_categories: string[];
  skill_missions: SkillMission[];
  recovery_prompts: Array<{ kind: string; label: string }>;
  starter_missions: StarterMission[];
};

export type ProgressView = {
  period: string;
  starts_on: string;
  ends_on: string;
  currency: string;
  realized_amount_minor: number;
  realized_earn_minor: number;
  realized_sell_minor: number;
  realized_recover_minor: number;
  realized_save_minor: number;
  xp: number;
  xp_total: number;
  actions_completed: number;
  opportunities_completed: number;
  goal: Goal | null;
  series: Array<{ period: string; amount_minor: number }> | null;
};

export type SellStep = 'identity' | 'photos' | 'details' | 'research' | 'estimate' | 'done';

export type SellField = {
  key: string;
  label: string;
  placeholder?: string;
  choices?: string[];
  detail?: boolean;
};

export type SellCategory = {
  key: string;
  label: string;
  icon: string;
  condition_hint: string;
  subcategories: Array<{ key: string; label: string }>;
  identity: SellField[];
  details: SellField[];
};

export type SellShot = {
  key: string;
  recommended: boolean;
  title: string;
  guidance: string;
  icon: string;
  taken?: boolean;
};

export type SellCatalog = {
  categories: SellCategory[];
  conditions: Array<{ key: string; label: string }>;
  shots: Record<string, { title: string; guidance: string; icon: string }>;
};

export type SellPhoto = {
  id: number;
  url: string;
  shot_key: string | null;
  sort_order: number;
  is_cover: boolean;
};

export type SellComparable = {
  id: number;
  url: string;
  platform: string | null;
  amount_minor: number;
  state: 'sold' | 'asking' | 'unknown';
  note: string | null;
};

export type SellNextAction = {
  id: number;
  title: string;
  description: string | null;
  completion?: 'form' | 'simple';
  fields?: Array<{ key: string; label: string; type: string; required: boolean; prefill_minor?: number | null }>;
};

export type SellItemView = {
  id: number;
  opportunity_id: number;
  name: string | null;
  category: string;
  category_label: string;
  subcategory: string | null;
  subcategory_label: string | null;
  brand: string | null;
  condition: string | null;
  condition_label: string | null;
  details: Record<string, string>;
  value_min_minor: number | null;
  value_max_minor: number | null;
  value_confidence: 'sure' | 'rough' | null;
  currency: string;
  setup_step: SellStep;
  setup_done: boolean;
  origin: 'setup' | 'listed';
  next_step_label: string;
  xp_earned: number;
  research_prompt: string;
  cover_url: string | null;
  stage: string | null;
  stage_label: string;
  photos: SellPhoto[];
  comparables: SellComparable[];
  photo_plan: SellShot[];
  next: SellNextAction | null;
  asking_price_minor: number | null;
  listed_on: string | null;
};

export type OpportunityFilters = {
  status?: string;
  type?: string;
  needs_action?: boolean;
  search?: string;
  sort?: 'updated_desc' | 'updated_asc' | 'potential_desc';
};
