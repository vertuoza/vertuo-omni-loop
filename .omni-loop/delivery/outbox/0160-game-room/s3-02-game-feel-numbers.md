---
id: s3-02-game-feel-numbers
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

How fast should the game be, how often do the aliens fire back, and what do the back button and the end of a game do?

## The decision, in plain words

I picked the game's speeds and difficulty myself and kept them together so they are easy to tune. The back button during play pauses instead of leaving, and the game over waits for a button before going back to the room.

## The intro, for fun

Every arcade game hides a dial that decides how mean the aliens are.

## The punchline, for fun

Ours is set to friendly but firm, and the dial sits in one place in case you disagree.

## The options, in plain words

A. Keep these numbers until a person has played a game on a laptop and on a phone, the option built.
B. Make the game harder from the first wave: a faster march and more bombs.
C. Go back to the room by itself a few seconds after the game over.

## What I had to decide

The spec sets the two fields, the shields, three lives, faster waves and the controls. It gives no speeds, no fire rate, no protection after a hit, nothing on shields between waves, and does not say what B does during play or whether the game over returns to the room by itself.

## What I did meanwhile

The numbers sit in `FIELDS` and the constants at the top of `apps/galaxy/src/arcade/games/invaders.ts`: a march step every 0.6 s with the whole formation, down to a tenth of that as it thins out, 15% faster each wave (never under 0.2 s at full strength); a bomb every 0.4 to 1.5 s, at most three in flight wide and two tall; 1.5 s of blinking after a hit; the shields rebuilt each wave. The game over shows its score for 1 s, then A, B or START returns to the room. B during play pauses, as START does.

## What it costs to change later

Low: constants in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one has played it on a phone yet: the spec's manual check (one game on a laptop, one on a phone) is still to do.
