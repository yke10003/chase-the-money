# 0015. Reopen without a status history

- Date: 2026-10-06
- Status: accepted

## Decision

V1 does not store a history of opportunity status changes.

Reopening sets the normalized status to `explore`, `active`, or `waiting` (default `active`) and clears `completed_at` and `abandoned_at`. Actions, XP events, and financial impacts remain.

## Context

Someone will close an opportunity too early. A status-event table would record that, and nothing in the first screens needs the old status timeline. The useful history is what they did and what money moved.

## Rationale

`completed_at` means "currently completed", which is what the completion count query already uses. Clearing it on reopen keeps that query honest. The ledger and the action rows are the audit trail worth keeping.

## Consequences

- A period's "opportunities completed" count drops if the opportunity is reopened, because `completed_at` is gone.
- Potential left on a completed opportunity is still there after reopen, and it counts in the pipeline again once the status is open.
- Do not add a status-history table unless a screen needs to show the old transitions.
