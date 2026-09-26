---
id: s5-03-game-over-keys
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

When a game ends, the score is now saved, and a save that fails can be tried once more. Which buttons do what on that end screen, and what does it say while the score is being saved?

## The decision, in plain words

A tries a failed save once more and the other button goes back to the game room, as A does once the score is saved or the second try has failed too. The screen says the score is saving, then shows a new best, the player's best so far, or that the score was not saved.

## The intro, for fun

The end screen used to have one job: send you back to the game room.

## The punchline, for fun

Now it also posts your score to the crew, and gets one second try when the post office is shut.

## The options, in plain words

A. A tries a failed save once more, the other button goes back to the room, and the screen says saving, new best, your best, or not saved: the option built.
B. Try a failed save once more by itself a moment later, and keep A for going back to the room.
C. Show only what the spec names, a new best or a score not saved, and nothing while saving or when the score is not a best.

## What I had to decide

The spec (Entropy Invaders, Lives and game over) says game over sends the score once through submit_score(), shows NEW BEST when it is one, and on a failed send shows SCORE NOT SAVED with A retrying once. s3 left A, B and START all going back to the room once the score has shown for OVER_SECONDS (item s3-02-game-feel-numbers). The spec does not say what B and START do while a retry is offered, what shows while the score is on its way, what shows when a saved score is not a best, or whether a tie or a first game of 0 is a NEW BEST.

## What I did meanwhile

`overPress()` in `apps/galaxy/src/arcade/scenes/invaders-score.ts`: once the score has shown for OVER_SECONDS, A retries a send that failed while its one retry is left (`SEND_TRIES` = 2); every other press goes to the engine's `press()` unchanged, so B and START go back to the room, and A too once the score is saved, still sending, or its retry spent. The game over shows SAVING SCORE… while sending; NEW BEST (blinking, still under reduced motion) when the stored best is the score and beats the player's best before it, none counting as 0, so a tie or a first game of 0 is not one; YOUR BEST n otherwise; and SCORE NOT SAVED with [A] RETRY [B] GAME ROOM, then [A] GAME ROOM once the retry has failed. `ArcadeApp.tsx` sends the score when the canvas loop first sees the game over, once per game, 0 included; a game left from the pause sends nothing.

## What it costs to change later

Low: one pure function and the text layer's lines; no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one has played a failed save on a phone: it was checked in the demo, in a browser whose guest was removed from storage mid-game.
