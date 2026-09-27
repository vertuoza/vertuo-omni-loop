---
id: s5-02-sent-result-through-the-dossier-page
prd: 251
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

To show what became of a sent reply on the Outbox tab, may this slice touch the dossier page itself, which belongs to another part of the plan?

## The decision, in plain words

Yes, by the smallest change: the dossier page now hands the send's outcome through to the Outbox tab, and does nothing else with it.

## The intro, for fun

The message had to pass through a room this slice does not own.

## The punchline, for fun

It walked through without moving the furniture.

## The options, in plain words

A. Pass the outcome through the dossier page as one optional input.
B. Have the Outbox tab read the outcome itself from the address in the browser.
C. Show the outcome above the whole dossier page instead of on the tab.

## What I had to decide

The plan gives this slice the outbox folder, the outbox routes and the PRD pages, but the tab is drawn inside the dossier page component, which lives in the dossier folder.

## What I did meanwhile

The dossier page component takes one more optional input, the send's outcome, and passes it to the Outbox tab unchanged; nothing else in it changed.

## What it costs to change later

One optional input on one component: moving the outcome some other way later is a small change, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the dossier page component to be shared ground for the Outbox tab's slices.
