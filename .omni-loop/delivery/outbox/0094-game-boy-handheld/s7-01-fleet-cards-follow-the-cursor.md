---
id: s7-01-fleet-cards-follow-the-cursor
prd: 94
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On a phone held upright, the row of fleet cards under the big mascot has room for six fleets. What should it show if there are ever more than six?

## The decision, in plain words

It shows six at a time and slides along as the player moves, so the fleet being looked at is always among them. Today's five fleets all show at once, as before.

## The intro, for fun

Five fleets fit on the little screen, with one seat left over for a newcomer.

## The punchline, for fun

The seventh fleet will have to wait in the wings until someone scrolls its way.

## The options, in plain words

A. Show six cards at most, sliding along with the player, so the one being looked at always shows. This is what was built.
B. Make the cards smaller so every fleet always fits in one row, however many there are.
C. Split the cards into pages of six that the arrows turn, with a page number under them.

## What I had to decide

The spec lets a tall layout stack or split a long list into pages, and drops nothing, but does not say how the fleet select's row of cards behaves when it is wider than the tall grid (320 px). At 44 px a card with 6 px between them, six cards fit; the demo and the fleets in the README are five.

## What I did meanwhile

`cardRow()` in `apps/galaxy/src/arcade/scenes/recruit.ts` shows every fleet on the wide grid, as before, and on the tall grid as many as fit (six), a window that keeps the fleet under the cursor in the middle when it can. The canvas draws that window and the text layer lays its card buttons over it; the big mascot, the name, the motto and the crew line always show the fleet under the cursor, and ◀ ▶ reach every fleet. `recruit.test.ts` pins it for one to twelve fleets.

## What it costs to change later

A constant: the window is one function and its test. Smaller cards are two numbers in the same table; pages are a few lines more in that function and a label in the text layer. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether more than six fleets are planned: the demo and the README list five, and nothing says how many there will be.
