# 0014. Explicit settlement

- Date: 2026-10-06
- Status: accepted

## Decision

`Opportunity::recordRealizedImpact()` only inserts a financial-impact row. It does not change expected amount, potential, or status.

The API command `POST /api/v1/opportunities/{opportunity}/impacts` asks for a settlement mode:

- `none` — ledger only.
- `partial` — ledger, then set expected to the client's `remaining_expected_minor`. The opportunity stays open.
- `full` — ledger, clear expected, and complete the opportunity only if `complete` is true.

Potential is not cleared when an opportunity completes. Pipeline totals ignore completed and abandoned opportunities.

The API does not infer partial versus full by comparing the payment to the old expected amount.

## Context

A €3,000 invoice can be paid in full or as €1,000 now and €2,000 still expected. Guessing from the ledger is ambiguous once fees, multiple payments, or a Save entry get involved. The earlier ledger decision left this choice open.

## Rationale

The ledger stays a record of what was realized. Expected is a current forecast the client updates on purpose. Keeping potential on a completed sale preserves the historical estimate for later comparison. One transaction applies the ledger write and the forecast change together so they cannot diverge halfway.

## Consequences

- Annualized recurring value is still calculated and still excluded from realized sums. No future monthly rows are created.
- Full settlement does not delete potential minimum or maximum.
- A payment recorded with `settlement: none` can leave expected unchanged on purpose. The Home pipeline will still show that expected amount until a later partial or full settlement clears it.
- This updates the open question in [0009](0009-financial-impact-ledger.md). That record still stands for the ledger itself.
