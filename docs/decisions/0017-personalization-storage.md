# 0017. Personalization storage

- Date: 2026-10-06
- Status: accepted

## Decision

Preferences live on `user_profiles`: work categories (a list since [0025](0025-multiple-work-areas.md)), experience level, availability, starting capital, and JSON lists for willingness, exclusions, and the situation scan.

Skills are rows in `user_skills` (`name`, `proficiency`), unique per user and name.

There is no skill taxonomy service. The suggestion lists are a PHP catalog the client reads from `GET /api/v1/profile/catalog`.

## Context

Discover and the first plan need to ask "what can this person do?" without turning onboarding into a résumé. A blob on `users` would hide the skill list. A normalized taxonomy would be a second product.

## Rationale

One profile row is enough for the tag lists, because those lists are filters, not entities with their own pages. Skills are rows because a person has several, each with a level, and the plan reads them by name. The catalog can grow by editing the PHP list.

## Consequences

- Saving a profile replaces the skill rows included in that request.
- Situation flags do not create opportunities. A later form does, with a title and an amount when the user has them.
- Starting capital and exclusions are stored for later suggestions. The first Discover pass uses category, skills, and willingness. It does not yet price ideas from capital.
