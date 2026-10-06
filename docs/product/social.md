# Social

**Decision.** Friends and challenges exist for accountability and competition. This is not a social network.

Do not build:

- a general posting feed
- follower farming
- a complex comment system
- public financial profiles

## Privacy defaults

**Decision.**

- Sharing is friends-only by default.
- Share goal percentage, XP, level, achievements, and selected wins.
- Exact money amounts are private by default.
- Opportunity names are private by default.

The user can choose to share more. The product must not require that in order to use Friends.

## Leaderboards

**Decision.** The primary leaderboard is goal progress as a percentage. That is fairer than raw euros, because people start from different financial situations.

**Assumption.** XP is a secondary leaderboard.

**Assumption.** A money leaderboard may exist, and it stays optional because it conflicts with the privacy default unless every participant has opted in.

**Open.** Time window (week, month, challenge period) and what happens when friends have goals of very different sizes. Percentage is the agreed primary metric; tie-breaks and minimum activity are not specified.

## Challenges

**Assumption.** A challenge is a time-boxed competition among people who opted in. It is not a weekly quest, and it is not an opportunity.

Possible types:

- absolute money goal
- personal goal progress
- XP target
- action-count target
- a specific mission

Examples:

- Make €500 this month.
- Hit 100% of your personal November goal.
- Earn 300 XP this week.
- List 3 things for sale.
- Contact 5 people in your network.

**Assumption.** When a challenge ends, showing collective group impact is desirable. Example: "Together you generated €1,600." That line is only honest if the underlying amounts are realized impact, not potential. Do not sum potential money into a group total. Participants who have not opted into sharing exact money still need a privacy-safe way to be included. **Open** how that aggregate is computed without exposing individual amounts.

## Scope

**Open.** Whether Friends, leaderboards, and challenges are in the first usable version or immediately after it. Do not start this surface until that cut is made. See [roadmap/v1.md](../roadmap/v1.md) and [Friends](../screens/friends.md).

**Later.** Anything that turns profiles into public pages or adds social-network mechanics.
