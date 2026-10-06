# Settings

**Not implemented.** Product intent only.

**Decision.** Settings stays simpler than the rest of the product. It is a place to change facts the product already uses, not a second product surface.

## Likely sections

- Profile
- Goals and preferences
- Personalization
- Social and privacy
- Notifications
- Account

Money display rules can live with goals or as their own small section. **Open** which heading they use.

## Profile

**Likely V1.** Display name, username, avatar, optional bio, currency, timezone.

**Open.** Whether username is required before social exists. If Friends is deferred, do not block the rest of the product on a public username.

## Goals and preferences

**Likely V1.** Current money goal, which categories count toward the goal, availability.

Changing the goal must not rewrite realized history.

## Personalization

**Likely V1.** Skills, proficiency, opportunity types the user is open to, categories they never want suggested, and rough available capital.

This is the editable form of what [onboarding](onboarding.md) collected. Discover reads it.

## Money settings

**Assumption.** Possible controls, not a committed settings form:

- currency
- how recurring savings are counted, within the rule already decided in the [money model](../product/money-model.md)
- net versus gross realized amount

**Open.** All three. Do not add a gross/net toggle until Earn outcomes need it.

## Social and privacy

**Decision.** Defaults, also stated in [social](../product/social.md):

- friends only
- share goal percentage
- share XP and level
- share achievements
- share selected wins
- exact money private
- opportunity names private

If Friends is not in the first release, this section can be hidden until it is. The defaults are still decided.

## Notifications

**Likely V1, and modest.** Web-first V1 does not need a large notification matrix.

Possible notices:

- an opportunity needs attention
- weekly recap
- a challenge ending soon
- a reminder after an opportunity has been untouched for a while

**Open.** Channels (email, browser, in-app) and the untouched-window. No provider is selected. See [architecture](../technical/architecture.md).

## Mobile

**Later.** A TestFlight or mobile waitlist can be offered from the web product. It is not part of the scaffold and not part of the core loop.

## Account

**Likely V1** once authentication exists: ordinary account controls, plus export and delete of the user's data.

**Open.** Authentication mechanism, export format, and what "delete" does to shared challenge history.
