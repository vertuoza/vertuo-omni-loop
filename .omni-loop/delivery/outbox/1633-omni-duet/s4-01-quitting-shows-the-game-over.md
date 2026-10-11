---
id: s4-01-quitting-shows-the-game-over
prd: 1633
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

The controls say that quitting from the pause, or pressing B on a ready screen after a life lost, goes back to the game room, but the stories say the player sees their score saved whichever way they leave. Where should these two ways out land?

## The decision, in plain words

Both now end the game on the game over screen, which shows the score being saved, then the best or the failure with a retry; B from there goes back to the game room. The pause screen labels its quit key END GAME, and so does the ready screen once play has started.

## The intro, for fun

Two doors out of the game, and the plan drew them opening straight onto the corridor.

## The punchline, for fun

We put a little lobby in between, where the score signs the guest book.

## The options, in plain words

A. A. Both ways out end on the game over screen, which shows the save; B from there goes to the room
B. B. Both go straight to the game room, the score still sent once but its save not shown

## What I had to decide

Keep A: quitting from the pause and B on a later ready screen both move the run to its game over, which sends the score once and shows its save, as losing the last life does. One more press of B reaches the room. B would go straight to the room while the score is still sent, so the player never sees whether it was saved.

## What I did meanwhile

Built as A: apps/galaxy/src/arcade/duet/run.ts moves the run into over on SELECT on the pause and on B on a ready screen once started; scenes/duet.tsx shows the game over with the send line and labels both keys END GAME; scenes/duet.test.ts and duet/run.test.ts pin each route and the single send.

## What it costs to change later

A constant: one branch in the scene's press handling would send the score and leave for the room instead. Undoing it is a few lines in duet.live.ts and duet.tsx.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's controls table says SELECT on the pause quits to the room and B goes back to the room, while user story 6 and acceptance criterion 7 say the player sees the save on every route; the spec does not say which wins.
