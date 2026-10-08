# 0022. Playbook outcomes

- Date: 2026-10-06
- Status: accepted

## Decision

A guided mission ends by reporting what happened. The opportunity stores a short `outcome` string and a normalized status of `completed`. Abandoned stays for an exceptional close, not for "the client declined".

Examples:

| Playbook | Outcome | Meaning |
| --- | --- | --- |
| Freelance | `paid`, `declined`, `stopped_pursuing`, `written_off` | Paid, they declined, the user stopped, or an invoice was written off |
| Sell | `sold`, `not_sold`, `decided_not_to_sell` | Sold, it did not sell, or the user stopped selling it |
| Recover | `received`, `written_off`, `claim_rejected` | Received, they will not pay, or a claim was rejected |
| Save | `reduced`, `cancelled`, `no_change` | A lower price, cancelled, or kept with no saving |

## Context

Pause, delete, and mark finished were the only exits. None of them said what happened in the world, and the screen then said the mission was abandoned or finished.

## Rationale

One nullable string is enough. A new status per ending would make filters and pipeline rules branch for every story. User-facing copy comes from the playbook label, not from the word Abandoned.

## Consequences

- Guided missions reject `POST /complete`. Custom missions can still be marked finished.
- A negative ending records no financial impact and discards open actions that were never done.
- `no_change` completes a cost review at €0 realized. The review action can still have awarded XP.
- Reporting an outcome that does not fit the current state returns a validation error.
