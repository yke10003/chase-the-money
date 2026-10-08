# Mission detail

**Decision.** The screen answers what is happening and what the user should do or report next. It does not show "Step X of Y". It follows `playbook_view` from the API and does not decide which outcome is legal.

## Header

Type glyph, playbook kind and state ("Sell · Listed"), and the mission name.

## Main column

One "now" panel, chosen by state:

- **Do this now.** The next action is available effort. Title, description, time, and the XP it earns. A form when the action asks for answers (value, listing, proposal, invoice, payment), otherwise one button with a specific label ("It's listed", "The work is done", "Bank it").
- **Your move.** A follow-up is due. The user follows up in the world, then reports what happened below.
- **Waiting.** The next action is dated in the future: a calendar block with the date, how long to go, and "Nothing is required before…". The mission returns to Home on that day.
- **Your call.** There is no action and the server's headline is a question ("What did you decide?"). The outcomes become the panel.
- **Where it stands.** There is no action, for example a listed item. The server headline ("Listed on Vinted") and what to report next.

Below it: **What happened?** (or "Heard back already?" while waiting). Outcomes are a list. Choosing one expands its fields. An outcome with no fields asks for one more tap ("Confirm: They declined") and says that it closes the mission. Closing outcomes sit apart, in red. Recording money asks the browser to confirm the amount and uses the green "Bank it" button.

Paused missions show a short panel with Resume.

A finished mission shows the outcome and date. With money: the banked figure in large green, plus monthly/annualized saving for Save, labelled as not counted. Without money: an outcome-specific line ("Reviewed and kept. Decision made.", "They passed. Not every proposal lands."), and the XP from the work that was done.

History (completed steps, money, XP) is a collapsed list under the main column.

## Side column

- **Money.** The server's money lines, each with a certainty mark: Received and Saved this period are banked; Agreed and Still expected are expected; Proposed, Worth, Asking, and Offer are possible. Worth shows the stored range. On a closed mission a leftover expected amount reads "Was expected".
- **The story so far.** A display-only track of the playbook's stages (Sell: Value, Prepare, List, Offer, Sold, Paid). A natural negative ending marks where it stopped.
- **Manage.** Name and notes, "Fix a date or amount" (the playbook's editable fields until money exists), "Add a step" on custom missions, Pause, Mark finished (custom only), Delete.

The API still records settlement as none, partial, or full. The client does not ask the user to pick those words.

## Feedback

After a step or outcome, a short toast says what happened, how much was banked, and the XP. Crossing 25/50/75/100% of the current goal adds a line. No confetti.
