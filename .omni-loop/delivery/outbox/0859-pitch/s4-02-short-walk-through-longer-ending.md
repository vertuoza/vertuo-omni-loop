---
id: s4-02-short-walk-through-longer-ending
prd: 859
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

A pitch video is a 3-second slide, a 10 to 15 second walk-through and a 3-second ending, which makes 16 to 21 seconds, yet the spec wants 20 to 30. How does a short video reach 20 seconds?

## The decision, in plain words

The ending card stays on screen longer until the video reaches 20 seconds; a walk-through longer than 24 seconds is cut so the video never passes 30.

## The intro, for fun

The video came up four seconds short of the length it promised.

## The punchline, for fun

So the goodbye card learnt to linger, like a guest by the door.

## The options, in plain words

A. The ending card stays longer until the video reaches 20 seconds (built).
B. The walk-through's last frame is held until the video reaches 20 seconds.
C. Videos may be shorter than 20 seconds: the cards stay at 3 seconds each.

## What I had to decide

Keep the longer ending card, or reach 20 seconds another way: hold the walk-through's last frame, slow it down, or allow videos under 20 seconds.

## What I did meanwhile

The closing card lasts max(3, 20 - 3 - walk-through) seconds; a 10-second walk-through gives a 7-second ending and a 20-second video. A walk-through past 24 seconds is cut to 24.

## What it costs to change later

One line in the recipe's cut and its tests; no stored data, no pitch already made changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec states both a 10 to 15 second walk-through with two 3-second cards and a 20 to 30 second video, which cannot both hold.
