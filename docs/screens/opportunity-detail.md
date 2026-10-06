# Opportunity detail

**Not implemented.** Product intent only.

**Decision.** The page answers:

> What needs to happen next to turn this into money?

**Decision.** It is not generic project-management software. It connects an action to progress and a financial outcome.

## Sections

**Likely V1.**

- title, type, and status
- potential versus realized value
- a highly prominent next action
- lifecycle / progress
- action list
- money details
- activity / history
- notes and links

Expected amount belongs in money details when the opportunity has a concrete path. See [money model](../product/money-model.md).

## Lifecycle display

Show the domain-specific stages for the opportunity type, not the generic Explore / Active / Waiting list. Those generic states are for filters on the [Opportunities](opportunities.md) screen.

Example for Sell:

Valuing → Ready to list → Listed → Offer → Sold → Paid

**Assumption.** Those stage names are a sketch. They are not a final state machine. See [opportunity model](../product/opportunity-model.md).

## Waiting

**Decision.** If the opportunity is waiting, the page says that nothing is currently required. Do not nag the user into inventing busywork.

## Completing a financial outcome

**Decision.** A meaningful completion should feel rewarding. Example, not a specification of the animation or the XP award:

```text
+€410 realized

October total
€1,060 / €2,000

+25 XP

Achievement unlocked
```

The euro amounts follow the money model: only the realized portion moves the goal. +25 XP is an illustration from the exploratory scale, not the decided award.

## Actions

The action list is where execution is recorded. Finishing an action can award XP even when money has not landed. See [gamification](../product/gamification.md).
