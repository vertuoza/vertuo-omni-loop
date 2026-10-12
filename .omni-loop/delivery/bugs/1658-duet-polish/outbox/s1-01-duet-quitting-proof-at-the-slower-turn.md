---
id: s1-01-duet-quitting-proof-at-the-slower-turn
prd: 1658
slice: s1
rank: high
bears-on: BR-PRODUCT-101
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The test file that proves how quitting OMNI DUET ends the game also pins how fast the orbs turn. Turning is now slower, so its numbers changed. Is that fine, the quitting rule itself being untouched?

## The decision, in plain words

The speed numbers in that file now say the new, slower turn; every check of the quitting rule is as it was.

## The intro, for fun

The orbs took a deep breath and slowed down.

## The punchline, for fun

The rule about leaving the game did not even notice.

## The options, in plain words

A. Keep the new speed numbers in that file; the quitting rule's checks are unchanged (built).
B. Keep the old turning speed, and leave the file as it was.

## What I had to decide

BR-PRODUCT-101 (quitting ends the run at its game over, the score sent once) is enforced by `duet/run.test.ts`. The range changes that file's expectations of the turn from 1.75 to 1.25 turns a second, and nothing that checks the law.

## What I did meanwhile

The branch turns the pair at 1.25 turns a second, and `run.test.ts` expects that speed.

## What it costs to change later

A constant: `RULES.turnsPerSecond` and the numbers that pin it.

## What I could not know

- The person asked for "a little slower"; 1.25 turns a second is the agent's pick of how much, not tried in the browser (author).
