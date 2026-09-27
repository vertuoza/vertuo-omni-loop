---
id: s3-01-ready-screen-pauses-before-confirm
prd: 238
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

A player opens the question about leaving for the app while Entropy Invaders is still counting down to its first wave. Should the countdown pause, as a game in play does?

## The decision, in plain words

Yes: the countdown pauses too. Saying no brings the player back to the game's pause screen, and resuming picks the countdown up where it stopped.

## The intro, for fun

The aliens were still lining up when someone reached for the exit.

## The punchline, for fun

They wait politely on the pause screen until the player makes up their mind.

## The options, in plain words

A. The countdown pauses, and saying no brings back the pause screen, the option built.
B. The countdown keeps running under the question, and saying no brings back the countdown or the first wave.

## What I had to decide

Whether Entropy Invaders' ready screen (the countdown before the first wave) counts as a game in play when OPEN THE APP? opens over it.

## What I did meanwhile

pauseFirst() in src/arcade/leave.ts pauses any game that is neither paused nor over, the ready screen included, so B comes back to the pause; START then resumes the countdown with the time it had left.

## What it costs to change later

One condition in pauseFirst() in src/arcade/leave.ts, and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a game in play pauses first and that a paused or finished game is left as it is; it does not name the ready screen, which is neither.
