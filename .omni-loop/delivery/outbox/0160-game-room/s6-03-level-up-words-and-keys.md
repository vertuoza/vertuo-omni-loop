---
id: s6-03-level-up-words-and-keys
prd: 160
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The approved design shows the level-up for the first point only. What should it say at higher levels and when no game opened, and does it move on by itself?

## The decision, in plain words

Above level 1 it opens on the XP earned instead of the first point, and with no new game it offers one button to continue to the menu. It waits for a button and never moves on alone, since pressing one is what marks the level as seen.

## The intro, for fun

The party was drawn for the first point, and the later birthdays were left to imagination.

## The punchline, for fun

Later birthdays get the same cake, with the candle count written on top.

## The options, in plain words

A. Open on the XP earned above level 1, offer continue when no game opened, and wait for a button, the option built.
B. Keep the first point's line at every level, and move on to the menu after a few seconds, saving the level then.
C. Open on what the next level needs instead of the XP earned, and wait for a button.

## What I had to decide

Section 3 of the approved before/after page draws LEVEL UP! LV 1 with FIRST POINT EARNED, NEW GAME UNLOCKED, A · PLAY NOW and B · LATER. It does not draw a later level, a level that opened no game or the tall grid, nor say whether the screen hands over on a timer as the welcome back does.

## What I did meanwhile

`eyebrowOf()` in `apps/galaxy/src/arcade/levelup.ts` says FIRST POINT EARNED at LV 1 and `<xp> XP EARNED` above it. `LevelUpOverlay` shows [A] CONTINUE when no game opened, and A, START and B then all go on to the menu. The scene has no timer. On the tall grid the same pieces stack: the line, LEVEL UP!, the hero at 2x with the level beside it, the XP bar, NEW GAME UNLOCKED.

## What it costs to change later

Low: two strings and a hint in the text layer, or one timer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person pictured other words above level 1, or a hand-over to the menu on its own.
