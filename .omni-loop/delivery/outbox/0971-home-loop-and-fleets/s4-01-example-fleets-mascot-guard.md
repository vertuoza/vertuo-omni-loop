---
id: s4-01-example-fleets-mascot-guard
prd: 971
slice: s4
rank: medium
bears-on: none
raised: 2026-10-02
wave: 4
---

## The question, in plain words

The check that keeps the old company fleets out of the code also flags the spy mascot that the new example fleet SPY RING flies. Should HOME's example fleet list be allowed to name that mascot?

## The decision, in plain words

We let the example fleet list name the spy mascot, the same way the card rules and the sprite library already may. It is still never allowed as a fleet's name.

## The intro, for fun

Our spy fleet got stopped at the border for carrying its own passport.

## The punchline, for fun

We stamped it through, since the passport is the mascot, not the name.

## The options, in plain words

A. A. Add the example fleet list to the guard's mascot tables (built).
B. B. Give SPY RING another mascot the sprite library holds, and leave the guard as it was.
C. C. Keep SPY RING's spy mascot but read it from the card rules' table instead of naming it.

## What I had to decide

Whether HOME's example fleet list may name the spy mascot, as the card rules already do.

## What I did meanwhile

The example fleet list is on the guard's list of mascot tables; the spread shows SPY RING with its spy mascot as the spec asks.

## What it costs to change later

One line in a test's allow list: removing it means renaming or dropping SPY RING's mascot.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The change sits outside the slice's territory: the guard test lives in apps/galaxy/src/no-vertuoza-fleets.test.ts (author)
