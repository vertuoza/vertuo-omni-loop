---
id: s1-01-before-table-not-measured
prd: 2401
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

The table of how fast the two pages are today could not be taken here, because it needs a signed-in session cookie for production that this run does not hold. Who takes it, and when?

## The decision, in plain words

The measuring script is built and tested, but nobody has run it against production yet, so the sub-PR carries no before table.

## The intro, for fun

A stopwatch is only useful once somebody presses the button.

## The punchline, for fun

The button needs a cookie, and the cookie is not ours to hold.

## The options, in plain words

A. A. A person runs the script against production and posts the table on the feature PR before it merges.
B. B. Drop the before table and judge the result by the Server-Timing reads alone.

## What I had to decide

A person runs the measuring script against production on a checkout of this branch, before the feature PR merges, and pastes the table into the feature PR.

## What I did meanwhile

The other slices go on; the measurement reads the same production pages before any of them is deployed.

## What it costs to change later

Measuring after the first slices deploy would no longer be a before: the 50% target would have nothing honest to compare with.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The before table is not in this sub-PR's body (author).
