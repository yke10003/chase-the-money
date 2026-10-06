# Founder fixture

**Decision.** Use this as the main realistic scenario in design, copy, and manual testing. It is the founder's current situation, not a database seeder and not a promise that these records ship as demo data.

Examples use euros. That does not by itself decide the product's default currency. See [money model](money-model.md).

## Earn

- There is a potential freelance job.
- A proposal is being sent or is awaiting a response.
- The user does not want the pipeline to depend on that one lead.
- About 10 previous peers or colleagues could be contacted.
- A LinkedIn availability post could be published.
- The user wants to track whether the proposal is accepted and how much money eventually results.

**Money reading.** The open proposal is potential, not realized and not expected, until the work is agreed. Contacting colleagues and posting availability are actions, not separate money yet. If they produce a lead, that lead is a new Earn opportunity or an action on the pipeline, not an automatic euro amount.

## Sell

### Versace jacket

- Exact value is unknown.
- Similar items have gone for substantial amounts.
- The user would probably accept roughly €400.
- The next work is valuation and research, not listing.

Roughly €400 is potential. It is not realized, and it is not expected.

### Silver collection

- Some silver is mixed with other metals.
- Value depends on weight and purity.
- The user wants to sell it.
- It needs valuation before any amount is more than a guess.

### Halloween jacket / gilet

- Roughly €200.
- The user is willing to sell it.

### Other possessions

The user wants guided inspiration for other things they own that may be worth selling. That is a Discover job (Money Hunt), not an opportunity until a specific item is captured. Do not run the full Money Hunt during onboarding. See [onboarding](../screens/onboarding.md) and [Discover](../screens/discover.md).

## Recover

- An outstanding invoice is expected to be paid. The amount is not stated in this fixture. Do not invent one.
- €250 is coming from an old deal with a friend. Treat this as expected if the repayment is agreed, which is how the fixture describes it.
- Taxes still need to be filed and may result in money being returned. That is potential until a refund amount is actually identified. Filing taxes can be the next action.

## Save

Review current subscriptions and decide which are actually necessary. Nothing has been cancelled yet, so there is no realized saving.

If a €20/month subscription were cancelled, follow the recurring-savings rule in the [money model](money-model.md). Do not book €240 against the current goal on the day of cancellation.

## Explicitly not an opportunity

**Decision.** A potential cost from a legal dispute with a landlord is not part of the hustle score.

A liability is not an opportunity. The app is for actions the user can take to improve their position. If some action could reduce or avoid that cost, that action could qualify as Save or Recover. The dispute itself does not get an opportunity row.

## How to use this in later work

When a screen needs sample content, derive it from this fixture instead of inventing a generic freelancer or a random budget. Keep the three money layers straight:

| Item | Layer |
| --- | --- |
| Friend repayment, €250 | Expected |
| Outstanding invoice, amount unknown | Expected, amount unknown |
| Possible tax refund | Potential until identified |
| Freelance proposal | Potential |
| Versace jacket, ~€400 acceptable | Potential |
| Halloween outfit, ~€200 | Potential |
| Silver collection | Potential, amount not yet estimated |
| Subscriptions not yet reviewed | No money recorded |

Do not present a summed "you have €X" that mixes these layers.
