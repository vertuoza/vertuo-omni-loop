---
id: s5-01-reviewer-sent-again-same-step
prd: 2871
slice: s5
rank: medium
bears-on: BR-PRODUCT-139
raised: 2026-11-14
wave: 2
---

## The question, in plain words

When the Reviewer, or the fix after it, stops half-way, the mission sends it again once. Should it send that same step again, or start the whole PRD over from the build?

## The decision, in plain words

The mission sends that same step again, once, and a second stop anywhere stops the PRD, as before. Only the build waits on the approval: the Reviewer and the fix after it never do.

## The intro, for fun

The Reviewer tripped on the stairs halfway through its reading.

## The punchline, for fun

It gets one more go at the same page, not a fresh copy of the whole book.

## The options, in plain words

A. A. Send the same step again once, under run 2; steps after the build skip the approval check (built).
B. B. Send the build again as run 2, which hands over to the Reviewer's round 1 again.
C. C. Send the same step again, but hold it until the approval stands again.

## What I had to decide

Keep the same step sent again (A), or send the build again and let it hand over to the Reviewer as before (B).

Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

A stopped Reviewer or fix is sent again under the next run's key for the same step (run 2, round 1 or the fix); its round count never grows past two. The approval and blocker checks still hold the first build and a build sent again.

## What it costs to change later

A change to one function of the supervisor and its tests: the keys already allow both shapes, and no stored row depends on which one is used.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a stopped Reviewer follows the existing row, sent again once, without saying whether the build or the Reviewer goes again.
- (author) Whether shipping a PRD voids its approval on the page, which would hold every step after the build if they still waited on it.
