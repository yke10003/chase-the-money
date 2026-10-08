# API

The Laravel app exposes a JSON API for the Expo web client. Product screens are not built yet.

Base path: `/api/v1`

`GET /api/status` is only a process check. It is not part of the product API.

## Authentication

**Decision.** First-party web auth is a Laravel session cookie via Sanctum. See [0013](../decisions/0013-sanctum-session-auth.md).

There is no token login and no social login. The `personal_access_tokens` table is migrated so a later native client can add Sanctum tokens without replacing this model. Nothing issues a token today.

Flow for Expo Web:

1. `GET /sanctum/csrf-cookie` with credentials, so the browser stores `XSRF-TOKEN`.
2. `POST /api/v1/register` or `POST /api/v1/login` with `Accept: application/json`, `Content-Type: application/json`, header `X-XSRF-TOKEN` set to the decoded cookie, and credentials included.
3. Later requests send the session cookie the same way.
4. `POST /api/v1/logout` ends the session.
5. `GET /api/v1/me` returns `{ id, name, email, created_at }`.

Requests from the web origin are stateful: Sanctum starts the session and checks CSRF. A call that does not come from a stateful origin can still log in, because the auth routes start a session themselves, but a browser on another origin must send the CSRF token.

## Local web setup

The API defaults to `http://localhost:8000`. Expo web defaults to `http://localhost:8081`.

Use the same host for both (`localhost` or `127.0.0.1`, not a mix). Cookies are not shared across those two hostnames.

In `api/.env`:

```text
APP_URL=http://localhost:8000
SESSION_DOMAIN=null
SANCTUM_STATEFUL_DOMAINS=localhost:8081,localhost:8000,127.0.0.1:8081,127.0.0.1:8000
CORS_ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
```

`CORS_ALLOWED_ORIGINS` is a comma-separated list. Credentials are allowed. `SESSION_SECURE_COOKIE` stays unset for local HTTP.

The Expo app should send `credentials: 'include'` on every API call.

## Response shape

- One record or a list uses Laravel's `data` envelope.
- Paginated lists add `links` and `meta`.
- Validation errors are Laravel's usual `422` body: `message` and `errors`.
- Another user's record is `403`. A nested id that does not belong to the parent is `404`.
- Dates are `YYYY-MM-DD`. Timestamps are ISO-8601.

Money is integer minor units plus a currency code on the same object. The client formats `40000` / `EUR` as €400.00. The API does not return floats for money.

`annualized_amount_minor` on an impact is a display figure. It is not part of `amount_minor` and must not be added into realized totals.

## Ownership

Every product query is limited to the authenticated user. The client does not send `user_id`. Goals, opportunities, actions, impacts, and XP are refused across users.

## Goals

Calendar dates are `starts_on` and `ends_on`, not timestamps. A goal's `included_types` is `earn`, `sell`, `recover`, and/or `save`. The default is all four.

At most one **active** goal may cover any calendar day for a user. A conflicting create or update returns `422`. Completed and abandoned goals do not occupy the calendar.

`realized_amount_minor` on a goal sums financial impacts in that goal's currency and date range whose type is included. Other types stay in the ledger and in Progress breakdowns, but they do not move that goal.

```text
GET    /api/v1/goals
GET    /api/v1/goals/current
POST   /api/v1/goals
GET    /api/v1/goals/{goal}
PATCH  /api/v1/goals/{goal}
POST   /api/v1/goals/{goal}/complete
POST   /api/v1/goals/{goal}/abandon
```

`GET /goals/current` returns `{ "data": null }` when nothing covers today.

## Opportunities

```text
GET    /api/v1/opportunities
POST   /api/v1/opportunities
GET    /api/v1/opportunities/{opportunity}
PATCH  /api/v1/opportunities/{opportunity}
DELETE /api/v1/opportunities/{opportunity}
POST   /api/v1/opportunities/{opportunity}/complete
POST   /api/v1/opportunities/{opportunity}/abandon
POST   /api/v1/opportunities/{opportunity}/reopen
```

List filters: `status`, `type`, `search` (title), `needs_action=1`, `sort`.

`needs_action=1` means the opportunity is not completed, abandoned, or paused, and it has an open action whose `due_on` is null or today or earlier. It is not a stored "needs attention" flag.

`sort` is `updated_desc` (default), `updated_asc`, or `potential_desc` (highest known maximum, unknowns last). There is no Recommended sort and no Quickest-wins sort.

`PATCH` edits fields such as title, notes, stage, amounts, and effort. It does not complete, abandon, or reopen. Stage must belong to the opportunity type.

`reopen` accepts an optional `status` of `explore`, `active`, or `waiting`. The default is `active`. It clears `completed_at` and `abandoned_at`. Actions, impacts, and XP stay. There is no status-history table.

Deleting an opportunity deletes its actions and keeps impact and XP rows.

Detail includes `playbook_view`, `actions`, `impacts`, and `xp_events`. `playbook_view` is the stage label, headline, money lines, current action, allowed outcomes, and editable fields. List includes `stage_label`, `outcome`, and `next_action`.

Dates the user sends on goals, playbooks, and action completion are `YYYY-MM-DD` only.

`POST /api/v1/opportunities/{opportunity}/complete` is rejected for a playbook mission.

## Actions

```text
POST   /api/v1/opportunities/{opportunity}/actions
PATCH  /api/v1/opportunities/{opportunity}/actions/{action}
DELETE /api/v1/opportunities/{opportunity}/actions/{action}
POST   /api/v1/opportunities/{opportunity}/actions/{action}/complete
```

`complete` calls the domain method. A second call does not add XP. A completed action cannot be edited or deleted (`422`).

## Impacts and settlement

```text
POST /api/v1/opportunities/{opportunity}/impacts
```

`Opportunity::recordRealizedImpact()` only writes the ledger. This endpoint is the explicit settlement command. See [0014](../decisions/0014-explicit-settlement.md).

`settlement` is required:

| Value | Effect |
| --- | --- |
| `none` | Ledger row only. Expected, potential, and status stay as they are. `complete` must be false. |
| `partial` | Ledger row, then set expected to `remaining_expected_minor`. `0` clears it. The opportunity stays open. |
| `full` | Ledger row, clear expected, and complete the opportunity only when `complete` is true. Potential is left in place. |

Currency must match the opportunity. Recurring fields are only valid on Save. `annualized_amount_minor` is calculated, not stored, and is not realized money. Nothing creates next month's row.

The response is `{ data: { impact, opportunity } }`.

## Home

`GET /api/v1/home`

`GET /api/v1/home?available_minutes=30`

One read model for the command center:

- `goal` — current goal, or null. Progress respects `included_types`.
- `pipeline` — open opportunities only, in the goal currency (EUR if there is no current goal): expected sum, potential minimum sum, potential maximum sum, unknown count. No midpoint.
- `suggested_actions` — open actions that are actionable now, on opportunities that are not completed, abandoned, or paused. A `waiting` mission is included when its action is due. Ordered by overdue, then due today, then other dated actions, then untouched opportunities, then shorter known effort. With `available_minutes`, only actions whose `estimated_minutes` are known and small enough, plus a freelance "do the work" milestone. This is a sort, not a recommendation. `why` is Overdue, Due today, Due soon, Quick win, or Waiting on you.
- `actions_without_estimate` — only present as a separate list when `available_minutes` is set, and only when that opportunity had no action that fit.
- `money_in_motion` — open opportunities that have expected or potential money.
- `weekly_momentum` — XP, actions completed, and opportunities completed this calendar week. No quests.
- `snapshot` — per type: open count, expected, potential min/max, unknown count.
- `recent_wins` — latest financial impacts and XP events. Completed actions that awarded XP show up as XP events. There is no separate activity table.
- `starter_missions` — up to four deterministic next steps from the profile. Shown when the user has no fitting action.

Completed, abandoned, and paused opportunities are absent from pipeline, snapshot, money in motion, and suggestions.

## Progress

`GET /api/v1/progress?period=30d`

`period` is `goal`, `7d`, `30d`, `year`, or `all`. Default `30d`.

Returns realized totals and the four-type breakdown for the window (all types, not filtered by the goal), XP in the window, lifetime XP, completion counts, the current goal (whose own progress is filtered by `included_types`), and a `series`.

`series` is daily for `goal`, `7d`, and `30d`, monthly for `year`, and null for `all`. Each point is `{ period, amount_minor }` of realized impact. It does not include annualized savings.

## Goal rhythm

`POST /api/v1/goals` accepts `rhythm` of `weekly`, `monthly`, or `by_date`, and `anchor_day`.

For weekly and monthly goals the client may omit dates. The row stores the rhythm and anchor, and `ends_on` stays null. `GET /goals/current` returns the period that contains today, so the same goal covers the next week or month without a new row. Monday is weekday 1. A monthly anchor is 1–28. A dated goal still sends both dates and does not roll. See [0016](../decisions/0016-goal-rhythm.md).

`included_types` still exists and still defaults to all four. The normal client does not send it.

## Profile, plan, and Discover

`GET /api/v1/profile/catalog` returns the chip lists.

`GET /api/v1/profile` and `PUT /api/v1/profile` store work categories (`work_categories`, a list of catalog keys, see [0025](../decisions/0025-multiple-work-areas.md)), experience, availability, starting capital, willingness, exclusions, situation flags, and skills. A field that is left out of a later update is kept. Starting capital is stored and does not change Discover. See [0017](../decisions/0017-personalization-storage.md).

`DELETE /api/v1/account` deletes the signed-in user. The body is `{ "password": "..." }`. It does not take a user id. The password must match. The user row, profile, skills, goals, opportunities, actions, financial impacts, XP events, and personal access tokens go with it. The current session ends. There is no recovery. The email can be registered again.

`GET /api/v1/plan` and `GET /api/v1/discover` return deterministic missions. They do not call a model and they do not promise income. Each Discover skill mission has an `area` (a work category key, or null for the generic fallback).

## Playbooks

`POST /api/v1/playbooks/{playbook}` with `sell_item`, `freelance`, `recover_money`, or `reduce_expense` creates the opportunity and the one action for the starting state.

`POST /api/v1/opportunities/{opportunity}/actions/{action}/complete` accepts that action's answers. `xp_reward` is rejected. An action with a future `due_on` is rejected. A follow-up is not completed here.

`POST /api/v1/opportunities/{opportunity}/events` reports an outcome such as `accepted`, `declined`, `followed_up`, `paid`, `partial`, `offer`, `reject_offer`, `keep`, or `written_off`. The body is the fields that outcome asks for. An outcome that does not fit the current state is a validation error. The handler is transactional.

`PATCH /api/v1/opportunities/{opportunity}/playbook` corrects a date or an amount the playbook still allows. After a financial impact exists, money fields are rejected.

`POST /api/v1/opportunities/{opportunity}/pause` and `.../resume` set `paused`, then `active` or `waiting`.

Custom actions, only on a mission with no playbook, take `effort` of `quick`, `medium`, or `deep` instead of an XP number.

## Onboarding

The client saves a goal, then a profile, then opens Home, which shows `starter_missions` when nothing else is actionable. Situation flags do not create generic opportunities. A mission is created only when the user starts one from the plan or from Discover.

## Founder data

```bash
php artisan db:seed --class=FounderFixtureSeeder
```

That user is `founder@example.test` / `password`. The default seeder does not create it.
