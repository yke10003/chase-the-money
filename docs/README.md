# Documentation

This directory is the source of truth for product intent. `/api` and `/app` are scaffolds. Nothing described under `product/`, `screens/`, or `roadmap/` is implemented yet.

## Status labels

Use these labels the same way in every doc.

| Label | Meaning |
| --- | --- |
| Decision | Agreed. Do not silently reverse it. Record a change in `decisions/`. |
| Assumption | A reasonable default to build against. Not locked. |
| Likely V1 | Belongs in the draft of a first usable version. The cut in [roadmap/v1.md](roadmap/v1.md) is provisional. |
| Later | Useful, and explicitly not required for the first usable version. |
| Open | Not decided. Do not invent a final answer in code. |

Example amounts, XP awards, achievement names, and stage lists are illustrations. They are not constants and they are not a catalog that must ship.

## Map

### Product

- [Overview](product/overview.md)
- [Principles](product/principles.md)
- [Core loop](product/core-loop.md)
- [Opportunity model](product/opportunity-model.md)
- [Money model](product/money-model.md)
- [Gamification](product/gamification.md)
- [Social](product/social.md)
- [Founder fixture](product/founder-fixture.md)

`money-model.md` and `founder-fixture.md` sit beside the original outline because money accounting and the founder scenario are easy to blur into the opportunity entity or a single screen.

### Screens

These describe intended behavior, not the current UI.

- [Home](screens/home.md)
- [Opportunities](screens/opportunities.md)
- [Opportunity detail](screens/opportunity-detail.md)
- [Discover](screens/discover.md)
- [Progress](screens/progress.md)
- [Friends](screens/friends.md)
- [Onboarding](screens/onboarding.md)
- [Settings](screens/settings.md)

### Technical

- [Architecture](technical/architecture.md)
- [Platform strategy](technical/platform-strategy.md)
- [Decision records](decisions/README.md)
- [V1 roadmap](roadmap/v1.md)
