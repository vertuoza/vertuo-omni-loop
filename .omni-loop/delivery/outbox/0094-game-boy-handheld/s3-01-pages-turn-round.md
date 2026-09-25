---
id: s3-01-pages-turn-round
prd: 94
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a list on the small upright screen is split into pages, what should happen when a player presses right on the last page, or left on the first?

## The decision, in plain words

Right on the last page goes back to the first, and left on the first goes to the last, the way the arcade's other lists already go round.

## The intro, for fun

Every book has a last page, but an arcade list likes to start all over again.

## The punchline, for fun

So the last page simply hands the reader back to the first one.

## The options, in plain words

A. Right on the last page goes back to the first, and left on the first goes to the last. This is what was built.
B. The pages stop at the ends: right on the last page and left on the first do nothing.
C. The pages stop at the ends, and a short buzz says there is no page further.

## What I had to decide

The plan has a tall `briefing` or `heroes` split into pages that ◀ ▶ turn, and s5 and s8 show "PAGE n/N", but nothing says what ▶ does on the last page, or ◀ on the first. s3 builds the page turning every group will use.

## What I did meanwhile

`turnPage()` in `apps/galaxy/src/arcade/grid.ts` goes round: ▶ on page N shows page 1, ◀ on page 1 shows page N, as the menu, the planet's tabs, the fleet select and the fleets wall already do. `act()` in `ArcadeApp.tsx` calls it for any scene whose group declares more than one page (`PAGES` in `scenes/<group>.ts`), with the tab sound. `grid.test.ts` pins it.

## What it costs to change later

A constant: one line in `turnPage()` (clamp instead of going round) and its three tests. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players expect a paged table to stop at its ends: no group declares pages yet, and nobody has played it.
