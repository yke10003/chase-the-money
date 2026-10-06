# 0005. Money and XP are separate

- Date: 2026-10-06
- Status: accepted

## Decision

Realized money is the primary outcome and the only thing that moves the user's money goal. XP measures effort and momentum. Achievements mark permanent milestones. None of these convert into the others.

Potential money is never shown as realized. Cancelling a €20/month subscription does not immediately count €240 toward the current goal.

## Context

The product is a game wrapped around real financial action. If XP or hopeful pipeline value fills the goal, the game is about points instead of money.

## Rationale

People will otherwise procrastinate, or feel rewarded for a proposal that was never accepted. Separating the layers lets the product praise execution before the money arrives without pretending the money is already there.

## Consequences

- Home leads with the money goal. XP is secondary.
- Dashboards that need one number still label realized, expected, and potential separately.
- Recurring Save shows the monthly amount and the annualized amount, and only the current-period impact counts toward the current goal.
- The exploratory XP table in [gamification](../product/gamification.md) is not part of this decision. Award values are still open.
- How later months of an already-cancelled subscription are realized is still open.
