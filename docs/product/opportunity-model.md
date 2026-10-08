# Opportunity model

Opportunity is the central domain concept.

**Decision.** An opportunity answers:

> What could improve my financial position, how much might it be worth, where is it now, and what should I do next?

The Laravel model is implemented. See [Implemented model](#implemented-model) and [0008](../decisions/0008-money-in-minor-units.md) through [0011](../decisions/0011-status-and-stage.md). Stages below are the initial vocabulary, not a final state machine.

## Types

**Decision.** There are four types. They stay distinct in reporting. See [money model](money-model.md).

### Earn

Create money using time or skills.

Examples: freelance work, consulting, building a software product, paid services.

### Sell

Turn existing possessions or assets into cash.

Examples: designer clothing, electronics, collectibles, precious metals.

### Recover

Get money that is already owed, claimable, refundable, or otherwise potentially recoverable.

Examples: outstanding invoice, friend repayment, tax refund, reimbursement, eligible refund.

### Save

Take an intentional action that reduces expenditure.

Examples: cancel an unused subscription, downgrade a service, renegotiate a recurring cost.

## What is not an opportunity

**Decision.** A potential liability is not an opportunity. The app focuses on things the user can actively do to improve their financial position.

The founder fixture calls this out: a possible cost from a legal dispute with a landlord is not part of the hustle. If there is an action that can reduce or avoid such a cost, that action could qualify as Save or Recover. The liability itself does not.

## Implemented model

**Decision.** An opportunity is one row. It belongs to a user.

Stored today:

- type: `earn`, `sell`, `recover`, or `save`
- title and notes
- normalized status: `explore`, `active`, `waiting`, `paused`, `completed`, `abandoned`
- stage: a nullable string, checked against the vocabulary below in PHP, not a database enum
- `outcome`: why a guided mission ended, nullable. See [0022](../decisions/0022-playbook-outcomes.md)
- potential minimum and maximum, in minor units, each nullable
- `agreed_amount_minor`, nullable. See [0024](../decisions/0024-proposal-agreed-realized.md)
- expected amount, in minor units, nullable. After a partial payment this is what is still expected
- currency, an ISO code stored on the row
- `expected_on`, a nullable date
- rough effort: `tiny`, `small`, `medium`, `large`, `major`, nullable
- `completed_at` and `abandoned_at`

**Decision.** Potential and expected describe the current estimate. They are not realized history. Both can be unknown. A point estimate sets minimum and maximum to the same value. A range sets both. See [money model](money-model.md).

**Decision.** Realized money is not a column on the opportunity. It is the sum of [financial impact](money-model.md) rows.

**Decision.** The next action is the first open action by `sort_order`, then id. It is not stored separately.

**Decision.** Normalized status and stage are independent. Changing a stage does not move the status, and completing an opportunity does not force a stage such as `paid`. The mapping suggested below is still open.

**Decision.** Completing or abandoning an opportunity keeps its actions and financial impacts. Completion does not by itself record money or XP. `completed_at` is the current completion time. Reopening into `explore`, `active`, or `waiting` clears `completed_at` and `abandoned_at`. There is no status-history table. See [0015](../decisions/0015-reopen-without-status-history.md).

**Deferred.** External links are not a column. A URL can sit in notes until that is worth its own field.

**Deferred.** "Needs attention" is not stored. The rules are still open. `expected_on` and `updated_at` are enough to derive a flag later.

## Likely properties that are still open

**Open.** Whether abandoned opportunities get their own filter chip. The status exists. The Opportunities screen list does not include that chip yet. See [Opportunities](../screens/opportunities.md).

## Lifecycle

**Decision.** Normalized status, used for filters and cross-type reporting, is:

- Explore
- Active
- Waiting
- Paused
- Completed
- Abandoned

**Decision.** User-facing stages are strings, one vocabulary per type. The lists below are the initial catalog in `OpportunityStageCatalog`. They are not a database enum and not a final state machine. Adding or renaming a stage is a code change, not a migration. A stage from the wrong type is rejected.

### Earn

Idea → Contact → Proposal → Agreed → Working → Invoiced → Paid

### Sell

Idea → Valuing → Preparing → Ready to list → Listed → Offer → Sold → Paid

### Recover

Identified → Requested → Expected → Overdue → Received

### Save

Identified → Reviewing → Action taken → Confirmed

**Open.** How conceptual states map onto these stages. A reasonable reading is that "Idea" / "Identified" are Explore, mid-stages are Active, stages such as "awaiting payment" or "awaiting response" are Waiting, and Paid / Received / Confirmed are Completed. That mapping is not agreed.

**Open.** Whether the Opportunities screen gets an Abandoned chip. Abandoned is a normalized status, not one of the type-specific stages. See [Opportunities](../screens/opportunities.md).

## Actions

**Decision.** Actions are their own rows. Completing one keeps it. It is not deleted.

An action has a title, optional description, open/completed status, optional estimated minutes, an optional intended XP reward, a sort order, an optional `due_on` calendar date, and `completed_at`. A null duration is allowed for a milestone such as finishing freelance work. See [0021](../decisions/0021-scheduled-action-availability.md).

The intended XP reward is not the ledger. Completing the action writes one XP event for that reward, and a second completion does not write another. The sketch XP numbers are still not constants. See [gamification](gamification.md).

Example for a Versace jacket:

- identify the exact model
- research recent resale value
- take photos
- create the listing
- review an offer
- confirm payment

**Decision.** Each opportunity has one derived next action: the first open action. The rest of the list stays visible.

## Needs attention

**Likely V1.** An opportunity can be flagged when it should be looked at again, for example:

- an invoice becomes overdue
- a proposal has gone unanswered
- a listing is stale
- an expected payment date passes
- nothing has progressed for some time

**Open.** The exact rules and time windows. "Needs attention" is a flag, not a lifecycle stage.

## Waiting

**Decision.** When an opportunity is in a waiting state and its next action is not due yet, the product says that nothing is currently required. Waiting is a valid state, not a failure to use the app. Once `due_on` arrives, that action is the next thing to do even if the status is still waiting.

## Completed

**Likely V1.** Completed opportunities stay available as history. Completing a meaningful financial outcome should feel rewarding. See [opportunity detail](../screens/opportunity-detail.md).
