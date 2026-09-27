---
id: s3-01-start-pause-lengths
prd: 261
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

How long should HOME wait after PRESS START or the cheat code before opening the game?

## The decision, in plain words

HOME lets the start sound ring for about half a second before opening the game, and first shows the cheat message for just under a second; muted, it opens the game at once.

## The intro, for fun

Leaving a page too fast cuts the jingle off mid-note.

## The punchline, for fun

So HOME waits half a beat, like a good drummer.

## The options, in plain words

A. Wait about half a second for the sound, and show the cheat message for just under a second first (built).
B. Open the game at once and let the sound be cut off.
C. Longer pauses, so the cheat message and the full jingle are unmistakable.

## What I had to decide

Whether the pause before the game opens should be longer, shorter, or skipped.

## What I did meanwhile

The start sound plays in full, then the game opens; the cheat message shows for just under a second before that.

## What it costs to change later

Changing either pause is one number each in the HOME code, with no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the sound plays and then the game opens, but gives no length for either pause. (author)
