# Gamification

**Decision.** Three reward systems run in parallel. They are not substitutes for each other.

## 1. Money

The primary real-world outcome. Example: €650 / €2,000 for the current goal.

Rules live in the [money model](money-model.md). The goal display is more prominent than XP.

## 2. XP

**Decision.** XP represents effort, progress, and momentum. The user can earn XP for a meaningful action before any money lands.

**Decision.** Creating or planning something generally earns less XP than moving an opportunity forward or completing it.

**Decision.** Outcomes such as publishing a listing, sending a proposal, completing a sale, or receiving payment may also grant milestone XP. The amounts are not decided.

### Exploratory effort scale

**This table is not a decision.** The numbers are a sketch to design against. Do not hard-code them as final constants.

| Effort | Rough time | Sketch XP |
| --- | --- | --- |
| Tiny | under ~5 min | ~5 |
| Small | ~5–20 min | ~10 |
| Medium | ~20–60 min | ~25 |
| Large | ~1–3 hours | ~50 |
| Major | 3+ hours, or a significant milestone | ~100 |

**Open.** Whether the user picks the effort, the product infers it, or both. Whether XP can be lost. Whether different opportunity types use different scales.

## 3. Achievements

**Decision.** Achievements are permanent milestones. They should mark meaningful behavior, not arbitrary tapping.

Examples, not a locked catalog:

- First €100
- Four Figures
- First Listing
- Network Effect
- Proposal Out
- Signed
- Paid
- Closet Capital
- Trim the Fat
- Subscription Slayer
- No Zero Weeks

**Open.** The real list, the thresholds, and how progress toward a locked achievement is shown. "No Zero Weeks" fits weekly momentum. It must not turn into a punitive daily streak. See below.

## Streaks

**Decision.** Do not center the product on daily streaks. Prefer weekly momentum, for example:

- earn 150 XP this week
- complete productive actions on 3 days
- finish 4 meaningful actions
- progress 3 opportunities

A daily-streak achievement may exist. Losing a daily streak should never be the thing the user feels punished for.

The "150 XP" and "4 actions" figures above are examples, including examples used in onboarding. They are not finalized weekly targets.

## Levels

**Likely V1.** Progress can show a level derived from lifetime XP, for example level 8 at 2,450 / 3,000 XP.

**Open.** The curve, level names, and whether level is shown on Home or only on Progress. Home may show a rough level as part of weekly momentum, secondary to money.

## Weekly quests

**Assumption.** The system may create personalized weekly quests. They are temporary challenges meant to encourage useful behavior. A quest can span multiple opportunities and actions.

A quest is not an opportunity.

Examples:

| Quest | Prompt |
| --- | --- |
| Diversify | Contact 5 people in your network. |
| Hidden Money | Identify €500 worth of things you could sell. |
| Close the Loop | Collect one piece of money currently owed to you. |
| Trim the Fat | Cancel or downgrade an unnecessary recurring expense. |

**Open.** Who authors a quest (product templates, personalization, or the user), and how completion is detected. The draft in [roadmap/v1.md](../roadmap/v1.md) places quests in Likely V1, not in the core loop. That placement is provisional.

Social challenges are a different object. See [social](social.md).
