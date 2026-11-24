---
id: s2-01-s2-tests-outside-territory
prd: 3216
slice: s2
rank: medium
bears-on: none
raised: 2026-11-24
wave: 2
---

## The question, in plain words

Moving the settings menu onto the one map changed the order of the settings tabs and the top bar's trail, so nine tests of other pages that spell out the old order failed. Should this slice update them, even though they sit outside its list of files?

## The decision, in plain words

Yes: each of those tests only restated the old order or the old trail, so they now say what the map says, with no test removed or loosened.

## The intro, for fun

The map moved the furniture, so the old floor plans needed a redraw.

## The punchline, for fun

Nine tests, one new order, zero weakened checks.

## The options, in plain words

A. A. Update the other tests to the map's order and trail, as built.
B. B. Keep the old tab order in the map by putting API keys between Business and Jev, so fewer tests change.

## What I had to decide

Edited the tab order, trail and menu expectations in the render tests of the Fleets, Repositories, Business, Jev, Playbook and API keys pages, the Settings reach test, and the switch and header tests. API keys now comes last, after Playbook, because the map orders pages section by section.

## What I did meanwhile

Nothing waits: the tests pass and no address changed.

## What it costs to change later

Reverting to the old order means editing the map's order and these tests back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory lists only the nav files; the other tests had to change for the suite to stay green.
