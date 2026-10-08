# Cockpits

**Decision.** The product is organized around how someone tries to make money, not around Missions or Discover. See [0026](../decisions/0026-product-ui-language.md) for the earlier language pass. This file is the structure that replaces it as the way around the app.

Home is the command center. Under it, four areas:

| Area | The job |
| --- | --- |
| Sell | Turn something you own into money |
| Freelance | Get paid for work you do for someone else |
| Build | Make something of your own. Longer, less predictable |
| Recover | Collect money that is already yours |

Progress is the history of what landed. Friends stays future. Profile stays settings.

Save is not a pillar. Reviewing a cost still works, and old savings still count, but it is reached from All activity, not from the navigation.

## Why

"I want to sell something" should not require choosing between Home, Discover, Missions and Money Hunt. The navigation question is: how are you trying to make money?

Earn / Sell / Recover / Save remain the stored opportunity types. They are an implementation detail. Freelance and Build both sit on Earn today, because Build has no records of its own yet.

## What each cockpit owns

### Sell

Belongs: items you might sell, valuing them, listing them, offers, the sale.

Does not belong: freelance leads, a product you are building, an invoice someone owes you.

Today: open Sell missions, with counts, asking totals where an asking price exists, and offers. "I know what to sell" opens the existing sell flow. "Find something to sell" is the Money Hunt. Marketplaces (Vinted, Marktplaats, Grailed) are listed as not connected. Nothing pretends to be linked.

### Freelance

Belongs: a lead or a project, from first note to getting paid. Also the work of finding the next one.

Does not belong: a product with no buyer yet. That is Build.

Today: the freelance playbook as a pipeline (proposed, expected, what needs you). Custom Earn missions with no playbook sit here under "Your own steps", because there is nowhere else honest to put them. "Find more work" starts from the existing skill ideas. One message, not a quota. Public posts, cold notes and portfolio work are named as later, and are not buttons.

### Build

Belongs: a product or asset you create first, then find a market for. Revenue from it, once there is some.

Does not belong: client work. That is Freelance.

Today: an empty place. It says products are not tracked yet and does not invent a product or a revenue number. Add a product opens `/build/new`, which explains that and saves nothing.

### Recover

Belongs: invoices, repayments, refunds, reimbursements, a tax return.

Does not belong: bookkeeping.

Today: expected total, overdue count, the open recoveries, and "Find money to recover".

## Where the old screens went

| Was | Now |
| --- | --- |
| Missions in the nav | Removed. The route `/opportunities` remains as **All activity**, linked from Progress. It is the full list, including Save and custom work. It is not how you start the day. |
| Discover in the nav | Removed. Money Hunt lives in Sell. Skill ideas live in Freelance. The recovery scan lives in Recover. A cost review lives on All activity (`/opportunities?start=cost`). `/discover?tool=` redirects to the new place. |
| Save as a peer of the other three | Demoted. Existing Save missions and their financial impacts are unchanged and still count toward the goal. |
| Opportunity, mission, playbook | Still the stored model and the detail screen. The user meets them inside a cockpit, as an item, a project, or money to collect. |
| Start a mission, with a category picker | Removed from the normal path. Each cockpit has its own create screen. |

## Creating something

The stored model is still one Opportunity plus a playbook. The create experience is not shared.

| From | Route | What the person sees |
| --- | --- | --- |
| Sell → Sell something | `/sell/new` then `/sell/setup/{id}` | Category, name, guided photos, details, similar sales, estimate. Drafts resume. No other cockpit. |
| Freelance → Add a lead | `/freelance/new` | Client or project, then the current state. Proposal, agreed, and invoice fields appear only for that state. |
| Recover → Add expected money | `/recover/new` | Kind of money, who owes it, optional amount and date. |
| Build → Add a product | `/build/new` | An honest stop. Nothing is saved. |
| All activity → Custom mission | `/opportunities/new` | A name and a money type, with the steps added later. Cut a cost lives on this same advanced page, because Save is not a cockpit. |

`/opportunities/new?mode=sell|freelance|recover` redirects into the cockpit route. Old links do not show the category picker.

The principle: generic domain primitives, cockpit-specific creation experiences.

## Reporting

Progress still breaks realized money into Earn, Sell, Recover and Save, because that is what the ledger stores. Do not relabel Earn as Freelance. A product's revenue does not exist as its own type yet, so a chart cannot honestly split it out.

When Build can record revenue, it should write the same `financial_impacts` ledger, with a way to tell product revenue from freelance revenue. Until then the four stored types stay.

## Domain roadmap

The ledger stays the source of realized money. Cockpit-specific objects feed it. They do not replace it.

### Sell, next

An item is not a listing.

```text
Item
  └── Listing (marketplace, asking price, url, listed on)
        └── Offer, later
```

One jacket can be on Vinted and Marktplaats at once. Today a sell mission is one row with one `listed_on` string and one asking price in `context`. That is enough for the shell and wrong for the real cockpit.

Marketplace connections, in the order to investigate: Vinted, Marktplaats, Grailed. Each can later be connected (a real API), linked (the user pastes a URL), or manual (the app drafts the listing, the user publishes it, then adds the URL). No scraping. No fake connected account.

### Freelance, next

The current opportunity plus the freelance playbook is enough for the pipeline. Visibility is a different, lighter thing: one message, one post, one profile pass. It should not be forced into the same state machine as a proposal. A small "visibility action" that can create a lead, rather than a second playbook, is the likely shape. Not designed yet.

### Build, next

```text
Product
  ├── status: idea, validating, building, launched, growing
  ├── RevenueEntry, written by hand at first
  └── the next useful action
```

Revenue entries should become financial impacts, so the goal moves. Stripe and similar stay later. Do not turn this into a project manager.

### Recover

The current playbook is enough. No new object is justified.

## Order

1. Sell, deeply. It is the founder's real case, and it needs the item/listing split.
2. Freelance, pipeline polish plus one real visibility action.
3. Build, the smallest honest product record and manual revenue.
4. Recover, only what the cockpit still makes awkward.

## Not in this pass

Marketplace APIs, scraping, AI valuation, generated listings, nudges for stale listings, social posting, cold email, Stripe, and a build workflow.
