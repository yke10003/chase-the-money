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
