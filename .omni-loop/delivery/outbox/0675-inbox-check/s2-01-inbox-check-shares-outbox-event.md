---
id: s2-01-inbox-check-shares-outbox-event
prd: 675
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The plan said the app's front door should send a separate inbox signal beside the outbox one for every pull request change. Should it, or may the inbox check simply listen to the signal the outbox check already gets?

## The decision, in plain words

The inbox check listens to the outbox check's existing signal, so every pull request change starts both checks with nothing new sent. Pressing Re-run on the inbox check sends a signal of its own that starts only the inbox check.

## The intro, for fun

Two checks, one doorbell: why ring twice?

## The punchline, for fun

The inbox check just listens for the same ring.

## The options, in plain words

A. A. The inbox check listens to the outbox check's event; a Re-run of an inbox run sends the inbox event alone
B. B. The webhook sends both events for every pull request action, as the plan worded it
C. C. One event only, and the Re-run button of either check re-runs both

## What I had to decide

Whether the webhook sends a second, inbox-specific event for every pull request action, or the inbox-check function also triggers on the outbox check's existing event.

## What I did meanwhile

inbox-check triggers on omni-loop/outbox.check.requested and on omni-loop/inbox.check.requested. The webhook is unchanged for pull request actions; a check_run.rerequested whose external_id is omni-loop/inbox (every inbox check run carries it) becomes the inbox event alone. Sending a second event per action would have made the outbox check's own end-to-end test, outside this slice's territory, run the outbox function on the inbox event too.

## What it costs to change later

A constant: add the inbox event to toCheckRequests for pull request actions, drop OUTBOX_CHECK_EVENT from inbox-check's triggers, and make the outbox end-to-end test run only the outbox events it receives.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not yet seen live whether Inngest fans one event out to both functions with each function's own debounce, as its documentation says
