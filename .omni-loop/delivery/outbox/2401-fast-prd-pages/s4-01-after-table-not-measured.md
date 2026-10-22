---
id: s4-01-after-table-not-measured
prd: 2401
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The table of how fast the two pages are now, to set beside the one from before, could not be taken here, because it needs a signed-in session cookie for production that this run does not hold. Who takes it, and when?

## The decision, in plain words

The measuring script is ready, but nobody has run it against production after the changes, so the sub-PR carries no after table and the 50% target is not shown to be met.

## The intro, for fun

The stopwatch is back in the drawer and the cookie jar is locked.

## The punchline, for fun

Without the cookie, the race has no finish line.

## The options, in plain words

A. A. A person runs the script against the deployed feature and posts the after table on the feature PR before it merges.
B. B. Judge the result by the Server-Timing reads of the deployed pages alone, and drop the after table.

## What I had to decide

A person runs the measuring script against production once the feature is deployed to a preview or to production, with a session cookie of their own, and pastes the after table beside the before table on the feature PR.
Decided by: Jev (hardToRevert 0.56) · agent said false

## What I did meanwhile

The slice's code is built and tested; the Server-Timing reads name each step, so a slow read can be found as soon as the pages are measured.

## What it costs to change later

Measuring later changes nothing in the code; the only risk is deploying before anyone has looked at the numbers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The after table is not in this sub-PR's body (author).
