# Opportunities

**Not implemented.** Product intent only.

**Decision.** This screen is a working board of ways the user could become financially better off. Each row makes the next action obvious.

**Decision.** The default presentation is a structured list, not a Kanban board.

## Filters

**Likely V1.** Top-level status filters:

- All
- To explore
- Active
- Waiting
- Completed

**Assumption.** These map to the conceptual lifecycle in the [opportunity model](../product/opportunity-model.md): To explore = Explore, and so on. Abandoned is part of that conceptual lifecycle and is not in this filter list. **Open** whether abandoned opportunities are hidden, listed under All, or get their own filter later.

**Likely V1.** Secondary category filters:

- Earn
- Sell
- Recover
- Save

**Likely V1.** Additional filters that are useful but not required to sketch the screen:

- Needs attention
- Money pending

Needs attention is a flag, not a stage. See the opportunity model for example triggers. The exact rules are open.

## Sorting

**Likely V1.** Possible sorts:

- Recommended
- Highest value
- Quickest wins
- Recently updated
- Oldest untouched

**Open.** What "highest value" compares (potential, expected, or realized). It must not treat potential as realized. "Recommended" depends on personalization that does not exist yet.

## Rows

**Assumption.** A row shows type, title, money layer if known (potential, expected, or realized), and the next action.

Completed opportunities remain available as history.

**Decision.** This screen does not become a project-management board. Stages are a label on the row, not columns the user drags between.
