---
id: s3-01-last-life-ends-on-a-plain-line
prd: 1633
slice: s3
rank: high
bears-on: P-PRODUCT-54
raised: 2026-10-11
wave: 3
---

## The question, in plain words

This part of the game had to say what happens when the last life is lost, but the full game over screen and saving the score belong to the next part. What should the game do in between?

## The decision, in plain words

The game ends on a plain GAME OVER line with the score, A to play again and B to go back to the room. The score is not saved yet: the next part adds the full screen and the save.

## The intro, for fun

Three lives, one ending, and the ending was booked for next week.

## The punchline, for fun

So the game says goodbye politely and promises a proper farewell soon.

## The options, in plain words

A. End the run on a plain GAME OVER line with the score, A to play again, B to the room, and leave the save to slice 4
B. Restart chapter I with three lives after the last hit, with no game over at all until slice 4
C. Stay on the ready screen with no lives left until slice 4

## What I had to decide

Keep A: the last life lost moves the run to its over phase, which shows GAME OVER and the score, A plays again from chapter I with three lives and score 0, and B goes back to the room. Slice 4 replaces the line with the full game over screen and sends the score reached once, on the move into over.

## What I did meanwhile

Built as A: duet/run.ts adds the `over` phase (the last hit moves there, nothing moves, A gives a new run, B leaves); scenes/duet.tsx shows GAME OVER, the score and the two hints; scenes/duet.test.ts and duet/run.test.ts pin it.

## What it costs to change later

A constant: the over phase stays, and slice 4 adds the send on entering it and widens its screen. Undoing it is a few lines in run.ts and duet.tsx.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the last life lost and the game over screen to slice 4, but says nothing of what slice 3 does when a third hit lands (author).
- Until slice 4 merges, B on a ready screen after a life lost and B on the game over line both go back to the room without saving the score; P-PRODUCT-54 holds only once slice 4 is in (author).
