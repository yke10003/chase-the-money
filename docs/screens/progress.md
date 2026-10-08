# Progress

**Decision.** Progress is a personal scorecard and game history. It is not finance analytics software. Home does not absorb these charts.

## Implemented

A period switch: this goal (default), 7 days, 30 days, year, all time.

- **Banked.** The realized total for the period in large green type, then a stacked bar and four figures: Earned, Sold, Recovered, Saved. One line says they stay separate. With nothing banked, the panel says so and links to Discover.
- **Over time.** Simple bars of the `series` the API returns (daily, or monthly for a year), with the best day or month. Plain views, no chart library. Hidden for all time and when every point is zero.
- **Goal.** The current goal's banked/target, meter, percentage, and days left.
- **Effort.** XP in the period (yellow), steps done, missions closed, and XP all time.

No level is shown. The curve is not decided, and inventing one in the client would be a fake system.

## Lifetime impact

**Likely V1.** Example:

```text
€4,280 total financial impact
```

Broken into Earned, Sold, Recovered, and Saved.

**Decision.** The breakdown stays visible. The total is impact, not income. €100 saved is included as Saved, not relabeled as Earned. See [money model](../product/money-model.md).

**Open.** Whether the lifetime total sums realized amounts only. The principle that potential is never realized implies the total is realized impact. Expected money does not belong in the lifetime total.

## Current goal

**Likely V1.** Example: October, €650 / €2,000. Same goal as Home. Realized progress only.

## Financial impact over time

**Likely V1.** Simple charts may live here.

Possible ranges: 7 days, 30 days, 3 months, year, all time.

Possible series: Total, Earn, Sell, Recover, Save.

**Open.** Chart library, and whether V1 needs more than a simple series. Do not add a charting framework while the scaffold is empty.

## XP and level

**Likely V1.** Example: level 8, 2,450 / 3,000 XP. Show meaningful action stats and weekly momentum.

The curve is not decided. See [gamification](../product/gamification.md).

## Momentum

**Decision.** Show weekly consistency. Do not make a broken daily streak the focus of this page.

## Personal bests

**Likely V1.** Examples:

- best month
- biggest single win
- best week
- fastest win
- biggest sale
- most monthly expenses removed

**Open.** Definitions, especially "fastest win" (time from creation to realized money is a guess, not a spec).

## Achievements

**Likely V1.** Unlocked achievements, plus selected progress toward locked ones. The catalog is not finalized.

## What works for you

**Likely V1.** Which categories and behaviors actually create results. This should eventually feed Discover.

**Open.** The minimum history before this section is honest. With only the founder fixture and no completed outcomes, the section should be empty rather than inventing a pattern.

## Recaps

**Assumption.** A monthly or yearly recap could read:

```text
€1,840 impact
14 opportunities progressed
7 completed
840 XP
3 achievements unlocked
```

**Later.** Polished, highly shareable recap pages. The underlying numbers can exist on Progress earlier without a share flow. Sharing must respect the privacy defaults in [social](../product/social.md): do not generate a public card full of exact amounts unless the user opts in.
