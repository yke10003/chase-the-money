# Overview

## What this is

**Decision.** This is a gamified side-hustle / personal financial opportunity application.

The product helps someone turn spare time, skills, possessions, networks, and overlooked financial opportunities into measurable extra money, and it gamifies the process of actually taking action.

Working thesis:

> People have unused skills, possessions, time, and financial opportunities that could make them hundreds or thousands of euros better off, but those opportunities are fragmented and easy to procrastinate on.
>
> The product turns finding and acting on those opportunities into a game: personalized challenges, real-money goals, progression, achievements, and friendly competition.

The product should answer:

> What can I do next to become financially better off?

## What this is not

**Decision.** The product is not primarily:

- accounting software
- a budgeting app
- a job marketplace
- a generic side-hustle idea feed
- a finance dashboard

It also does not depend on marketplace supply, employers, banks, or other third-party integrations to be useful. See [principles](principles.md).

## Who it is for first

**Decision.** Early development is founder-led. The primary user is the founder. Do not generalize a decision just to cover hypothetical users.

The realistic scenario to design and manually test against is the [founder fixture](founder-fixture.md).

## Name

**Decision.** No final product name or brand has been chosen.

`sidehustle` is only a technical working name for packages, the Expo slug, and the Laravel app name. Do not treat it as branding, and do not invent a public name in UI copy beyond that working label on the scaffold screen.

## How the product is organized

Four concepts stay distinct:

| Concept | Role | Detail |
| --- | --- | --- |
| Opportunity | A concrete way the user's financial position could improve | [opportunity-model.md](opportunity-model.md) |
| Money | Real-world outcome: realized, expected, or potential | [money-model.md](money-model.md) |
| XP and achievements | Effort, momentum, and permanent milestones | [gamification.md](gamification.md) |
| Quests and social challenges | Temporary prompts and optional competition | [gamification.md](gamification.md), [social.md](social.md) |

Quests are not opportunities. XP is not money. Potential money is not realized money.

## Platform

**Decision.** V1 is web-first, built as an Expo app that can later ship to iOS and Android. Native mobile is not part of the initial milestone. See [platform strategy](../technical/platform-strategy.md).
