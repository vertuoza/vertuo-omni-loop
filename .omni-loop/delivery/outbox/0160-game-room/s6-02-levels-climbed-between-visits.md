---
id: s6-02-levels-climbed-between-visits
prd: 160
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

A player can climb several levels between two visits, for example from no level to level 3. Should the level-up screen then say a new game opened, when the game opened at a level they climbed through rather than the one they reached?

## The decision, in plain words

Yes: the screen names a game when any level climbed since this device last celebrated opened it, and the player's saved record holds that game as unlocked. So the demo guest, at level 3, sees Entropy Invaders unlocked.

## The intro, for fun

Three floors up in one lift ride, and nobody mentioned the arcade on the first floor.

## The punchline, for fun

So the lift now points it out, even though you never pressed that button.

## The options, in plain words

A. Name a game opened by any level climbed since the last celebration on this device, the option built.
B. Name a game only when the exact level reached opened it, so a player who jumps past it is never told.
C. Name every game the player holds that this device never celebrated, whatever the level.

## What I had to decide

The plan says NEW GAME UNLOCKED shows only when that level opened a game, and the approved design says crossing an unlock level adds the new game. Neither says what happens when a player climbs past an unlock level between two visits, which is the demo guest's case and any returning player's.

## What I did meanwhile

`levelUpFor()` in `apps/galaxy/src/arcade/levelup.ts` names the first registry game whose unlock level (the rulebook's `xp.unlocks`) lies above the level this device last celebrated and at or below the level reached, and which the player's `player_xp.unlocked` holds. On a new device the first level-up names it once more, as the design's replayed fanfare does. Tested in `levelup.test.ts`.

## What it costs to change later

Low: one condition in one pure function, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person reads "that level" as the level reached, or as every level passed on the way.
