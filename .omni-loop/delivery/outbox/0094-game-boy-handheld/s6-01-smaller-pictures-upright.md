---
id: s6-01-smaller-pictures-upright
prd: 94
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On the phone held upright, the GitHub screen and the intro no longer have room for their big pictures and all their words at once. What should give way?

## The decision, in plain words

The pictures shrink to half their size on those two screens, the player's hero on the GitHub screen and the five fleets of the intro, so every word stays on one screen.

## The intro, for fun

The heroes were asked to squeeze into a smaller screen, and they took it with good grace.

## The punchline, for fun

They are half the size now, and not one of them has complained about it yet.

## The options, in plain words

A. The pictures on those two screens shrink to half size, and every word fits on one screen. This is what was built.
B. The pictures keep their full size, and the GitHub screen's words sit over the lower half of the hero.
C. The pictures keep their full size, and the GitHub screen's words are split into two pages the arrows turn.

## What I had to decide

The spec lets a tall layout rearrange a scene (stack what sits side by side, or split a list into pages) but drop nothing, and it does not say how big the pictures stay. On the wide grid the link scene shows the hero at 2× beside a panel of six lines, and the intro shows OMNI-MAN at 2× with five fleets at 2× in a row of 128 px columns. At 320×288 the link panel alone needs the full width and about 190 of the 288 rows, and five 64 px mascots with their names do not fit side by side in 320 px.

## What I did meanwhile

In `apps/galaxy/src/arcade/scenes/join.ts`, the tall stage draws the link scene's hero and fleet mascot at 1× on a small pedestal above the panel (the panel starts at row 68), and the intro's five fleets at 1× in a zigzag, every other one 16 px lower, with their names under them (join.css), so a fleet name of up to 12 letters never touches its neighbour. OMNI-MAN in the intro, the ready hero, the welcome hero and their mascots keep 2×. The wide grid is untouched: the wide stage holds the numbers the scenes always used, and the wide screenshots are byte-identical.

## What it costs to change later

A constant: the `scale` and positions in the tall stage of `join.ts` and the matching `top` values in `join.css`. Option B is the same two files plus the link panel's layout; option C adds a page count for the link scene to the group's `PAGES`, which the arcade already turns with ◀ ▶.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players find a half-size hero on the GitHub screen too small to recognise: nobody has played it on a phone yet.
