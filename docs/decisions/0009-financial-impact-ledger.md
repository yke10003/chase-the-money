# 0009. Financial impact ledger

- Date: 2026-10-06
- Status: accepted

## Decision

Realized money is a row in `financial_impacts`. The opportunity does not have a `realized_amount` column. Expected and potential stay on the opportunity as the current estimate. Recording an impact does not change them.

A Save impact may also store a recurring amount and a `month` or `year` interval. The annualized display value is calculated from that and is never stored as the realized amount.

The stored amount is one number: the figure that counts toward the goal. Fees are not a separate column.

## Context

Progress and recaps need history after an opportunity is completed or deleted. A single mutable total cannot answer "what landed in October" without destroying the previous value. Annualizing a cancelled subscription on day one would book money the user has not saved yet.

## Rationale

New rows are the smallest history that still lets a period query sum realized money by type. Keeping expected and potential off that table makes the "do not treat potential as realized" rule a query fact, not a convention people have to remember. Calculating annualized value means €240 cannot be summed by accident.

One net amount is enough until a real net-versus-gross setting exists. The note can say "€425 sale, €15 fees".

## Consequences

- Period realized totals sum `amount_minor` for that currency and date range, grouped by the type stored on the impact.
- Deleting an opportunity nulls the foreign key and keeps the row, including type and a title snapshot.
- There is no job that posts next month's recurring save. That rule is still open.
- The ledger method does not change expected or potential. The API settlement command can, and only when the client says how. See [0014](0014-explicit-settlement.md).
- Rows are not frozen by a trigger. A later correction policy can add reversing rows. Do not add a mutable realized total instead.
