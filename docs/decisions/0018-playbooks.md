# 0018. Playbooks over a workflow engine

- Date: 2026-10-06
- Status: accepted

## Decision

The generic Opportunity, action, and financial-impact models stay. User-facing missions are four playbooks in `PlaybookRunner`: `sell_item`, `freelance`, `recover_money`, and `reduce_expense`.

A playbook creates the opportunity and the one action that fits the current state. Later actions are created by a transition. See [0020](0020-state-driven-playbook-actions.md). Each standard action stores `system_owned` and a `playbook_key`. Asking price and the current offer live in `context`. Proposed, agreed, and expected amounts do not. See [0024](0024-proposal-agreed-realized.md).

There is no generic workflow engine and no template table.

## Context

The first client exposed stage, settlement, expected amount, and XP as fields the user had to administer. The domain is still the right place for unusual cases. The product needs a small set of recognizable missions.

## Rationale

One PHP class can create the rows and apply the step payloads. A rules engine would cost more than four flows. Keeping custom opportunities and custom actions means an odd case does not require a fifth playbook on day one.

## Consequences

- `POST /api/v1/playbooks/{playbook}` is the normal create path. `POST /api/v1/opportunities` remains for a custom mission.
- Completing a system step can update stage, potential, expected amount, or the ledger. The client sends the answer for that step, not a settlement enum.
- `POST /api/v1/opportunities/{opportunity}/events` reports a real-world outcome. The old `outcomes` endpoint is gone.
- Standard actions cannot be retitled, re-scored, or deleted through the normal action endpoints.
