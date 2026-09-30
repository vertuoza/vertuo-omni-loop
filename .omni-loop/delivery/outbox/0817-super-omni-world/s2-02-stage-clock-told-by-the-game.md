---
id: s2-02-stage-clock-told-by-the-game
prd: 817
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Who keeps the stage's 300-second clock: the game engine drawing the stage, or the scoring rules?

## The decision, in plain words

The game engine tells the rules each second of play, and the rules count the clock down, cost a life at zero and pay the time bonus; the engine starts the stage again once 300 seconds have gone.

## The intro, for fun

Somebody has to watch the clock while the hero admires the scenery.

## The punchline, for fun

The engine ticks, the rules count, and nobody argues about the time.

## The options, in plain words

A. The engine reports each second and the rules count down, as built.
B. The engine keeps the whole clock and reports only when it runs out, the rules keeping the seconds left for the bonus from it.
C. The screen around the engine keeps the clock with its own timer, and the engine reports nothing about time.

## What I had to decide

How the clock reaches the rules, beside the five things the spec says the engine reports.

## What I did meanwhile

One more report, one per second of play, joins the five; a paused game sends none, so the clock stops with it.

## What it costs to change later

A small change to the engine's side and the rules; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec lists five reports from the engine and puts the timer in the rules, without saying how time reaches them (author)
