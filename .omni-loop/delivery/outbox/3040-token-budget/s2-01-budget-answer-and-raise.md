---
id: s2-01-budget-answer-and-raise
prd: 3040
slice: s2
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-18
wave: 1
---

## The question, in plain words

The plan did not say who may answer a paused mission's budget question, or who may change a mission's budget once it runs. Who should?

## The decision, in plain words

Any member can stop the mission or resume it tomorrow, but only an owner can raise a cap, and only an owner changes a mission's budget once it has started. Each answer is given once by the person, never by the supervisor.

## The intro, for fun

A mission ran out of tokens and raised its hand.

## The punchline, for fun

Anyone may say stop, but only an owner may top up the jar.

## The options, in plain words

A. Any member stops or resumes tomorrow; only an owner raises a cap, above the one reached; a started mission's budget is an owner's to change (built).
B. Any member may answer in every way, raising a cap included.
C. Only an owner may answer a budget question at all.

## What I had to decide

Keep A, or pick who may raise a cap and who may answer.

## What I did meanwhile

The routes of the Missions tab call these rules as the signed-in person, so the database refuses whoever may not.

## What it costs to change later

Low: each rule is one line in a database function, changed by a small follow-up migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says an owner can raise a running mission's budget, but a member's push of the brief can still change its tokens, as it changes any of the mandate today (BR-PRODUCT-138).
- (author) The plan named no functions for setting a mission's budget or answering a stop, nor event kinds for the room's row; this slice added set_mission_tokens, answer_mission_budget_stop, the budget-stop and budget-answer event kinds, and the fleet count's oldest job end that Resume tomorrow needs, since only this slice may add a migration.
