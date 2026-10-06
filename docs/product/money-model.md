# Money model

**Decision.** Real-world money is the primary outcome. XP does not replace it and does not convert into it. See [gamification](gamification.md).

**Decision.** Self-reported amounts are acceptable for V1. There is no bank connection. See [principles](principles.md).

Examples below use euros because the [founder fixture](founder-fixture.md) does. **Open:** the default currency for a new user, and whether V1 supports more than one currency at a time. Settings lists currency as profile data, not as a locked default of EUR.

## Three layers

These layers must not be added together and presented as money the user already has.

### Realized

**Decision.** Money actually earned, received, sold, recovered, or concretely saved. This is what moves the user's financial goal.

### Expected

**Decision.** Money with a reasonably concrete path toward arriving.

Examples:

- an invoice awaiting payment
- an agreed repayment
- agreed work awaiting payment

### Potential / in play

**Decision.** Less certain opportunities. Potential money is never realized money.

Examples:

- a proposal awaiting acceptance
- an item that might sell for around €400
- a possible freelance lead

## How a goal display can look

**Likely V1.** A useful pattern, not a schema:

```text
€650 realized
€3,850 expected
€8,000 potential / in play
```

The goal itself is realized progress against a target, for example €650 / €2,000. Expected and potential are context. They do not fill the goal bar.

**Open.** Whether expected money can ever count toward a goal. The current principle is no: only realized money moves the goal.

## The four types are not interchangeable

**Decision.** Earn, Sell, Recover, and Save remain distinct in reporting.

€100 saved is not literally the same as €100 earned. Progress and any lifetime total may show a combined "financial impact" figure, but the breakdown by type stays visible. Do not label that combined figure as income.

## Recurring savings

**Decision.** Cancelling a subscription does not immediately book the annualized amount against the current goal.

If a €20/month subscription is cancelled, show:

- €20/month saved
- €240 annualized

Count only the relevant current-period impact toward the current-period money goal. For a monthly goal, that is €20 of realized Save in the month the saving takes effect, not €240 on day one.

**Open.** How later months of an already-cancelled subscription are realized. Options include counting €20 again each month automatically, or only counting the month of the action. Do not pick one in code until this is decided.

**Open.** Net versus gross for realized Earn amounts (invoice total versus what the user actually keeps). Mentioned as a possible Settings control only.

## Goal

**Decision.** The user has a money goal with an amount and a timeframe. Onboarding collects it. Home leads with it.

**Assumption.** Early examples use a calendar month ("October") or a chosen window ("this week", "next 30 days").

**Open.** Whether the goal resets automatically, how overlapping goals work, and which opportunity types count toward the goal by default. Settings says the user can choose which categories count. That control is likely, not specified in detail.

**Assumption.** Categories the user turns off are excluded from the goal, not deleted as opportunities.
