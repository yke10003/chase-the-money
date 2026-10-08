# All activity (opportunities)

The route is `/opportunities`. It is not in the navigation. Sell, Freelance and Recover each show their own work. This page is the full list, including Save and custom steps, linked from Progress. See [cockpits](../product/cockpits.md).

**Custom mission** is `/opportunities/new`, linked from this page. It is the advanced path: a name, a money type, and steps the person adds later. Cut a cost is on the same page. Sell, Freelance, Recover, and Build do not open it. Their add buttons go to `/sell/new`, `/freelance/new`, `/recover/new`, and `/build/new`.

The interface still calls a single record a mission on the detail screen ([0026](../decisions/0026-product-ui-language.md)).

**Decision.** This screen is a working board of ways the user could become financially better off. Each row makes the next step obvious. It is a structured list, not a Kanban board and not a CRM table.

## Views

A segmented control with counts: **In play** (explore, active, waiting), **Paused**, **Done** (completed and abandoned).

**In play** is grouped by what the mission needs from the user, derived from the next action's date:

1. **Ready for you.** The next action is available now. Overdue and due-today rows carry a tag.
2. **Waiting on others.** The next action is dated in the future. The row says what happens and when ("Follow up with client in 6 days").
3. **Needs a first step.** Custom missions with no step yet.

Rows within a group are ordered by the next action's date.

## Filters

Type chips (Earn, Sell, Recover, Save) toggle one type at a time. A search box filters titles.

**Decision.** The status filters and the sort control from the functional beta are replaced by the grouping above. "Highest potential" is not offered. It invites ranking by a number that is not money.

## Rows

Type glyph, title, playbook kind and state label ("Freelance · Proposal sent"), the next step or waiting line, an attention tag, and money with its certainty mark: expected if there is an expected amount, otherwise the possible range. Done rows show the finish date and a "Banked" tag for a good outcome.

The client loads every page of `GET /opportunities` (25 per page) and groups locally. That is fine for a personal board. A server-side grouped read is the next step if a board grows past a few hundred missions.

Completed missions stay available as history.
