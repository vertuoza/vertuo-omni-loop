---
id: s4-05-menu-tests-outside-territory
prd: 1246
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Adding Ideas to the menu meant updating two automatic checks that list every menu entry, which sit outside this part's agreed area. Is that fine?

## The decision, in plain words

Yes: both checks now expect Ideas after Roadmaps, and the check that every entry opens a real page follows the Ideas entry to the board, or to the repositories settings when there is none.

## The intro, for fun

A new door in the hallway means a new line on the fire plan.

## The punchline, for fun

The fire plan hung in the next corridor.

## The options, in plain words

A. Keep the two tests updated here, as built.
B. Give Ideas a fixed page of its own, /ideas, that sends a member on to their board, so the menu entry needs no special case.

## What I had to decide

Whether to change apps/galaxy/src/switch/switch.test.ts and headers.test.ts, outside the slice's territory, so the new Work › Ideas entry passes them.

## What I did meanwhile

headers.test.ts lists Ideas after Roadmaps; switch.test.ts checks the Ideas entry through hrefOf(), whose fallback is /app/settings/repositories, and that the board's route app/ideas/[owner]/[repo]/page.tsx exists.

## What it costs to change later

A few lines in each of the two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice apps/galaxy/src/nav/ but not the tests in apps/galaxy/src/switch/ that pin the menu's entries.
