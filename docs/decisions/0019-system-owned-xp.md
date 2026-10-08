# 0019. System-owned XP

- Date: 2026-10-06
- Status: accepted

## Decision

The client cannot set `xp_reward` on create, update, or complete. Custom actions send an effort of `quick`, `medium`, or `deep`. The server maps that to 10, 15, or 25 XP.

Playbook actions are created with the first implemented economy:

| Step kind | XP |
| --- | --- |
| Small setup or research | 10 |
| Meaningful preparation | 15 |
| Listing, proposal, or outreach milestone | 25 |
| Completed result, including money received as a step | 25 |

A separate `outcome_bonus` event may add 10 XP at €100 realized, 20 at €500, and 30 at €1,000. It is not tied to an action, so it can sit beside the step event. Euro value does not multiply the step XP.

These numbers are the first constants in `XpEconomy`. They are not a permanent product decision.

## Context

Letting the user type "XP if completed" made the reward feel arbitrary and taught the domain model. Money and XP stay separate: a large sale is not automatically a large XP award.

## Rationale

Server-owned rewards keep the loop comparable across missions. Effort bands are enough for a custom step. The bonus is capped so a €2,000 result is not twenty times a €100 result.

## Consequences

- Completing a system action still awards its XP once, through the existing unique action event.
- The older 5/10/25/50/100 sketch is not what playbooks use.
- Factories and seeders may still set `xp_reward` directly. That is fixture data, not a client capability.
- Achievements and quests are unchanged and still absent.
