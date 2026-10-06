# 0004. Four opportunity types

- Date: 2026-10-06
- Status: accepted

## Decision

Every opportunity is one of Earn, Sell, Recover, or Save. Reporting keeps those types distinct. A potential liability is not an opportunity.

## Context

The product is about actions that improve someone's financial position. Those actions produce different kinds of money. Collapsing them into "income" or "savings" would misstate what happened.

## Rationale

Earning €100, selling an object for €100, recovering €100, and avoiding €100 of spend are different events. The user should be able to see which kinds of action actually work for them.

A debt or legal exposure is not itself an action. An action that reduces that exposure could still be Save or Recover.

## Consequences

- Do not add a fifth type without a new decision.
- Lifetime and progress views may show a combined impact total, and must still break out the four types.
- Do not model the founder's landlord dispute as an opportunity.
- Stage names differ by type and are not finalized. See [opportunity model](../product/opportunity-model.md).
