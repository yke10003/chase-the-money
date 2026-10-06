# Opportunity model

Opportunity is the central domain concept.

**Decision.** An opportunity answers:

> What could improve my financial position, how much might it be worth, where is it now, and what should I do next?

Do not design the database schema from this page. The backend domain model is still to be designed. Properties and stages below are the conceptual model only.

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

## Likely properties

**Assumption.** An opportunity will eventually need something like:

- type: Earn, Sell, Recover, or Save
- title
- current status or stage
- estimated or potential amount, possibly as a range
- expected amount, where there is a concrete path
- realized amount
- next action
- expected date or deadline, when relevant
- rough effort
- notes
- external links
- timestamps and history

**Open.** Exact fields, whether amounts are single values or ranges, and how history is stored. Do not add product migrations until this is designed.

## Lifecycle

**Assumption.** There is a normalized conceptual lifecycle used for filters and cross-type reporting:

- Explore
- Active
- Waiting
- Completed
- Abandoned

**Assumption.** The user-facing stages are domain-specific. They are still subject to refinement when the backend model is designed. Do not treat the lists below as a final state machine.

### Earn

Idea → Contact → Proposal → Agreed → Working → Invoiced → Paid

### Sell

Idea → Valuing → Ready to list → Listed → Offer → Sold → Paid

### Recover

Identified → Requested → Expected → Overdue → Received

### Save

Identified → Reviewing → Action taken → Confirmed

**Open.** How conceptual states map onto these stages. A reasonable reading is that "Idea" / "Identified" are Explore, mid-stages are Active, stages such as "awaiting payment" or "awaiting response" are Waiting, and Paid / Received / Confirmed are Completed. That mapping is not agreed.

**Open.** Whether Abandoned is a user-facing stage, a hidden status, or both. The Opportunities filters currently discussed do not include an Abandoned chip. See [Opportunities](../screens/opportunities.md).

## Actions

**Decision.** An opportunity can have concrete actions. Much of the XP system operates here. The product rewards doing the work, not only filing the idea.

Example for a Versace jacket:

- identify the exact model
- research recent resale value
- take photos
- create the listing
- review an offer
- confirm payment

**Assumption.** Each opportunity has one prominent next action. Other actions can exist as a list.

**Open.** Whether actions are a separate stored entity, a checklist on the opportunity, or both. Do not build that storage yet.

## Needs attention

**Likely V1.** An opportunity can be flagged when it should be looked at again, for example:

- an invoice becomes overdue
- a proposal has gone unanswered
- a listing is stale
- an expected payment date passes
- nothing has progressed for some time

**Open.** The exact rules and time windows. "Needs attention" is a flag, not a lifecycle stage.

## Waiting

**Decision.** When an opportunity is in a waiting state, the product says that nothing is currently required. Waiting is a valid state, not a failure to use the app.

## Completed

**Likely V1.** Completed opportunities stay available as history. Completing a meaningful financial outcome should feel rewarding. See [opportunity detail](../screens/opportunity-detail.md).
