# 0027. A sell item is not the opportunity

- Date: 2026-10-08
- Status: accepted

## Decision

A sell mission keeps an opportunity for stage, actions, XP, and the financial-impact ledger. The thing being sold is a `sell_items` row: category, photos, condition, estimate, and comparable links.

The estimate is potential money on the opportunity. Asking price stays listing context. Realized proceeds stay financial impacts.

## Context

The sell playbook could store a title and a value range, and nothing else a resale flow needs. Photos, shot plans, and sold-versus-asking evidence do not fit in opportunity context JSON.

## Rationale

One opportunity per item matches the current playbook. Listings are not a table yet, so a future listing can hang off the item without rewriting the ledger. The catalog, not the UI, chooses photo plans and detail fields.

## Consequences

Draft setup does not appear on Home. Finishing the description moves a new sale to ready to list and queues “Create the listing”. It does not publish anywhere. Marketplace connections, scraping, automatic valuation, and on-device listing generation stay out. Photo files use `SELL_PHOTO_DISK` (public disk locally, S3 when configured).
