# 0021. Scheduled action availability

- Date: 2026-10-06
- Status: accepted

## Decision

An action may have `due_on`, a calendar date. It is actionable when `due_on` is null or on or before the server's today. Home and the mission screen derive that when they are read. No job changes the opportunity status because a date passed.

Dates the user sends are strict `YYYY-MM-DD`. Ambiguous strings such as `09/30/2026` and `30-09-2026` are rejected.

## Context

Waiting missions never appeared on Home after their date, because suggestions required status `explore` or `active`. A blank proposal date was also being filled with today plus 7 without showing that choice.

## Rationale

The smallest model is one date on the action. Comparing date strings avoids turning a calendar day into a timestamp that shifts with the user's timezone. The suggested follow-up day is a default in the form the user can see, not a value invented after submit.

## Consequences

- Home includes any open mission that is not completed, abandoned, or paused, when it has an open action that is actionable now.
- Before `due_on`, the action is not suggested and cannot be completed.
- On the day, and after it, the reason can be "Due today" or "Overdue". The opportunity can stay `waiting`.
- "Due soon", "Quick win", and "Waiting on you" are labels for the user. They are not a sort the screen explains.
