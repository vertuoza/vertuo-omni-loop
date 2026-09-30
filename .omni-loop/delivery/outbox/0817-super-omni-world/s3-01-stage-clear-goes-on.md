---
id: s3-01-stage-clear-goes-on
prd: 817
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a stage is cleared, which buttons go on to the next stage, and can the player leave the game from there?

## The decision, in plain words

A or START goes on to the next stage's ready screen with the score and lives kept, and B does nothing there, so a game can only end at the game over or at the world's end, where its score is saved.

## The intro, for fun

A flag reached, a whole new stage ahead, and one button between them.

## The punchline, for fun

B stays quiet on the way, so no score slips out the back door.

## The options, in plain words

A. A or START goes on, B does nothing, as built.
B. A or START goes on, and B quits to the room without saving the score.
C. A or START goes on, and B quits to the room after saving the score reached so far.

## What I had to decide

Whether the stage clear screen only goes forward, or also lets the player quit the game.

## What I did meanwhile

The stage clear screen shows A for the next stage; the new stage appears once START is pressed on its ready screen.

## What it costs to change later

One line in the game's press rules and one hint on the screen: a different answer is a small change, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the game over and WORLD CLEAR as the only ends, and says nothing of the buttons on a stage clear (author).
