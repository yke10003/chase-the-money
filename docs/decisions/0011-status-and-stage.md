# 0011. Normalized status and flexible stage

- Date: 2026-10-06
- Status: accepted

## Decision

Every opportunity has a normalized status: `explore`, `active`, `waiting`, `paused`, `completed`, or `abandoned`. `paused` was added in [0023](0023-paused-status.md).

The user-facing stage is a nullable string. PHP checks it against a per-type catalog. The database column is not an enum of those stages. Status and stage do not update each other.

## Context

Screens need one set of filters across Earn, Sell, Recover, and Save. They also need type-specific labels such as Valuing or Invoiced. Those labels are explicitly not final.

## Rationale

A status enum is small and stable enough to filter on. A stage string can gain `ready_to_list` or lose `idea` without a migration. A workflow engine would freeze a vocabulary we already expect to edit. Automatic mapping from stage to status would hide an open product question inside a trigger.

The initial catalog includes the doc lists, including Idea and Identified. The shorter examples in the domain brief are a subset of that, not a conflicting decision.

## Consequences

- `OpportunityStageCatalog` is the allow-list. A stage from the wrong type is rejected.
- Completing an opportunity sets status and `completed_at`. It does not set the stage to `paid`, `received`, or `confirmed`.
- Reopening clears `completed_at` and `abandoned_at`. That timestamp is the current terminal state, not a history of status changes. Actions and financial impacts are the history we keep.
- Abandoned is a status. Whether the Opportunities screen shows a chip for it is still open.
- Needs attention is not a status and not a column.
