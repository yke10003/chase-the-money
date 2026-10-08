# Mission flow audit

Audit date: 2026-10-06. This describes the application as implemented. It is not a design proposal and it does not change behavior.

Sources traced: `PlaybookRunner`, `PlaybookController`, `BuildHomeDashboard`, `HomeController`, settlement and XP code, the Expo create/detail/home screens, and `docs/product/playbooks.md`, `docs/screens/opportunity-detail.md`, `docs/screens/home.md`.

Where a doc and the code disagree, the row is marked **Doc mismatch**.

## 1. Executive summary

The four playbooks can complete a happy path: value and sell an item, walk a freelance job from a chosen starting point through payment, record money recovered, and record a lower recurring cost. Standard steps, effort, and XP are system-owned. Settlement words stay off the main screen.

The awkward branches are real, and they cluster in three places.

1. **Waiting does not mature.** A proposal, invoice, or expected repayment created as `waiting` stays `waiting` after its date. Home only suggests `explore` and `active` missions, so the follow-up never becomes "Best next move" unless the mission was already active when it was created (for example a repayment dated in the past).
2. **There is no natural failure.** Declined, unsold, refused, written off, or "I'll keep this subscription" are not outcomes. The exits are Pause (stored as abandoned), Delete, or Mark finished, all under More.
3. **Money is collected at the end, not when the user knows it.** A sent proposal does not ask what it was worth. Nothing in the guided freelance flow stores a proposal amount or an agreed amount. The screen keeps saying "No amount agreed yet" until a payment is recorded.

"Step 1 of 4" on a proposal that was already sent means "first of the actions this start state generated," not "first stage of freelance." That reading is easy to miss.

`Relevant date` on mission create is not one concept. For "I sent a proposal" and "I sent the invoice" it becomes `expected_on` and is copied into the follow-up sentence. If the field is left blank, the server uses today plus 7 days. For the other freelance states the same field is optional and does not make the mission wait.

Date strings are a plain text field. `2026-09-30` is the intended format. `30-09-2026` is accepted and stored as 30 Sep 2026. `30/09/2026` is rejected. There is no date picker.

## 2. How to read a mission

Three different things get called a "step":

| Concept | What it is | Example for "I sent a proposal" |
| --- | --- | --- |
| Stage | String on the opportunity (`proposal`, `listed`, …). Not shown as the step counter. Shown under More as "Waiting · Proposal". | `proposal` |
| Status | `explore`, `active`, `waiting`, `completed`, `abandoned`. Home suggestions use only `explore` and `active`. | `waiting` |
| Generated action | A row created at start. "Step X of Y" counts these rows only. | 4 actions, so the screen opens on **Step 1 of 4** |

Y is not the full lifecycle. Skipped earlier stages are not in the count. Completing an action can move stage and status, or it can do nothing but award XP (`follow_up`).

XP for a standard step is fixed when the action is created. The user cannot type it. A payment can add a separate bonus: 10 / 20 / 30 XP at €100 / €500 / €1,000 realized. That bonus can be written again on every partial payment.

## 3. Sell an item

### Creation

Entry points: Discover Money Hunt, Start a mission, a first-plan link into Money Hunt.

| Field | Required | Effect |
| --- | --- | --- |
| Name | Yes | Title |
| Category | Only on Money Hunt | Stored in `context.category` and also copied into `notes` |
| Rough value | No | One number. Sent as both min and max. Blank means unknown |

There is no "already listed" starting point.

| If value is | Status | Stage | Actions created | Potential |
| --- | --- | --- | --- | --- |
| Blank | `active` | `valuing` | Value (10 XP, 30 min), Prepare (15 XP, 45 min), List (25 XP, 30 min), Get paid (25 XP, 10 min) | Empty |
| Provided, including 0 | `active` | `ready_to_list` | Prepare, List, Get paid. Valuation is not created | That number as min and max |

No expected amount. No date.

### Main path

```text
Value (optional)
  → potential min/max stored, stage stays valuing, status active
Prepare
  → stage ready_to_list, status active
List
  → context.asking_price_minor, listed_on, listing_url
  → stage listed, status active
Offer (optional button, only once stage is listed or offer)
  → context.offer_minor, stage offer, status active, 10 XP once
Get paid
  → realized Sell impact, expected cleared, stage paid, status completed
  → outcome bonus if the amount crosses €100 / €500 / €1,000
```

Get paid asks "Amount you received (EUR)". The action description says "after fees." One net amount is stored. The estimate is not changed.

### Alternatives

| Situation | Now |
| --- | --- |
| User already knows the value | Supported. Skips valuation. Cannot enter a range at creation (min and max are the same number). A range is only on the value step. |
| Already listed | Unsupported. Closest start is "I know the value," which still requires prepare and list. |
| Several offers | One slot. A new offer overwrites `offer_minor`. XP is not awarded twice. |
| Reject an offer | Unsupported. |
| Change the asking price | Unsupported after listing. More edits name and notes only. |
| Does not sell / user stops | Pause or Delete under More. Pause is abandoned. No "didn't sell" outcome. |
| Take the listing down | Unsupported, other than notes or pause. |
| Buyer backs out after a yes | Unsupported. |
| Sells without an offer | Supported. Offer is optional. Get paid is always in the list. |
| Sells for more or less than the estimate | Supported. Potential is left as history. |
| Fees | Supported only as "type the net amount." No fee field. |
| More than one marketplace | One `listed_on` string and one URL. |
| Partial payment before the sale is finished | Possible under More ("I received part of it"). Not on the main path. Records money, sets remaining expected, does not complete. |
| Wrong amount or accidental complete | Cannot edit or delete the impact. Cannot reopen a completed action. Reopen on the mission sets status back to active and does not undo money or finished steps. |

### Waiting, Home, completion

Sell missions are created `active`, so Home can suggest the first open action. Reasons: "Waiting on you" if `expected_on` is before today (sell rarely has one), "Due soon" within 7 days, otherwise "Quick win" when the action is 20 minutes or less. Value is 30 minutes, so it often has no reason label.

Completion is Get paid, or Mark finished under More with no money. Failure is Pause or Delete.

**Doc mismatch.** `playbooks.md` matches the happy path and the offer button. It does not say a known value skips the value step, or that creation cannot take a range.

## 4. Freelance work

### Creation

Entry points: Start a mission, Discover skill missions (always "I have not reached out"), Home starter "Contact 3 colleagues" or, if time is short, "Send one note…" (also always that first state).

The form is the same for every starting point:

| Field | Required | Meaning in the code |
| --- | --- | --- |
| Name | Yes | Title |
| Where are you currently? | Yes | `current_state` |
| Relevant date | No | See below. Placeholder text says `YYYY-MM-DD` |

No amount field at creation. No counterparty. No "what was proposed."

`Relevant date` is stored on `expected_on` only for some states:

| Starting choice | Status | Stage | `expected_on` | Actions, in order |
| --- | --- | --- | --- | --- |
| I have not reached out yet | `active` | `idea` | The date if typed, otherwise empty | Make contact (25 XP, 20 min), Send a proposal (25 XP, 45 min), Follow up (10 XP, 10 min), Do the work (25 XP, 90 min), Send the invoice (25 XP, 20 min), Record payment (25 XP, 10 min) |
| We are talking | `active` | `contact` | Same | Send a proposal onward |
| I sent a proposal | `waiting` | `proposal` | The date, or **today + 7 days if blank** | Follow up, Do the work, Send the invoice, Record payment |
| They accepted | `active` | `agreed` | The date if typed, otherwise empty | Do the work onward |
| I am doing the work | `active` | `working` | The date if typed, otherwise empty | Send the invoice, Record payment |
| I sent the invoice | `waiting` | `invoiced` | The date, or **today + 7 days if blank** | Record payment only |

The follow-up action's description is always "Nothing is required before {date}." That date is the typed date or today + 7, **even on paths where the opportunity's `expected_on` is left empty** (lead, talking, accepted, working). The sentence is baked in at creation. Later date edits do not rewrite it. The API does not expose a date edit on the guided screen anyway.

Potential and expected **amounts** stay empty. `context.current_state` remembers the start choice and is not updated when later steps run.

Screen counter: a proposal already sent has four generated actions and zero of them done, so the subtitle is **Freelance · Step 1 of 4**. That is the first remaining action, not stage 1 of freelance.

### Main path, if every generated action is completed in order

```text
Make contact
  → stage contact, status active
Send a proposal
  → stage proposal, status waiting
  → optional date field labeled only "Date (YYYY-MM-DD)" overwrites expected_on
Follow up
  → no stage change, no status change, 10 XP
Do the work
  → stage working, status active
Send the invoice
  → stage invoiced, status waiting
  → does not set a new due date
Record what you received
  → realized Earn impact, expected amount cleared, stage paid, status completed
```

There is no step that asks for a proposal figure or an agreed figure. The money line for every Earn mission is "No amount agreed yet" until `expected_amount_minor` is set. The playbook never sets that field. A partial payment under More does, by storing whatever "still coming" the user types.

### The proposal-sent case

This is the branch found in manual testing.

What the date is: a follow-up date, stored as `expected_on`. It is not "payment expected on" and not a proposal expiry. If the user leaves it blank, it is still filled with today + 7, and the follow-up sentence uses that invented date.

What the screen does with it:

- While status is `waiting` **and** `expected_on` is strictly after the phone or computer's local today, the follow-up form is hidden. The card says "Nothing needed right now" and "Check back on {date}." The follow-up title is shown as "Later." **I got paid** is still on that card. Up next still lists Do the work, Send the invoice, and Record payment.
- The sentence "Nothing is required before {date}" is the follow-up action's own description. It is shown with a **Done** button when that action is the active step form. That happens when the date is today, in the past, or the mission is not `waiting`. So the combination found in testing (that sentence plus Done) is what the step form does whenever the quiet rule is off. On the morning of the follow-up date, the quiet rule is already off.
- Home does not list this mission at all while it stays `waiting`, including on and after the date.

Marking the follow-up Done, early or on time, only completes that action and adds 10 XP. Stage stays `proposal`. Status stays `waiting`. The next open action becomes Do the work. If the date is still in the future, the quiet card remains and now says "Later: Do the work" while still offering I got paid.

I got paid from that card runs the payment step immediately: records the amount, marks the mission completed, and leaves the follow-up (and any other untouched steps) open in the database. The completed screen hides them.

There is no They declined, They asked for changes, Counteroffer, or No response. After the date, nothing in Home changes. The mission sits until the user opens it, pauses it, deletes it, marks it finished, or records a payment.

Where a proposal value could live today: nowhere in the guided UI. `potential_min_minor` / `potential_max_minor` and `expected_amount_minor` exist on the generic opportunity API. The create form and the step forms do not send them. More cannot edit them.

Where an agreed amount could be captured: only as the realized amount on I got paid, or as "still coming" on a partial payment under More. Both write the ledger. Neither is "we agreed €X, not paid yet."

### Other freelance branches

| Situation | Now |
| --- | --- |
| Move forward along the generated list | Supported, by completing the next action. |
| Move backward | Unsupported. |
| Cancel or stop pursuing | Pause or Delete under More. |
| They decline | Unsupported as its own outcome. |
| They go quiet | The date arrives and the mission stays `waiting`. Detail will show the follow-up as the next step. Home will not. |
| They ask for changes | No branch. A custom step can be added under More. |
| Counteroffer or scope change | Unsupported. No amount to revise. |
| Accepted amount differs from the proposal | No proposal amount was stored. The only number is the eventual payment. |
| Project cancelled or paused | Pause (abandoned) or Mark finished. Mark finished does not ask why and does not require money. |
| Work done, invoice not sent | Supported. Stop on Do the work. Next action is Send the invoice. Home can show it because status is `active`. |
| Invoice partially paid | Under More only. Mission stays open. Got-paid step still open. |
| Invoice overdue | Not derived. Send invoice sets `waiting` and does not write a due date. An older follow-up date, if still in the future, makes the quiet card say nothing is needed until that old date, even though the next real step is getting paid. |
| User picked the wrong starting stage | Cannot change it in the UI. |

**Doc mismatch.** `playbooks.md` says a waiting proposal tells the user nothing is required until the date. The quiet card does that for a strictly future date, and it also offers I got paid. The doc does not mention the default 7-day date, the Step 1 of 4 counter, or that Home will not surface the follow-up when the date arrives. `opportunity-detail.md` does say I got paid stays available early. That part matches the code.

## 5. Recover money

### Creation

Discover recovery, or Start a mission.

| Field | Required | Effect |
| --- | --- | --- |
| Name | Yes | Title |
| Kind | Discover only (friend, invoice, refund, reimbursement, tax) | `context.kind`. Not shown as the step title |
| Rough amount | No | `expected_amount_minor` if present |
| When do you expect it? | No | `expected_on` |

| Inputs | Status | Stage | Actions |
| --- | --- | --- | --- |
| No amount | `explore` | `identified` | Write down the amount and date (10 XP, 10 min), Follow up (10 XP, 15 min), Record payment (25 XP, 10 min) |
| Amount, date in the future | `waiting` | `expected` | Follow up, Record payment |
| Amount, date today or past | `active` | `overdue` | Follow up, Record payment |
| Amount, no date | `waiting` | `expected` | Follow up ("Ask for an update."), Record payment |

The app does not invent an amount. A future date does not get a silent +7 days. Overdue is decided once, at creation, using the server's UTC date.

### Main path

```text
Write down the amount (only if it was missing)
  → expected amount and optional date
  → stage expected or overdue
  → status waiting or active
Follow up
  → no state change, 10 XP
Record what you received
  → realized Recover impact, stage received, status completed
```

### Alternatives

| Situation | Now |
| --- | --- |
| Amount unknown at the start | Supported. Capture step asks later. |
| No date | Supported. Follow-up copy does not name a day. Status is still `waiting` if an amount exists, so Home hides it. |
| Promised date changes | Unsupported. The capture form is the only date writer, and only if that step still exists. |
| Partial repayment | Under More. Sets remaining expected. Does not finish the mission. |
| Amount received differs from expected | Supported on I got paid. Expected is cleared. The old figure is not kept as potential. |
| They refuse, or the user writes it off | Unsupported except Pause, Delete, or Mark finished. |
| Refund claim rejected | Same. |
| Tax figure becomes known later | Supported only when the mission was started without an amount, via the capture step. |
| Date was in the future and then arrives | Status stays `waiting`. Detail starts showing Follow up as the next step (the quiet rule ends). Home still does not suggest it. |

**Doc mismatch.** `playbooks.md` says that after the due date the next step is to follow up. That is true on the detail screen only because the quiet rule looks at the date again. It is not true for Home, and the stored status is not updated to overdue.

## 6. Reduce a recurring cost

### Creation

Discover expense audit, or Start a mission.

| Field | Required | Effect |
| --- | --- | --- |
| Name | Yes | Title, for example "Adobe" |
| Current monthly cost | No | `context.current_monthly_minor` |

No billing date. No annual/monthly choice. The playbook always writes a monthly recurrence if a saving is confirmed.

| If the current cost is | Status | Stage | Actions |
| --- | --- | --- | --- |
| Blank | `active` | `identified` | Find what you pay (10 XP, 10 min), Review (15 XP, 20 min), Confirm (25 XP, 10 min) |
| Provided | `active` | `reviewing` | Review, Confirm |

### Main path

```text
Find the monthly cost (optional)
  → context.current_monthly_minor, stage reviewing
Review
  → stage action_taken, status active
  → no question about what was decided
Confirm
  → new monthly amount must be lower
  → realized Save = old minus new, for this period, recorded today
  → recurring monthly saving stored
  → annualized figure is old-minus-new times 12, display only
  → stage confirmed, status completed
```

€0 is allowed as the new amount (cancelled). A new amount equal to or higher than the old one is rejected. If the old amount was never stored, confirm cannot succeed.

### Alternatives

| Situation | Now |
| --- | --- |
| Cancel completely | Supported, by entering 0. |
| Downgrade or negotiate | Supported, by entering the new monthly number. The kind of action is not recorded. The review step does not ask. |
| Decide to keep it, or it is already the cheap option | Unsupported. Confirm will not complete. Leave the step open, or Pause / Mark finished / Delete. Mark finished records no saving. |
| Annual subscription | Unsupported. The user would have to type a made-up monthly number. The ledger interval is forced to `month`. |
| Saving starts next cycle | Unsupported. The difference is realized today. |
| Actual saving differs from the guess | The confirm step is the actual, not a guess. There is no earlier estimate to compare. Cannot edit it afterward. |
| User resubscribes later | Unsupported. |

**Doc mismatch.** `playbooks.md` describes the happy path and the annualized rule accurately. It does not say a zero-or-negative change cannot be saved, or that "keep it" has no ending.

## 7. Custom mission

Still available as "Something else" on Start a mission.

| Field | Effect |
| --- | --- |
| Name | Title |
| Type | Earn, Sell, Recover, or Save |

Created as `explore`, no stage, no actions, no money, no playbook. Detail subtitle uses the status word ("Explore") because there are no system steps. The next-step card says to add a step under More. A custom step asks for a title and Quick / Medium / Deep work (10 / 15 / 25 XP, 10 / 30 / 90 minutes). No XP field.

Home suggests that step once it exists, because status is `explore`. Until then the mission produces no suggestion.

More can record a partial or full-style payment only through "I received part of it" (partial). There is no "I got paid" button unless a playbook added that action. Mark finished, Pause, and Delete work.

This is the generic task list. It is the escape hatch, and it is still one tap from the main create screen.

## 8. Date audit

Every date the user types is a single-line text field. Nothing uses a date picker. Display of an ISO date is `6 Oct 2026` (en-GB, the calendar date, UTC formatting of `YYYY-MM-DD`).

Laravel's `date` rule accepts more than `YYYY-MM-DD`. Checked against the validator and a rolled-back save:

| Typed | Accepted | Stored calendar date |
| --- | --- | --- |
| `2026-09-30` | Yes | 2026-09-30 |
| `30-09-2026` | Yes | 2026-09-30 |
| `30.09.2026` | Yes | 2026-09-30 |
| `30 Sep 2026` | Yes | 2026-09-30 |
| `09/30/2026` | Yes | 2026-09-30 (US order) |
| `30/09/2026` | No | Rejected |
| `2026-09-31` | No | Rejected |
| blank, sent as null | Yes | Empty, except where the playbook substitutes today + 7 |

The frontend does not parse these strings before send. It only turns a blank field into null. An invalid value comes back as a Laravel error on the form. A weird-but-valid value is normalized by the date column, not shown back as typed.

`formatDate` assumes the first three `-` pieces are year, month, day. That matches values the API returns (`YYYY-MM-DD`). It would misread a raw `30-09-2026` if one were ever displayed before the server normalized it.

"Today" for the quiet card is the device's local date. "Today" when deciding overdue at creation is the server date, UTC in the app config. Near midnight those can disagree. The playbook does not reconsider overdue after creation.

| Label in the UI | Where | What it actually is | Format hint |
| --- | --- | --- | --- |
| Relevant date (YYYY-MM-DD) | Start a mission, freelance and recover | Follow-up / `expected_on`. For proposal sent and invoice sent, blank becomes today + 7. For other freelance states it does not make the mission wait. For recover it is "when I expect the money," and blank stays blank. | Hint only |
| When do you expect it? (YYYY-MM-DD) | Discover recovery | Same `expected_on` as recover above | Hint only |
| Date (YYYY-MM-DD) | Send-proposal step, and the recover capture step | Follow-up date, or expected date. The label does not say which. | Hint only |
| Count from / Reach it by | Onboarding, by-a-date goal | Goal window. Placeholder `YYYY-MM-DD` | Placeholder only |
| Starts / Ends | Settings, only for a non-repeating goal | Goal window | No format hint |
| Listed-on is not a date | Sell list step, "Where did you list it?" | A place name, stored in `context.listed_on` | Free text |

Goal period dates that the user does not type (weekly and monthly) are derived. They are not part of this input problem.

## 9. Actions, completion, and getting stuck

Generated actions are created all at once, in order, for the chosen start. The user completes the first open one. Later ones are listed, not tappable.

| Question | Current behavior |
| --- | --- |
| Can a future follow-up be completed early? | Not from the quiet card. On the due date, and whenever the mission is not in that quiet state, yes. Completing it does not mean the follow-up happened in the world. It only closes the row. |
| Are waiting actions disabled? | The current one is hidden, not disabled, and only while the quiet rule holds. Later actions stay visible as titles. |
| Does completion move the mission? | Value, prepare, list, reach out, send proposal, do the work, send invoice, review, capture amount, capture cost, confirm, and get paid do. Follow-up does not. |
| Can the user add their own step? | Yes, under More, any open mission. |
| Can they get stuck with no action? | A custom mission starts that way. A playbook always has at least one action, except a sell/recover/save path still has the payment or confirm step. After every generated action is done without the mission completing (follow-up does not complete it; get paid does), the next card says there is no open step. |
| Can a finished action be reopened? | No. The API rejects edits and deletes of completed actions, including system ones. |
| Can system actions be deleted or renamed? | No. |
| Accidental Get paid / Confirm | One-way for the ledger and for that action. Mission reopen does not reverse them. |

Confirm is also one-way in another way: a saving that is not strictly lower cannot be submitted. The user cannot record the true outcome "no change."

## 10. Home

Suggestions ignore `waiting`. They also ignore actions on completed and abandoned missions.

| Mission state | Suggested on Home? | After the date? |
| --- | --- | --- |
| Sell, any open step | Yes, first open action | No date involved |
| Freelance lead, talking, accepted, working | Yes | A typed "relevant date" only changes the reason label (due soon / overdue). It does not hide the action |
| Freelance proposal sent, or invoice sent | No | Still no. Status never leaves `waiting` by itself |
| Recover, no amount yet (`explore`) | Yes, the capture step | — |
| Recover, amount and a future date | No | Still no, even after the date. Detail does start asking for the follow-up |
| Recover, created already overdue | Yes. Reason "Waiting on you" | Stays suggested |
| Save, any open step | Yes | — |
| Custom with no steps | No | — |
| Custom with a step | Yes | — |

"Waiting on you" does **not** mean status `waiting`. It means `expected_on` is before today on a mission Home is already willing to show.

An empty account does not dead-end: starter missions replace suggestions. A founder-shaped account with a live proposal and no other `active` step will not see that proposal on Home. The jacket and other active steps will.

**Doc mismatch.** `home.md` says a waiting item should stay quiet until it needs action. The implementation stays quiet forever, including after it needs action.

## 11. Corrections

| Mistake | Recovery |
| --- | --- |
| Wrong mission name or notes | More → edit. Supported. |
| Wrong starting stage | Not in the UI. |
| Wrong follow-up or expected date | Not in the UI after create. |
| Completed a step by accident | Not reversible. XP stays. |
| Wrong realized amount | Not reversible. Another payment can be recorded only if the mission is still open (partial, or get paid if that action is still open). A completed mission's reopen does not reopen the payment action. |
| Marked finished with no money | Reopen under More, on the completed screen. Status returns to active. Steps that were already completed stay completed. |
| Paused by mistake | Reopen. |
| Deleted the mission | Gone. Money and XP already recorded stay on the user. Actions do not. |

Delete's confirm text mentions money and not XP. Both remain.

## 12. Domain language still on screen

| Where | What the user sees | Closer product language |
| --- | --- | --- |
| More → edit details | "Earn · Waiting · Proposal" (type, status, stage) | "Freelance · Waiting to hear back" |
| Opportunity list pill | Type, status, and stage | The same kind of phrase, plus the next action (already shown underneath) |
| Recent wins | The word "impact" and the XP reason | "You recorded €410" / "Follow up · 10 XP" |
| Start a mission | "Relevant date" | "Follow up on" or "I expect it on" |
| Step form | "Date (YYYY-MM-DD)" | The same, specific, labels |
| Quiet card vs follow-up description | "Nothing needed" and also "I got paid", or "Nothing is required before …" and Done | One instruction: wait, follow up, or record the outcome |
| Pause | Stored as abandoned | Either call it abandoned or stop using abandoned for a pause the user can reopen |
| Partial payment | Only under More, and the API kind is `partial` | Fine as a secondary control, but the bonus XP and the lack of a revise path leak the ledger |

Settlement enums (`none`, `partial`, `full`) are not on the main forms. That part of the earlier cleanup holds. The API still uses them.

## 13. Issue table

### P0 — blocks a common real-world case

| # | Issue |
| --- | --- |
| 1 | A `waiting` mission never becomes due. Home will not suggest the follow-up on or after the date, because status is not recalculated. |
| 2 | Decline, no sale, refusal, write-off, and "I kept the subscription" are not outcomes. Pause, Delete, and Mark finished are the only exits, and they do not say what happened. |

### P1 — works, but it will confuse or cause bad records

| # | Issue |
| --- | --- |
| 3 | A sent proposal never asks for a value. No guided freelance step stores a proposal amount or an agreed amount. |
| 4 | "Relevant date" is overloaded. Blank becomes today + 7 for proposal sent and invoice sent, without saying so. |
| 5 | The follow-up can be marked Done without any state change. When the quiet rule is off, Done sits on top of "Nothing is required before {date}." |
| 6 | While "nothing is needed," I got paid is still offered and can complete the mission, leaving earlier steps open in the data. |
| 7 | "Step 1 of 4" on an in-progress start means the first generated action, not the first stage of the lifecycle. |
| 8 | Sell cannot start from "already listed." A known value cannot be entered as a range at creation, and neither the value nor the asking price can be revised later. |
| 9 | One offer can be saved. It cannot be rejected. A second offer replaces the first. |
| 10 | Partial payment is under More and can grant the outcome bonus again each time. |
| 11 | Wrong stage, wrong date, a completed step, and a wrong realized amount cannot be corrected in the UI. |
| 12 | A cost review cannot end in "no change." Confirm requires a strictly lower amount. |
| 13 | The saving is realized today. There is no "starts next bill" and no annual amount. |
| 14 | After the invoice step, a previous follow-up date can still drive the "check back on" sentence. |
| 15 | Home's "Waiting on you" means the date is past, not that the mission is waiting. Actual waiting missions are omitted. |
| 16 | Status and stage names are still visible on the list and under More. |

### P2 — real, but the core loop survives without them

| # | Issue |
| --- | --- |
| 17 | Dates are free text. `30/09/2026` fails. `30-09-2026` and `09/30/2026` succeed and are normalized. No picker. Goal dates work the same way. |
| 18 | "They want changes," a counteroffer, or a scope change has no branch. A custom step is the workaround. |
| 19 | Several marketplaces, a history of offers, and a buyer backing out are unsupported. |
| 20 | Server "today" is UTC and the quiet card's "today" is local. They can differ for a few hours. |
| 21 | A custom mission is an empty list until the user adds a step. |
| 22 | Deleting a mission keeps XP as well as money. The confirm text mentions money only. Reopen does not bring back a payment step that already completed. |

### Later

| # | Issue |
| --- | --- |
| 23 | Offer history, marketplace records, annual billing as its own model, and undoing ledger rows. |

Counts: **2 P0, 14 P1, 6 P2, 1 Later** (item 23 is one bucket, not one bug).

## 14. Decisions to make before the next build

1. **Waiting.** Should "the date arrived" be derived when Home and detail are read, so a proposal follow-up shows up by itself? Or does the user always have to open the mission?
2. **The follow-up action.** Before the date, should it be absent, visible but not completable, or completable? Should Done mean "I followed up" and then ask what happened?
3. **Proposal money.** Do we ask for a proposed amount when the user says they sent a proposal, and an agreed amount when they say it was accepted? Those would be potential and expected, not realized.
4. **Negative outcomes, per playbook.** Which of these are first-class for V1: they declined, no response and I am dropping it, it did not sell, they will not pay, I am writing it off, I am keeping the subscription?
5. **Step counter.** Should a mission started at "proposal sent" say where it is in the whole freelance story, or only list what is left? If it only lists what is left, the label should not look like a 4-step lifecycle.
6. **Dates.** Replace "Relevant date" with "Follow up on" or "I expect the money on," and stop accepting ambiguous strings. Not a visual-design question. It is which meaning each field has.
7. **Early payment.** Is "I got paid" on a waiting proposal intentional, and should it close the other steps?
8. **Corrections.** Is "cannot undo a payment or a completed step" acceptable for V1 if wrong stage and wrong date become editable?

Suggested order, once those are decided: fix Home so a due follow-up appears (P0-1), add the few negative endings that V1 will actually use (P0-2), then proposal/agreed amounts and the date labels (P1-3, P1-4, P1-7). The rest of the P1 list can wait until those three are settled, because they change the same screens.

## 15. Resolution

Recorded 2026-10-06, after the state-driven playbook pass. The findings above are unchanged on purpose.

| Audit item | What shipped |
| --- | --- |
| 1 Waiting never matures | `due_on` is checked when Home and detail are read. A waiting mission with a due action is suggested. Status is not rewritten by a job. |
| 2 No natural failure | Decline, didn't sell, decided not to sell, write-off, claim rejected, and keep-the-subscription complete the mission with an `outcome`. |
| 3 Proposal has no value | Optional proposed amount is potential. Agreed amount is its own column and also the expected amount until a partial payment. |
| 4 Relevant date | Labels are "Follow up on", "Payment due on", and "I expect it by". A blank date is not filled in after submit. A suggested day is the value shown in the control. |
| 5 Follow-up Done is a no-op | Following up is an outcome that asks what happened. It does not unlock the work. |
| 6 I got paid while waiting on a proposal | Payment outcomes start after the work is agreed. A deposit is secondary. Full payment is for an invoice. Open future actions are removed when the mission completes. |
| 7 Step X of Y | Replaced by the stage label. |
| 8 Sell start and edits | Need a value, known value or range, or already listed. Asking price and worth can be corrected before money is recorded. |
| 9 Offers | Accept, reject back to listed, or replace the current offer. History is deferred. |
| 10 Repeated bonus | Each of €100, €500, and €1,000 is awarded once on the cumulative realized total. |
| 11 Corrections | Dates and amounts that have not been realized can be edited. Ledger rows stay immutable. |
| 12 Keep the subscription | Outcome `no_change`, €0 realized, review XP only. |
| 13 Saving realized today | Unchanged. Annual billing is deferred. The annualized figure is still not realized. |
| 14 Stale follow-up date after invoice | The invoice writes its own payment-due action. |
| 15 Home labels | Overdue, Due today, Due soon, Quick win, Waiting on you. Waiting missions with a due action are included. |
| 16 Raw status and stage | List and detail use `stage_label`. |
| 17 Date formats | Web date controls. API user-facing dates require `YYYY-MM-DD`. |
| 18 Changes requested | A secondary freelance outcome updates the quote and the follow-up day. No version history. |
| 19 Marketplaces and buyer back-out | Deferred. |
| 20 Timezones | Comparisons use the calendar date, not a timestamp. |
| 21 Custom empty list | Custom remains, under More options. |
| 22 Delete keeps XP | Unchanged. |
| 23 Later ledger and offer history | Still deferred. |

Pause is a real status. It is not abandoned, and it is not a home suggestion.

