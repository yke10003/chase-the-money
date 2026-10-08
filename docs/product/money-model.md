# Money model

**Decision.** Real-world money is the primary outcome. XP does not replace it and does not convert into it. See [gamification](gamification.md).

**Decision.** Self-reported amounts are acceptable for V1. There is no bank connection. See [principles](principles.md).

Examples below use euros because the [founder fixture](founder-fixture.md) does.

**Decision.** Amounts are integer minor units. €400.00 is `40000`. Currency is a 3-letter ISO code on each goal, opportunity, and financial impact. There is no conversion table. See [0008](../decisions/0008-money-in-minor-units.md).

**Open.** The default currency for a new user, and whether V1 supports more than one currency in a single total. Rows can differ. Totals are computed per currency. Fixtures use EUR. That is not a schema lock and not a user-profile default.

## Three layers

These layers must not be added together and presented as money the user already has.

### Realized

**Decision.** Money actually earned, received, sold, recovered, or concretely saved. This is what moves the user's financial goal.

**Decision.** Realized money is a ledger of `financial_impacts` rows, not a mutable total on the opportunity. Record a new row instead of editing a running balance. Each row stores the user, an optional opportunity, the opportunity type, a title snapshot, the amount in minor units, the currency, when it happened, and a note. Deleting the opportunity keeps the ledger row. Rows are not frozen by a database trigger. See [0009](../decisions/0009-financial-impact-ledger.md).

**Decision.** The amount stored is the single figure that counts. A €425 sale with €15 of fees is recorded as €410 net. Gross and fees are not separate columns. The product question of a net-versus-gross setting is still open; until that exists, the user records the number that should move the goal, and the note can explain the arithmetic.

**Decision.** `recordRealizedImpact()` does not change expected or potential. The API can, only through an explicit settlement: `none` leaves the forecast alone, `partial` sets the remaining expected amount the client sends, and `full` clears expected. Full settlement completes the opportunity only when `complete` is true. Potential stays as a historical estimate. See [0014](../decisions/0014-explicit-settlement.md).

**Decision.** Open pipeline totals use opportunities in `explore`, `active`, or `waiting`. Completed, abandoned, and paused opportunities do not contribute expected or potential.

**Decision.** Potential is not collapsed into one number. Callers get the sum of known minimums, the sum of known maximums, and a count of open opportunities with no potential figure. There is no midpoint.

### Agreed

**Decision.** The amount the other person agreed to, stored as `agreed_amount_minor`. A proposal that has not been accepted does not have one. A later partial payment does not overwrite it. See [0024](../decisions/0024-proposal-agreed-realized.md).

### Expected

**Decision.** Money with a reasonably concrete path toward arriving. After a partial payment this is the amount still expected, not the original agreement.

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

**Decision.** A Save impact may also store a recurring amount and an interval of `month` or `year`. The annualized figure is calculated (`monthly * 12`, or the yearly amount itself). It is not stored, and it is not included in realized totals. Recurring fields are rejected on Earn, Sell, and Recover. There is no scheduler that posts next month's €20.

**Decision.** V1 does not create future monthly impact rows. The recurring amount and the annualized figure stay informational.

**Decision.** A reviewed cost that the user keeps writes no financial impact. The mission can still complete. See [0022](../decisions/0022-playbook-outcomes.md).

**Decision.** A recorded financial impact is not edited or reversed in this phase. Corrections to a quote, an agreed amount, or a date are allowed only before the first impact.

**Open.** Whether a later version should confirm each new month, or post it automatically. Not in this API.

**Open.** Net versus gross as a user setting. The ledger does not store both. It stores the one amount that counts.

**Decision.** A goal stores `included_types`. The default is all four. Its progress sums only impacts of those types, in its currency and date range. A period report still returns every type separately. See [0012](../decisions/0012-goal-included-types.md).

## Goal

**Decision.** The user has a money goal with an amount and a timeframe. Onboarding collects it. Home leads with it.

**Decision.** A goal is its own row: amount in minor units, currency, rhythm, and a status of `active`, `completed`, or `abandoned`. Weekly and monthly goals recur from `starts_on` and an anchor day. The app derives the current period. It does not insert a new goal each week or month, and it does not rewrite past impacts. A `by_date` goal is one window and stops being current after `ends_on`. See [0016](../decisions/0016-goal-rhythm.md).

**Assumption.** Early examples use a calendar month ("October") or a chosen window ("this week", "next 30 days").

**Open.** Whether a new period creates the next goal automatically, and which opportunity types count toward the goal by default. Settings says the user can choose which categories count. That control is likely, not specified in detail.

**Assumption.** Categories the user turns off are excluded from the goal, not deleted as opportunities.
