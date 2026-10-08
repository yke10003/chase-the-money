# Playbooks

**Decision.** The user reports what happened. The app creates only the next relevant action. The generic opportunity model stays underneath. See [0018](../decisions/0018-playbooks.md) and [0020](../decisions/0020-state-driven-playbook-actions.md).

**Likely V1.** Four playbooks: sell an item, freelance, recover money, reduce a recurring expense.

**Later.** More playbooks. Not a workflow engine. Offer history, several marketplaces, proposal versions, annual billing, and buyer back-out stay deferred.

## How a playbook moves

A mission has a stage (where the real-world thing is), an action (what the user can do), and an outcome (what happened). Completing an action never pretends that an external result occurred. The user reports that result.

The server owns the transition. The client sends one call. It does not set stage, status, expected amount, and the next action in separate requests.

A scheduled action has `due_on`. Before that calendar date it is visible on the mission and not completable, and Home does not suggest it. On the date, and after it, Home suggests it even if the opportunity status is still `waiting`. Nothing runs on a clock. See [0021](../decisions/0021-scheduled-action-availability.md).

Closing without money stores `outcome` and status `completed`. The screen uses the outcome label, such as "They declined", not "Abandoned". See [0022](../decisions/0022-playbook-outcomes.md).

## Sell an item

Start from one of:

- I need to value it. Next action: figure out what it is worth. The user can enter an exact figure or a range. That is potential.
- I know roughly what it is worth. Same figure or range, then the next action is to get it ready.
- It is already listed. The user gives the place, the asking price, and an optional link. Prepare and list are not created.

Once it is listed, the user can report an offer, say they sold it without an offer, change the asking price, say it did not sell, or decide not to sell it.

An offer asks for the amount. Accept asks for the agreed sale amount and then "Record what you actually received". Reject returns to listed. A later offer replaces the current one. There is no offer history.

"I decided not to sell it" and "It didn't sell" complete the mission with no realized money.

## Freelance

Start from: not contacted, talking, proposal sent, accepted, doing the work, or invoice sent. Only the action for that state is created.

A sent proposal asks what was quoted (potential, optional) and which day to follow up. A suggested day, such as 7 days out, is shown in the field. The server does not invent a date after a blank submit.

While the follow-up is in the future, the mission says it is waiting. Home stays quiet. On the day, Home shows "Follow up with client". Following up asks what happened: still waiting (pick another day), they accepted, they declined, or stop pursuing. Following up does not unlock the work.

They accepted asks what was agreed. That is the agreed amount and the expected amount. The next action is "Complete the work", a project milestone with no fake duration.

They declined completes the mission, keeps the proposed amount, records no money, and removes the uncompleted follow-up.

After the work, the next action is to send the invoice: amount (prefilled from the agreed amount) and the day payment is due. Before that day, nothing is required. On or after it, Home shows "Payment is due — follow up".

Payment is a first-class outcome only once an invoice exists, plus an optional deposit while the work is agreed or underway. A proposal that is still waiting does not offer "I got paid".

A full payment completes the mission and clears the remaining expected amount. A partial payment records what arrived and the amount still expected. The proposed figure stays.

"They want changes" updates the quote and the follow-up day and stays on proposal sent. It is not acceptance. There is no proposal-version history.

## Recover money

The user names the money, an optional amount, and an optional "I expect it by" date.

- No amount: the next action is to write the amount down.
- Amount and no date: the next action is "Choose when to follow up". It does not sit quietly forever.
- Amount and a future date: waiting, and Home stays quiet until that date.
- On or after the date: Home shows Follow up. The stored status does not need a cron job to become overdue.

After a follow-up the user can set a new promised date, record the full amount, record part of it, or write it off. A refund kind uses "Claim rejected" for the same close.

## Reduce a cost

The user names the expense and, if they know it, the current monthly amount. After the review, the question is "What did you decide?"

- Cancel it. The new cost is €0. This period's saving is realized, and the monthly difference is stored as recurring. The annualized figure is display only.
- Pay less. The user enters the new monthly amount. The difference is realized the same way.
- Keep it. The mission completes with €0 realized and outcome `no_change`. The review still earns its XP. No fake saving is written.

Annual billing cycles are deferred.

## Custom work

**Decision.** Custom missions stay available under More options. A custom step asks for effort (quick, medium, deep), not an XP number. Mark finished stays on custom missions only. Guided missions end through an outcome.
