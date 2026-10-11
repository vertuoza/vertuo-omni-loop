---
id: s2-01-duet-listed-among-the-tall-scenes
prd: 1633
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

On a phone held upright, the arcade lays a screen out tall only when it is on one shared list, and the plan did not give this slice the file that holds it. Should this slice add the new game to that list?

## The decision, in plain words

Yes: one line adds the new game's screen to the shared list, so a phone held upright draws the game on its full tall screen, as the plan asks. Nothing else in that file changed.

## The intro, for fun

Every screen in the arcade has to sign one guest book before a phone will show it standing up.

## The punchline, for fun

The new game signed it, in its own handwriting, one line long.

## The options, in plain words

A. Add the new game to the shared list of tall screens, outside this slice's files
B. Leave the list alone until a later slice is given its file, with the test run red meanwhile

## What I had to decide

Keep A: the game's screen is on the shared list of tall screens, as every other game's is. B would leave the full test run red on the feature branch and draw the game sideways inside a phone held upright, against the plan's done-when.

## What I did meanwhile

Built as A: apps/galaxy/src/arcade/grid.ts imports the duet scene group beside the others, so its TALL_SCENES joins the list gridFor reads.

## What it costs to change later

A constant: one import and one entry in a list. Undoing it is reverting those two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 names scenes/common.ts and scenes/index* for the new scene name, but not grid.ts, which grid.test.ts requires for every scene name (author).
