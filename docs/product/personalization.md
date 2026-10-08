# Personalization

**Decision.** Onboarding learns a short profile and uses it for the first plan and Discover. See [0017](../decisions/0017-personalization-storage.md).

**Decision.** Focus is not the same as what counts as money. Wanting to sell changes suggestions. Freelance income still counts toward the goal. `included_types` remains for a later settings control. The normal flow does not ask.

## What we ask

- Work areas, as many as fit ([0025](../decisions/0025-multiple-work-areas.md)), then suggested skills from those areas, plus custom skills.
- Comfortable, experienced, or expert. Not a CV. Profile can set a level per skill.
- What they are willing to do, grouped by Earn, Sell, Recover, and Save, and what they do not want.
- Broad time availability.
- Starting capital is not asked in onboarding. It can be set in Profile, is stored, and does not change the first plan or Discover yet.

## Situation scan

"Which of these sound familiar?" stores flags. It does not create an "Outstanding payment" opportunity with no context.

A useful amount and a name are collected when the user starts that mission, in Discover or from the plan.

## First plan

**Decision.** The plan is a set of rules, not a model.

It combines the goal, skills, willingness, and situation into at most four next steps. It does not promise an earning amount. The plan is shown on Home, not on a separate onboarding page ([0026](../decisions/0026-product-ui-language.md)).

Someone with no profile still gets a way to start: sell something, check for money owed, review a cost.

## Daily goals

**Later.** Daily pace can be shown. Daily earnings are not a goal rhythm.
