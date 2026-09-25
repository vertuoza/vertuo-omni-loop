---
id: s11-02-crew-lines-upright
prd: 94
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The upright screen shows a fleet's crew on four lines, where the wide screen shows two. What should happen if a crew ever has more names than those four lines hold?

## The decision, in plain words

Names past the fourth line are cut off, as the wide screen already cuts them after its second line. The four upright lines hold at least as many names as the wide screen's two.

## The intro, for fun

Big crews are great, until everyone has to squeeze into the team photo.

## The punchline, for fun

The photographer stepped back as far as the screen allows, and not one step further.

## The options, in plain words

A. Show four lines of names and cut off the rest, as the wide screen does after two. This is what was built.
B. Shrink the names to the smallest readable size once the crew is long, so more lines fit.
C. Show the crew as a count, with the names on a page of their own that a button opens.

## What I had to decide

On the tall grid the selected fleet's crew takes the room left under HOME, PLANETS and the three stats. The wide wall caps the crew at two lines of 17 px (`max-height: 2em` with `overflow: hidden` in `scenes/fleets.css`), so a long crew is already cut there. The spec says a tall layout drops nothing, but gives no rule for a list that outgrows its panel, and ◀ ▶ belong to the fleet selection on this screen.

## What I did meanwhile

On the tall grid the crew is 16 grid px text over four whole lines (`max-height: 4em`), 280 grid px wide, running on under its label from the second line. With crews of twenty names swapped into the page, the wide wall's two lines showed 16 names and the tall four lines 17, a two-line motto above them included. Past four lines the names are cut off, whole lines only.

## What it costs to change later

Small: the line count and the text size are two values in the fleets group's styles. Paging the crew on its own would need a key of its own on this screen, in the arcade's key handling, which this slice does not own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How large the real crews get: the demo fleets have two or three members each, and nothing here counts the players of each production fleet.
