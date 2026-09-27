---
id: s3-02-enter-on-focused-controls
prd: 261
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

When a visitor presses Enter while a button or link on HOME has the focus, should that start the game?

## The decision, in plain words

Enter starts the game anywhere on HOME except on a focused button, link or field, which keeps its own meaning; a focused PRESS START still starts the game.

## The intro, for fun

Enter means start, unless it already means something else.

## The punchline, for fun

A trading card asked to flip should not launch a spaceship instead.

## The options, in plain words

A. Leave Enter to a focused control, and start the game everywhere else (built).
B. Enter always starts the game, even over a focused card or link.
C. Only PRESS START itself answers Enter, never the page as a whole.

## What I had to decide

Whether Enter should start the game even when another button or link on HOME has the focus.

## What I did meanwhile

Enter on the page body starts the game, while Enter on a focused card, link or field does what that control does.

## What it costs to change later

One rule in the HOME code; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says Enter anywhere on HOME starts the game, and also that Enter flips a focused trading card; the two meet on a focused control and the spec does not say which wins. (author)
