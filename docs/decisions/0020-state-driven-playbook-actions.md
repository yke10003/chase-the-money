# 0020. State-driven playbook actions

- Date: 2026-10-06
- Status: accepted

## Decision

A playbook creates only the action that belongs to the current state. The next action is created when the user reports an outcome or completes the current effort. Completed actions stay. Open actions that the new state no longer needs are deleted, not marked done.

There is still no generic workflow engine. `PlaybookRunner` delegates to one class per playbook: freelance, sell, recover, and save.

## Context

Generating the whole future checklist made "Follow up" unlock "Do the work" even when nobody had accepted the proposal. "Step X of Y" counted generated rows, not a real lifecycle.

## Rationale

Four explicit classes can answer "given this playbook and stage, what can happen next?" A rules engine would hide that in data. Deleting an uncompleted future step avoids a fake history of work the user never did. Work they actually did stays completed.

## Consequences

- The client reads `playbook_view` and does not assemble transitions itself.
- `POST /api/v1/opportunities/{opportunity}/events` reports an outcome. Invalid outcomes for the current state are rejected.
- `POST /api/v1/opportunities/{opportunity}/actions/{action}/complete` is for effort the user performs, such as reaching out or finishing the work. A follow-up cannot be completed through that endpoint.
- Transitions that touch several rows run in one database transaction.
- [0018](0018-playbooks.md) still holds: four playbooks, no engine, custom missions remain. The "create every standard action up front" reading of 0018 does not.
