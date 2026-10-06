---
id: s7-02-walk-through-is-filmed-by-the-kit
prd: 1108
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

Who films the walk-through on the live product, and how does the video know where each button is?

## The decision, in plain words

The assistant writes the walk-through as a short list of steps, and the terminal plays and films it, noting where each element sits. It refuses any click on a button that saves, sends, deletes or submits.

## The intro, for fun

A camera crew on a live set, and nobody may touch the props.

## The punchline, for fun

So the camera holds the script, and it slaps away any hand that reaches for Save.

## The options, in plain words

A. The kit plays a list of steps, films it, guards every click and writes the moments (built).
B. The skill writes its own browser script and computes the moments itself, with no guard in the kit.
C. The kit plays the steps and also blocks every request that is not a read, at the network.

## What I had to decide

Whether the walk-through stays a script the skill writes and runs, or a list of steps the kit plays, films and guards.

## What I did meanwhile

A new verb, omni pitch film, plays walk.json in the repository's Chromium, refuses a click on a submit button or on words that save, send, delete or change anything (English and French), and writes walk.webm and moments.json with each element's box and the camera that shows it. The clip is a VP8 WebM with a keyframe every half second, not an MP4: the Chromium Playwright ships plays no H.264, and the render draws the clip in it.

## What it costs to change later

One verb and one module: the skill could go back to writing its own script by changing one step, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the walk-through writes moments.json but not who plays it; the word list the guard refuses is a best guess for English and French screens.
