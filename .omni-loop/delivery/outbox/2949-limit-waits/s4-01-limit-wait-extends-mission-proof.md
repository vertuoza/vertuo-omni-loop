---
id: s4-01-limit-wait-extends-mission-proof
prd: 2949
slice: s4
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The tests that prove a mission carries on after a lost runner now also cover a PRD that waits out a provider limit. Do the extended tests still prove the same rule?

## The decision, in plain words

We kept the old cases and added new ones beside them: a limited job with a resume reads as waiting and keeps its run and its place, a job no runner can take reads as waiting for room, and the 6th wait's failure stops the PRD with its reason.

## The intro, for fun

The mission learned to sleep through a storm instead of calling it a day.

## The punchline, for fun

Same promise, more weather: the mission keeps going.

## The options, in plain words

A. Keep the limit cases in the same tests: they prove the same rule for one more ending
B. Move the limit cases into tests of their own, leaving the rule's proof as it was
C. Keep them, and amend the rule's words to name a provider limit's wait

## What I had to decide

Confirm that supervisor.test.ts and mission.e2e.test.ts still prove BR-PRODUCT-139 once they also cover a provider limit's wait and a wait for room (PRD 2949 s4), or say which case the rule should name.

## What I did meanwhile

The extended tests run in the workspace test run; the rule's text is unchanged.

## What it costs to change later

Low: answering B only moves the limit cases into tests of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether BR-PRODUCT-139 should say in words that it covers a provider limit's wait too.
