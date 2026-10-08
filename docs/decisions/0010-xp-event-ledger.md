# 0010. XP event ledger

- Date: 2026-10-06
- Status: accepted

## Decision

XP is stored as `xp_events`. The user's total is the sum of `amount`. Users have no `xp_total` column.

An action may store an intended `xp_reward`. Completing the action inserts one event with reason `action_completed` and that amount. Completing it again does not insert another. The database allows at most one XP event per action. Events with no action are allowed, so a later milestone can exist without a schema change.

## Context

XP has to survive after the action is done, and it has to be countable for a week without trusting a mutable counter. The award table in the gamification doc is still a sketch.

## Rationale

A ledger answers "XP this week" and "XP in total" with the same rows. Putting the intended reward on the action lets the UI show "+25 XP" before completion. Putting the awarded amount on the event means a later edit of the intended reward does not rewrite history. The unique action foreign key is the backstop against a double award. It is not a catalog of XP reasons.

## Consequences

- The only reason written today is `action_completed`. Achievement, quest, and opportunity-completion XP are not implemented. Adding a reason is a new enum case, not a migration.
- There is no constant for the 5/10/25/50/100 sketch. Callers pass the integer they mean. The founder seeder's 25 is demo data.
- Two XP events for the same action would require dropping the unique index. Do that only when a real second reward exists.
- Events are not frozen by a trigger.
