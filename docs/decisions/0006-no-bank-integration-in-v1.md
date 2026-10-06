# 0006. No bank integration in V1

- Date: 2026-10-06
- Status: accepted

## Decision

V1 does not connect to a bank, an accounting suite, or an employer's payroll. Users report their own outcomes. The product must be useful with none of those integrations.

## Context

The core loop is "decide what to do, do it, record what happened." Bank linking is a long project of its own and is not required to test whether the loop helps.

## Rationale

Self-report is enough for the founder to track a proposal, a jacket, a repayment, and a cancelled subscription. Waiting on open banking would block the only question that matters: does the product create action?

## Consequences

- Do not add a banking provider, CSV import, or invoice sync as part of the first loop.
- Realized amounts are whatever the user records, including the unresolved net-versus-gross question.
- A later integration must not become a requirement for the core loop.
