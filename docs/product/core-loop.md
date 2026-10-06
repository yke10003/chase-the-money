# Core loop

## V1 loop

**Decision.** The loop is:

1. Onboard.
2. Set a money goal.
3. Discover opportunities.
4. Choose actions.
5. Execute them outside the app.
6. Record the outcome.
7. Earn XP and, when money actually lands or is concretely saved, realize money.
8. Receive the next useful suggestion.

The app should create action, not only store a log.

**Decision.** Useful test for Home and Discover:

> If the user has 30 minutes available right now, can the product tell them something financially useful they could do?

That suggestion should prefer an existing action when one fits the time available. See [Home](../screens/home.md) and principle 10 in [principles](principles.md).

## What a turn through the loop produces

**Assumption.** A successful pass leaves the user with at least one of:

- a completed action on an existing opportunity
- a newly captured opportunity that came from a real prompt, not from browsing articles
- a recorded financial outcome (realized, expected, or a revised potential amount)
- a clearer "next action" than they had before

## Quests sit beside the loop

**Assumption.** Weekly quests are temporary challenges that encourage useful behavior. They may span several opportunities and actions. They are not themselves opportunities.

Examples of the kind of quest the system might create:

- Diversify: contact 5 people in your network.
- Hidden Money: identify €500 worth of things you could sell.
- Close the Loop: collect one piece of money currently owed to you.
- Trim the Fat: cancel or downgrade an unnecessary recurring expense.

Whether quests ship in the first usable version is a scope question. See [roadmap/v1.md](../roadmap/v1.md) and [gamification](gamification.md).

## What the loop is not

**Decision.**

- It is not "read side-hustle ideas."
- It is not "reconcile transactions."
- It is not "manage a project board."
- It is not "keep a daily streak alive."
