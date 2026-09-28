---
id: s1-01-fleets-card-test-moved-to-sidebar
prd: 438
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The Fleets page had a test that checked the home page's Fleets card. The card is gone, so what should that test check now?

## The decision, in plain words

We changed that one test to check that the sidebar's Fleets item leads to the Fleets page, even though the fleets tests were not on this slice's list of files.

## The intro, for fun

A signpost was taken down, and its test was left pointing at empty air.

## The punchline, for fun

So the test now points at the new signpost, a little to the left.

## The options, in plain words

A. Edit the one fleets test to check the sidebar item, the option built.
B. Delete the fleets test block, and let the sidebar tests alone cover the Fleets link.
C. Keep the old home page cards alive only for that test, against the spec's removal.

## What I had to decide

Whether a test file outside the slice's territory (the fleets page's render test) may be edited to follow the removal of /app's section cards.

## What I did meanwhile

apps/galaxy/src/fleets/render.test.ts no longer imports the deleted Cards.tsx; its last block checks SIDEBAR's Fleets item links to /app/fleets.

## What it costs to change later

One test block, easy to move or drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant to list src/fleets/render.test.ts in s1's territory and left it out by oversight (author)
