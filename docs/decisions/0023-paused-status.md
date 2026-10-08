# 0023. Paused is not abandoned

- Date: 2026-10-06
- Status: accepted

## Decision

`paused` is a normalized opportunity status. It means temporarily inactive and resumable. `abandoned` means intentionally closed. `completed` means finished, including a real outcome that earned no money.

## Context

Pause was stored as abandoned and could later be reopened. Home and the user then had to treat a temporary break as a failed mission.

## Rationale

The status column is already a string. Adding one enum case does not need a new table. Resume can look at the open action: if its `due_on` is still in the future, the mission returns to `waiting`; otherwise it returns to `active`.

## Consequences

- Home, Discover suggestions, and pipeline totals exclude paused missions. `OpportunityStatus::open()` is still explore, active, and waiting.
- Pause and resume are `POST /api/v1/opportunities/{opportunity}/pause` and `.../resume`.
- [0011](0011-status-and-stage.md) still describes status versus stage. This record adds the sixth status.
