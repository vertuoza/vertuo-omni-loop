---
id: s11-01-more-fleets-than-fit-upright
prd: 94
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The upright screen has room for five fleet cards side by side. If more fleets fly one day, how should the fleets wall show them?

## The decision, in plain words

Beyond five, the cards are split into pages of even size, and the wall shows the page of the fleet being looked at, with a small page count in the corner. Moving from fleet to fleet turns the page by itself.

## The intro, for fun

Five fleets fit on the upright wall like five friends on a sofa.

## The punchline, for fun

A sixth one waits on the next page, and gets the sofa when its turn comes.

## The options, in plain words

A. Split the cards into even pages of five at most, and show the page of the fleet being looked at, with a small page count. This is what was built.
B. Keep one row, and make the cards narrower as fleets are added, down to a size that still reads.
C. Show only the fleet being looked at and its two neighbours, sliding along as the player moves.

## What I had to decide

The tall grid is 320 grid px wide: five cards of 58 px fit across it. The wide wall shows every card in one row, and has room for about five. The spec lets a tall layout split a long list into pages the D-pad turns, but on `fleets` ◀ ▶ ▲ ▼ and SELECT already move the selection (`act()` in `ArcadeApp.tsx`, outside this slice), so the cards cannot have page keys of their own.

## What I did meanwhile

`cardsShown()` in `apps/galaxy/src/arcade/scenes/fleets.ts`: on the tall grid with more than five fleets, pages of at most five cards, as even as they go (six fleets: 3 + 3; seven: 4 + 3), and the page shown is the one that holds the selected fleet, so moving the selection turns the page. `scenes/fleets.tsx` shows `n/N` at 8 grid px in the top-right corner, beside the heading, when there is more than one page. The wide wall is unchanged. `scenes/fleets.test.ts` pins it. The demo galaxy and the README's fleets are five, so no player sees a page today.

## What it costs to change later

A constant: the page size and the page rule in `cardsShown()` and its tests, and one line of the text layer for the marker. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether more than five fleets are planned: the README lists five, and the wide wall itself has room for about five cards in its row.
