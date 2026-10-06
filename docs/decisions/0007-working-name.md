# 0007. Working name

- Date: 2026-10-06
- Status: accepted

## Decision

No public product name is chosen. Packages, the Expo slug, the URL scheme, and the Laravel app name use `sidehustle` until a brand exists.

## Context

Scaffolding needs a string. The repository directory and GitHub repo are also placeholders (`chase-the-bag`, `chase-the-money`). None of these are the product name.

## Rationale

Inventing a brand in the scaffold would leak into UI copy and be annoying to remove. A dull technical name is easier to replace.

## Consequences

- The placeholder screen may say `sidehustle`. Product screens should not grow a visual identity around that word.
- Renaming the slug later is a deliberate change, especially once native bundle identifiers exist. They do not exist yet.
- Do not register a domain, app store name, or logo from this decision.
