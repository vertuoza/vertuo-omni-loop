---
id: s5-05-hi-without-a-name-upright
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The approved design puts the crew's best score and its holder's name in the middle of the game's top line, but a phone held upright has no room for both beside the wave and the pause hint the game already shows. What gives way?

## The decision, in plain words

On a phone held upright, the crew's best shows without the holder's name, and everything else keeps its place. On a computer and on a phone held sideways, it shows with the name in the middle, as designed, and the pause hint moves beside the score.

## The intro, for fun

The top line of a phone screen is a very small shelf.

## The punchline, for fun

The name stepped down, so the score, the best, the wave and the pause all stay on it.

## The options, in plain words

A. Show the crew's best without the name on a phone held upright: the option built.
B. Show the name and drop the pause hint on a phone held upright.
C. Show the name and drop the wave on a phone held upright, as the design draws it.

## What I had to decide

The approved design (before-after, section 4) draws HI · DIME 12 480 in the middle of the score line on both grids; its tall drawing has neither the wave nor a pause hint, which s3 added (WAVE at 96 px, [START] PAUSE at 146 px, both at the middle of the wide grid's line or near it). 320 px holds SCORE, a HI up to 9 999 999, WAVE, the pause hint and three lives only without the name.

## What I did meanwhile

`InvadersOverlay` in `apps/galaxy/src/arcade/scenes/invaders.tsx` labels the HI `HI · <name>` on the wide grid and `HI` on the tall one. `invaders.css` centres it on the wide grid and moves `.inv-foot` (the pause hint) to 112 px, beside the score; on the tall grid it lays out SCORE at 10 px, HI at 66, WAVE at 144, the pause hint at 186 and the lives 8 px from the right. HI is the top line of the crew's table as read; none shows before anyone has a score, or when the table is out of reach.

## What it costs to change later

Low: a label and a few positions in one stylesheet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3's wave and pause hint on the upright phone matter more than the holder's name the design draws there.
