# 0026. Product UI language for the first design pass

- Date: 2026-10-07
- Status: accepted

## Decision

1. **Money certainty has one visual language everywhere.** Banked (realized) is solid green. Expected (agreed or promised) is a striped mark. Possible (estimates, quotes, asking prices, offers) is a dotted mark in muted ink. Only banked money fills a goal meter. A closed mission shows a leftover expected amount as "Was expected", never as money still coming.
2. **"Mission" is the user-facing word for an opportunity.** The navigation item is Missions. Docs, the API, and the database keep "opportunity".
3. **Onboarding ends on Home.** There is no separate first-plan page. The starter missions are Home's "What can I do now?" section, and a one-time welcome band confirms the goal.
4. **Outcomes are reported, then confirmed.** Mission detail lists what can happen. Choosing one expands its fields, and an outcome with no fields asks for one more tap before it closes anything.
5. **XP is yellow, money is green, action is ink.** XP never uses the money colour and is never shown larger than money on the same screen.

## Context

The functional beta showed every outcome form at once, mixed raw dates and internal labels into the screen, and duplicated the first plan between onboarding and Home. Potential, expected, and realized amounts all looked the same.

## Rationale

The money layers are the product's main honesty rule ([money model](../product/money-model.md)). Making them look different on every screen enforces that rule visually instead of with repeated disclaimers. One word per concept keeps the interface from mixing "opportunity" and "mission". Ending onboarding on Home removes a screen whose content was immediately repeated.

## Consequences

- New screens use the components in `app/src/components/ui.tsx` (`Amount`, `CertaintySwatch`, `GoalMeter`, `XpTag`) instead of formatting money ad hoc.
- Copy avoids defensive repetition such as "no earnings are promised". The certainty treatment and the word "possible" carry that meaning.
- The journey track on mission detail is display only. It maps the stage to a position in the playbook's story. The server still owns transitions.
