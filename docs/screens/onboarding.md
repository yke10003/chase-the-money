# Onboarding

**Decision.** Setup ends on a Home that already holds the first plan. There is no separate first-plan page. See [personalization](../product/personalization.md) and [0026](../decisions/0026-product-ui-language.md).

Onboarding is full screen, without the app navigation. A progress bar names the steps. The logo and bar sit below the status bar. Back and Continue stay pinned to the bottom of the screen.

## Flow

1. **Target.** An editable euro amount. Chips (€250, €500, €1,000, €2,000, €5,000) only fill that field. Then how often: every week (a start weekday), every month (1st, 15th, 25th/payday, or another day from 1 to 28), or by a date. A one-line preview reads the goal back, for example "€2,000 · every month, starting on the 25th (the 25th to the 24th)". The goal is saved when the user continues. Daily is not offered.
2. **What do you bring?** Work areas are multi-select ([0025](../decisions/0025-multiple-work-areas.md)).
3. **Skills you can charge for.** Suggested skills are the union of the selected areas. A custom skill is added with Enter or Add.
4. **How experienced are you?** Each chosen skill has its own level: Comfortable, Experienced, or Expert. A new skill starts at Experienced. The profile's overall experience is the strongest of those levels.
5. **How would you like to get there?** What the user is open to, grouped under Earn, Sell, Recover, and Save, then "Anything you would rather not do?".
6. **What's true for you right now?** Situation checkboxes, then time available each week. "Build my plan" saves the profile and opens `/?welcome=1`.

**Decision.** Starting capital is not asked during onboarding. It does not change suggestions yet, so asking for it would imply that it does. It stays editable in Profile.

**Decision.** If a goal already exists (the user left after the target), onboarding resumes at What do you bring and does not create a second goal.

**Decision.** The user is not asked whether Sell, Earn, Recover, or Save count. All four count.

**Later.** An advanced setting to ignore savings, or another type, toward a cash goal.
