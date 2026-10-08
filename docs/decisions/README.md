# Decision records

Record a decision here when reversing it later would be costly, or when a future change could contradict it by accident.

Do not record exploratory numbers, draft UI copy, sample euro amounts, or unfixed stage lists. Those stay in the product docs with an explicit status label.

## Format

Add `docs/decisions/NNNN-short-title.md`:

```markdown
# NNNN. Title

- Date: YYYY-MM-DD
- Status: proposed | accepted | superseded by NNNN

## Decision

What was decided, in a few sentences.

## Context

What forced the choice.

## Rationale

Why this option.

## Consequences

What we will do, and what we are explicitly not doing, because of this.
```

Link the new file in the index below. If a decision replaces an older one, set the old status to `superseded by NNNN` and say so in both files. Do not delete the old record.

Product principles in [principles.md](../product/principles.md) are also decisions. Add an ADR when a principle becomes an architectural commitment or when a principle changes.

## Index

| | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo.md) | One repo with `api/`, `app/`, and `docs/` | accepted |
| [0002](0002-laravel-json-api.md) | Laravel JSON API, conventional structure | accepted |
| [0003](0003-web-first-expo.md) | Web-first Expo app, native later | accepted |
| [0004](0004-four-opportunity-types.md) | Earn, Sell, Recover, and Save stay distinct | accepted |
| [0005](0005-money-and-xp-are-separate.md) | Money and XP are separate reward systems | accepted |
| [0006](0006-no-bank-integration-in-v1.md) | No bank connection in V1 | accepted |
| [0007](0007-working-name.md) | `sidehustle` is a technical name only | accepted |
| [0008](0008-money-in-minor-units.md) | Money is integer minor units plus a currency code | accepted |
| [0009](0009-financial-impact-ledger.md) | Realized money is an impact ledger | accepted |
| [0010](0010-xp-event-ledger.md) | XP is an event ledger | accepted |
| [0011](0011-status-and-stage.md) | Normalized status, flexible stage string | accepted |
| [0012](0012-goal-included-types.md) | Goals choose which opportunity types count | accepted |
| [0013](0013-sanctum-session-auth.md) | Session cookie auth for the web client | accepted |
| [0014](0014-explicit-settlement.md) | Settlement is an explicit API choice | accepted |
| [0015](0015-reopen-without-status-history.md) | Reopen clears timestamps, no status log | accepted |
| [0016](0016-goal-rhythm.md) | Weekly, monthly, or dated goal periods | accepted |
| [0017](0017-personalization-storage.md) | Profile row plus skill rows | accepted |
| [0018](0018-playbooks.md) | Four playbooks, no workflow engine | accepted |
| [0019](0019-system-owned-xp.md) | The server assigns XP | accepted |
| [0020](0020-state-driven-playbook-actions.md) | Playbooks create the next action only | accepted |
| [0021](0021-scheduled-action-availability.md) | A due date makes an action available when read | accepted |
| [0022](0022-playbook-outcomes.md) | Close reasons are outcomes, not extra statuses | accepted |
| [0023](0023-paused-status.md) | Paused is its own status | accepted |
| [0024](0024-proposal-agreed-realized.md) | Proposed, agreed, and received stay separate | accepted |
| [0025](0025-multiple-work-areas.md) | A profile can have several work areas | accepted |
| [0026](0026-product-ui-language.md) | Money certainty, Missions naming, onboarding ends on Home | accepted |
| [0027](0027-sell-item.md) | A sell item is not the opportunity | accepted |
