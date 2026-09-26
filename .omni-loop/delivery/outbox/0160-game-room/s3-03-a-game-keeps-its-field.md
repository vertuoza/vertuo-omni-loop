---
id: s3-03-a-game-keeps-its-field
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

If a player turns their phone in the middle of a game, the screen changes shape. Should the game restart on the new screen, or carry on as it was?

## The decision, in plain words

The game carries on as it was: it keeps the field it started on, shown smaller with bars around it, until it ends. The next game uses the new screen.

## The intro, for fun

Turning the phone mid-game is the pocket version of tilting the arcade cabinet.

## The punchline, for fun

Nothing is lost: the aliens stay right where they were, just framed a little smaller.

## The options, in plain words

A. Keep the game's field and letterbox it, the option built.
B. Pause the game and ask the player to turn the phone back.
C. Restart the game on the new field.

## What I had to decide

The wide field has ten columns and four shields, the tall one six and three. The spec gives both but not what happens to a game when the phone turns from one to the other; the arcade's rule elsewhere is that turning the phone never changes the game's state.

## What I did meanwhile

`ArcadeApp.tsx` draws the invaders scene on the grid its game was laid out for (`GAME_GRID[hud.layout]`), so a game begun upright is letterboxed when the phone turns sideways, and the other way round. A new game takes the grid of the moment.

## What it costs to change later

Low: one line picks the grid.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a letterboxed field is still comfortable to play on a small phone held sideways.
