# 0016. Goal rhythm

- Date: 2026-10-06
- Status: accepted

## Decision

A goal stores `rhythm` (`weekly`, `monthly`, or `by_date`) and an optional `anchor_day`.

Weekly and monthly goals are recurring. One row is enough. `starts_on` is when that goal began. `ends_on` stays null. The current period is derived from the rhythm, the anchor, and the day being viewed. The next week or month does not need a new row and does not need a scheduler.

A dated goal is one period. It keeps both dates and does not roll.

Weekly periods start on an ISO weekday (Monday is 1, the default). Monthly periods start on a day from 1 to 28, so a payday such as the 25th runs the 25th through the 24th of the next month. The first period may start before today.

Daily goals are not a rhythm.

## Context

"This month / next 30 days / custom dates" did not match how people think about a salary cycle or a one-off target. The ledger already filters by inclusive dates, so the period does not need a new money table.

## Rationale

Deriving the window keeps the ledger on real dates. Last month's impacts stay queryable. They stop counting toward this month's goal when the derived window moves. Clamping the monthly anchor to 28 avoids short months moving the cycle.

## Consequences

- The goal API returns the current derived period as `starts_on` and `ends_on`, plus `recurring: true`. The stored end for a weekly or monthly goal is null.
- Goal progress, Home, and the Progress "goal" period use that derived window.
- A dated goal still ends. After `ends_on` it is no longer current.
- Only one active goal may cover a day. A recurring goal covers from `starts_on` onward until it is completed or abandoned.
- Daily pace can still appear as a hint. It is not a goal mode.
