---
id: s5-02-in-match-pitch-meter-is-the-sign-only
prd: 2101
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

During the match, should the pitch meter beside the player's paddle show the bar of the heard pitch against the limit, or only the up, still or down sign?

## The decision, in plain words

During the match only the sign is drawn beside the paddle, small, on the court; the full meter with its bar stays on the ready screen, where the player tries their voice.

## The intro, for fun

The paddle is busy, the ball is fast, and there is not much room beside it.

## The punchline, for fun

One arrow says it all, the ruler stays in the waiting room.

## The options, in plain words

A. A. The sign alone beside the paddle during the match; the bar on the ready screen only.
B. B. The sign and a thin bar beside the paddle during the match, as on the ready screen.

## What I had to decide

Keep the sign alone during the match, or ask for the bar to be drawn beside it too.

## What I did meanwhile

The match draws ▲, · or ▼ in pixels just right of the player's paddle, following it up and down.

## What it costs to change later

A few lines of drawing in the game's court (pong/art.ts) to add the bar, no change to the engine.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's pitch meter during the match names the sign and a bar; the slice's done-when names only the steering sign beside the paddle, so the bar was left out (author).
- Not yet seen with a real voice in a browser: how readable the sign is at speed is for a person to judge (author).
