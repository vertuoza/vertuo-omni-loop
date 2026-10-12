---
id: s1-02-duet-wave-seven-shorter-bar
prd: 1658
slice: s1
rank: high
bears-on: BR-PRODUCT-102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

At the slower turn, one wave of chapter II could no longer be dodged, so its top bar is now half as long. The files that keep every wave passable changed with it. Is that fine?

## The decision, in plain words

That wave's top bar is two cells long instead of four, and every wave, endless ones included, is still proven passable at the new speed.

## The intro, for fun

One bar was too wide for the slower orbs to slip past.

## The punchline, for fun

So it lost half its length and none of its spikes.

## The options, in plain words

A. Shorten that wave's top bar, and keep every wave passable at the slower turn (built).
B. Keep the wave as it was, and turn the orbs at their old speed instead.

## What I had to decide

BR-PRODUCT-102 (endless waves drawn from the last chapter's rows, every wave passable) is enforced by `duet/waves.ts` and `duet/waves.test.ts`. The range shortens chapter II wave 7's still bar from four cells to two in `waves.ts`, and the passability ring the test pins moves from 240 bins, 7 a step, to 48 bins, 1 a step, as the slower turn makes it. Endless waves are drawn from chapter IV's rows, which did not change.

## What I did meanwhile

The branch holds the shorter bar; the passability check passes every chapter wave and the first 200 endless waves.

## What it costs to change later

One line of a wave's text.

## What I could not know

- Whether the shorter bar keeps wave 7 as hard as it was meant to be: it was judged by the passability check, not played (author).
