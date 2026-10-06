# Home

**Not implemented.** Product intent only.

**Decision.** Home is a command center. It is not a finance dashboard and it is not an analytics page. Charts belong on [Progress](progress.md), if they ship.

The real-money goal is more prominent than XP.

## 1. Monthly / current goal hero

**Decision.** This is the top of the page.

Example:

```text
October goal
€650 / €2,000
€1,350 remaining
```

Secondary figures may include:

```text
€650 realized
€3,850 expected
€8,000 potential
```

**Decision.** Only realized money fills the goal. Expected and potential are context. See [money model](../product/money-model.md).

The month name and the amounts are examples from the [founder fixture](../product/founder-fixture.md), not default data.

## 2. What should I do now?

**Decision.** This block is highly prominent.

The user can say roughly how much time they have:

- 10 min
- 30 min
- 1 hour
- Deep work

The product then suggests relevant existing actions.

Examples:

| Time | Suggestion |
| --- | --- |
| 10 min | Message a previous colleague. |
| 30 min | Research Versace resale value. |
| 1 hour | Photograph and list an old outfit. |

**Assumption.** Suggestions come from actions already on opportunities before Discover invents new work. That matches principle 10.

**Open.** The exact time buckets, and what to show when nothing on the board fits the selected time. A fallback into a short Discover prompt (Quick Wins) is plausible and not decided.

## 3. Money in motion

**Likely V1.** A compact list of opportunities already underway.

Examples:

- €250 friend repayment — expected
- €3,000 invoice — payment pending
- ~€400 Versace jacket — needs valuation
- freelance proposal — awaiting response

The €3,000 invoice is an illustration. The founder fixture does not state that invoice amount. Do not treat €3,000 as fixture data. See [founder fixture](../product/founder-fixture.md).

**Decision.** A waiting item can appear here and should still read as "nothing required right now" when that is the case. See [opportunity detail](opportunity-detail.md).

## 4. Weekly momentum

**Likely V1.** Show weekly XP, active quests, and a rough level. Keep this secondary to the money goal.

Quest copy and the XP curve are not finalized. See [gamification](../product/gamification.md).

## 5. Opportunity snapshot

**Likely V1.** A quick overview of Earn, Sell, Recover, and Save with active counts and a rough value.

**Open.** Which amount the "rough value" uses. It must not be a single number that adds potential to realized. Prefer a per-type potential or expected figure, labeled as such.

## 6. Proactive suggestion

**Likely V1.** One coaching or discovery prompt.

Examples:

- "You probably have more money hiding around your house."
- "Your freelance pipeline currently depends on one deal."

**Assumption.** This is one suggestion, not a feed. It should be suppressible once Discover learns "not for me" or "never suggest this category."

## 7. Recent wins

**Likely V1.** A short activity list of meaningful events.

Examples:

- +€250 payment confirmed
- +50 XP proposal sent
- achievement unlocked

**Decision.** Do not expand this into an analytics timeline. The +50 XP figure is illustrative, not the award for sending a proposal.

## Explicitly out of scope for Home

- category-over-time charts
- bank balances
- a full opportunity board (that is [Opportunities](opportunities.md))
- social leaderboards
