# Home

**Decision.** Home is a command center, not a finance dashboard. It answers four questions in this order: where am I against the goal, what money is moving, what should I do now, and am I making progress. Charts belong on [Progress](progress.md).

**Decision.** A new Home is never only "nothing to do". If no action fits, it shows the starter missions from the first plan. Each opens a real flow. The screen does not explain how actions are sorted.

The real-money goal is more prominent than XP.

## 1. Goal hero

The period name and days left ("October goal · 25 days left"), the banked figure in large type, the target, and a goal meter with 25/50/75% ticks. Only banked money fills it.

One line under the meter says where things stand: nothing banked yet and how long is left, what remains and roughly how much per week, or "Goal reached. Everything from here is extra." The per-week figure is plain arithmetic, not a forecast.

Beside the hero on wide screens, and below it otherwise: **In motion, not banked yet.** Expected (striped mark, "agreed or promised"), possible as a range (dotted mark, "estimates and quotes"), and how many open missions have no figure. These never add into the banked number. See [money model](../product/money-model.md) and [0026](../decisions/0026-product-ui-language.md).

After onboarding, a one-time dark welcome band reads the goal back and points to the first moves.

## Cockpits

Once the account has anything at all, Home shows four cards: Sell, Freelance, Build, Recover. Each uses real open records. Build says "Nothing in progress" until a product exists, and it never borrows freelance work to look busy. A brand new account does not get the cards; the starter moves below are the way in, and each one opens the cockpit that owns it.

## 2. What can I do now?

**Decision.** The most prominent block. A time filter (10 min, 30 min, 1 hour, Any) appears once the user has open missions.

- The first suggested action is a large "Next move" card: why it is surfaced (Overdue, Due today, Due soon, Quick win, or Waiting on you), the action, the mission, the time and XP, and one button into the mission.
- Other suggestions are compact rows.
- With a time filter, actions without an estimate appear under "Bigger pieces, when you have the time".
- With no suggestion, starter missions appear as a 2×2 grid. The first one is marked "Start here". The heading depends on the account: first moves for a new user, "Nothing needs you right now" when missions are only waiting, "All clear. Ready for the next one?" when everything is finished, and a short note when nothing fits the chosen time.

Suggestions come from the server's `suggested_actions`. The client does not re-rank them.

## 3. Side column

Shown only when it has content. The main column takes the full width otherwise.

- **Waiting on others.** Open missions whose next action is dated in the future: the state, when to check, and the money with its certainty mark. They move into "What can I do now?" on the day.
- **This week.** XP (yellow), steps done, missions closed. Hidden until something happened this week.
- **Recent wins.** Banked amounts in green and XP in yellow. Server XP descriptions such as "Outcome bonus at €500" are shown as "Milestone bonus: first €500 on a mission".

## Likely V1, not built

- Weekly quests and a rough level inside "This week", secondary to money. Quest copy and the XP curve are not decided. See [gamification](../product/gamification.md).
- One proactive coaching prompt, for example "Your freelance pipeline depends on one deal." One suggestion, not a feed, and suppressible.

## Removed from Home

The per-type snapshot. Type filters on [Missions](opportunities.md) and the breakdown on [Progress](progress.md) cover it without adding another block to Home.

## Explicitly out of scope for Home

- category-over-time charts
- bank balances
- a full opportunity board (that is [Missions](opportunities.md))
- social leaderboards
