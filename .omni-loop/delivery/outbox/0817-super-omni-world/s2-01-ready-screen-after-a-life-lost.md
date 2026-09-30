---
id: s2-01-ready-screen-after-a-life-lost
prd: 817
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When the hero loses a life and the stage starts again, should play resume at once, or wait for the player to press start?

## The decision, in plain words

The stage waits on its ready screen, showing the stage and the lives left, until the player presses start, the same screen a new game opens on.

## The intro, for fun

Falling into a pit deserves a moment of quiet reflection.

## The punchline, for fun

So the game waits politely until you are ready to try again.

## The options, in plain words

A. Wait on the ready screen after each life lost, as built.
B. Restart play at once, with no screen between the life lost and the new try.
C. Show a short pause of about two seconds, then restart play by itself.

## What I had to decide

Whether losing a life puts the stage back on its ready screen or restarts play at once.

## What I did meanwhile

A life lost shows the ready screen with the lives left; start resumes play from the stage's start, the score kept.

## What it costs to change later

One line in the game's screen handling; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec names the ready screen for the start of a game only, and says a life lost restarts the stage, not which screen shows (author)
