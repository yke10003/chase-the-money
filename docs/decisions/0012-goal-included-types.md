# 0012. Goal included types

- Date: 2026-10-06
- Status: accepted

## Decision

Each goal stores `included_types`, a JSON list of `earn`, `sell`, `recover`, and/or `save`. The default is all four. Goal progress sums financial impacts in the goal's currency and date range whose type is in that list.

Historical goals keep the list they were saved with. There is no separate configuration table.

At most one active goal may cover a given calendar day for a user.

## Context

Home needs one number for "money toward this goal", and the product already says the user can choose which categories count. The four types still have to stay visible in reporting even when one of them is excluded from a goal.

## Rationale

A JSON list is the whole feature. A pivot table would be a second model for four stable values. Filtering at read time means the ledger stays a complete history. Overlap rejection stops `GET /goals/current` from having to guess.

## Consequences

- Progress breakdowns for a period still include every type. The goal resource's `realized_amount_minor` does not.
- An excluded type is not deleted and still appears in pipeline and snapshot.
- Completed and abandoned goals may overlap active ones. They do not count as current.
- The normal client does not ask which types count. Earn, sell, recover, and save all count unless a later settings control changes `included_types`. Willingness in the profile affects suggestions, not whether money is real.
