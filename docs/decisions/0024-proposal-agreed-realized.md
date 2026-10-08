# 0024. Proposed, agreed, and realized money

- Date: 2026-10-06
- Status: accepted

## Decision

Freelance money has three layers, stored separately:

- Proposed amount: `potential_min_minor` and `potential_max_minor`, set to the same value. This is potential.
- Agreed amount: `agreed_amount_minor`. This is the figure that was agreed. It is not cleared when a partial payment reduces what is still expected.
- Received: financial impact rows. `expected_amount_minor` is what is still expected. A partial settlement sets it to the remaining amount. A full settlement clears it.

The screen can show proposed, agreed, received, and still expected at the same time. Changing the agreed figure does not erase the proposal.

## Context

One expected column was being asked to mean "what we quoted", "what we agreed", and "what is left" at different moments. A partial payment then replaced the agreed total with the remainder.

## Rationale

Potential already means an uncertain figure. Expected already means the pipeline forecast, and settlement already rewrites it on a partial payment. The agreed handshake is a different fact, so it gets its own column instead of a context JSON key.

Asking price and the current offer stay in `context`. They are sell details, not the three money layers. Offer history is deferred.

## Consequences

- Before any money is recorded, the user can correct the proposal, the agreed amount, the asking price, and follow-up or expected dates.
- After a financial impact exists, those money fields are rejected. The ledger row is not edited or reversed in this phase.
- Recording money asks the user to confirm, because it counts toward the goal.
- A sell stores the agreed sale amount in the same column when an offer is accepted or the item is sold.
