---
id: s4-01-board-test-reads-the-select
prd: 3129
slice: s4
rank: medium
bears-on: none
raised: 2026-11-21
wave: 4
excuses: [apps/galaxy/src/ideas/Board.test.ts]
---

## The question, in plain words

The ideas board's own test checked the lane list as a native dropdown, and that test sits outside this slice's folders. May this slice update it to read the designed Select?

## The decision, in plain words

The test file for the ideas board was edited to read the new lane picker (the picked lane and the value the form posts). Nothing else in that folder changed.

## The intro, for fun

One test still expected the old grey box.

## The punchline, for fun

It now expects our own list instead.

## The options, in plain words

A. A. Update the board test to read the designed Select, as built.
B. B. Leave the board test alone and move the lane picker's test into the slice's own folders.

## What I had to decide

Edited apps/galaxy/src/ideas/Board.test.ts, two lines, because the lane picker in ideas/members now renders the designed Select and the old markup check could not pass. Without it the full test run is red.
Decided by: Jev (hardToRevert 0.76) · agent said false

## What I did meanwhile

The board test would stay red, and the slice could not be marked ready.

## What it costs to change later

Reverting means putting the old two assertions back and keeping the native lane select, which the PRD forbids.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test of the old behaviour is lost; the pick is covered by select-pick.dom.test.ts. (author)
