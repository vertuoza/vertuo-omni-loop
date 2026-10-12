---
id: s1-01-duet-quitting-proofs-at-the-new-turn
prd: 1663
slice: s1
rank: high
bears-on: BR-PRODUCT-101
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The tests that prove how quitting OMNI DUET ends the game also pin how fast the orbs turn and how long the first wave lasts. Both changed, so those tests changed with them. Is that fine, the quitting rule itself being unchanged?

## The decision, in plain words

The tests now expect the slower turn and wait for the first wave to pass instead of a fixed time; every check of the quitting rule is as it was.

## The intro, for fun

The orbs learned to take their time.

## The punchline, for fun

The way out of the game stayed exactly where it was.

## The options, in plain words

A. Keep the updated tests; the quitting rule's checks are unchanged (built).
B. Keep the old turn and waves, and leave those tests as they were.

## What I had to decide

BR-PRODUCT-101 (quitting ends the run at its game over, the score sent once) is enforced by `duet/run.test.ts` and `scenes/duet.test.ts`. The range changes their expectations of the turn (0.6 turns a second) and makes the pause test wait until the first wave has passed rather than 300 frames, since chapter I's first wave now lasts about 5.5 s. Nothing that checks the law changed.

## What I did meanwhile

The branch turns at 0.6 turns a second and both test files expect it.

## What it costs to change later

A constant, `RULES.turnsPerSecond`, and the tests that pin it.

## What I could not know

- Whether 0.6 turns a second feels right: it follows the person's ask for real held rotations, but nobody has played it in the browser yet (author).
