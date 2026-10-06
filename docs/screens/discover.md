# Discover

**Not implemented.** Product intent only.

**Decision.** Discover is not an infinite feed of side-hustle articles.

Its purpose:

> Find financial opportunities the user has not put in motion yet.

**Decision.** Discover should turn a finding into an Opportunity. Reading is not the outcome.

**Decision.** Prefer progressing a strong existing opportunity over generating another idea. Discover should be willing to say "do the next action on something you already have."

## Best next opportunities

**Likely V1.** Personalized recommendations using:

- skills
- experience
- preferences
- available time
- existing opportunities
- prior successes
- asset categories
- willingness to invest money

**Open.** How weak the first version of this can be and still be honest. A few hand-built prompts that use onboarding answers are more in scope than a separate recommendation service. See [architecture](../technical/architecture.md).

## Guided sessions

**Assumption.** These are tools, not content channels. Which of them are in the first usable version is not cut yet. See [roadmap/v1.md](../roadmap/v1.md).

### Money Hunt

Find unused possessions worth selling.

Categories may include wardrobe, electronics, gaming, collectibles, jewelry and metals, tools, sports, furniture, and storage.

The exercise creates Sell opportunities. It is the full version of the lightweight asset scan in [onboarding](onboarding.md). Do not run this full hunt during onboarding.

### Skill Miner

Explore ways to monetize skills the user already has. Avoid generic low-quality suggestions.

For an experienced software developer, examples of the right altitude are: a fixed-price technical audit, freelance development, consulting, a paid technical product, a niche developer tool.

### Network Scan

Find people or companies worth contacting.

Prompts may include previous colleagues, previous clients, founders, recruiters, agencies, and previous inbound leads.

### Money Recovery

Discover money people owe, unpaid invoices, reimbursements, refunds, claims, taxes, and deposits. Findings become Recover opportunities.

### Expense Audit

Find recurring expenditure that can realistically be reduced. Findings become Save opportunities. Recurring amounts follow the [money model](../product/money-model.md).

### Quick Wins

Given an amount of free time, find the best useful action right now. This overlaps Home's "what should I do now?" **Open** whether they are the same suggestion engine or two entry points.

## Feedback

**Likely V1.** Discover should learn from explicit feedback:

- Interested
- Not for me
- Already doing this
- Too much effort
- Not enough return
- Never suggest this category

**Assumption.** "Interested" creates or keeps an opportunity. "Already doing this" should attach to an existing opportunity rather than duplicate it. The other responses suppress that suggestion or category.

**Open.** How long a suppression lasts, and whether "Never suggest this category" is the same control as the personalization settings.
