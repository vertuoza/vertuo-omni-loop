---
id: s3-01-score-table-as-ready-screen
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The design shows a screen with the score table, what each alien is worth. Where should players see it, and does a game then start by itself?

## The decision, in plain words

Choosing Entropy Invaders opens the game on the score table for three seconds, then the aliens start moving. Pressing A starts at once.

## The intro, for fun

Every arcade cabinet has a card saying what each alien is worth, and almost nobody reads it.

## The punchline, for fun

So ours shows it for three seconds, right before the aliens start marching.

## The options, in plain words

A. Show the score table for three seconds before each game, A skipping it, the option built.
B. Wait on the score table until the player presses A.
C. Start at once, and show the score table only on the pause screen.

## What I had to decide

The spec says an attract screen shows the score table and that A on the unlocked cabinet starts a game. It does not say whether the table is a screen of its own, how long it shows, or whether the game waits for a press.

## What I did meanwhile

`newGame()` in `apps/galaxy/src/arcade/games/invaders.ts` opens on a ready phase (`READY_SECONDS`, 3 s) and the text layer shows the score table over the formation, read from the view's `rules.woundClose`. `press()` with A or START skips it, and B goes back to the room.

## What it costs to change later

Low: one constant for the time, and one phase of the engine to keep or drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person pictured the table as a looping attract mode on the cabinet in the room instead.
