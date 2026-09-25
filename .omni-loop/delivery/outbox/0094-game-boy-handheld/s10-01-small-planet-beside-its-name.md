---
id: s10-01-small-planet-beside-its-name
prd: 94
slice: s10
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On the small upright screen, the planet's screen must show the planet and all four tabs of its details, and the left and right buttons already switch the tabs. How should it all fit?

## The decision, in plain words

The planet is drawn small in the top right corner, beside its name, and the details run across the rest of the screen, so every tab fits on one screen with no pages to turn.

## The intro, for fun

A planet the size of a postage stamp still has a whole crew flying around it.

## The punchline, for fun

They just fly a little closer together than they used to.

## The options, in plain words

A. A small planet in the top corner beside its name, the details across the screen below it, every tab on one screen. This is what was built.
B. A large planet at the top and the details below it, with the longer tabs split into pages that the A button turns.
C. The planet alone on a tab of its own, and each tab of details using the whole screen.

## What I had to decide

The plan asks for the planet with its Entropy in orbit and its fleets on station, and all four tabs, on 320×288, dropping nothing. The spec allows stacking, or pages the D-pad turns, but on `planet` ◀ ▶ already switch the tabs (`act()` in `ArcadeApp.tsx`, outside s10's territory), so no key is free to turn pages. The status tab alone takes up to eleven lines at the smallest type the spec allows, which leaves the planet a band 78 grid px tall.

## What I did meanwhile

`planetStage(TALL)` in `apps/galaxy/src/arcade/scenes/planet.ts` draws the planet at radius 26 (92 on the wide grid) at (260, 39), with the Entropy on a 40×8 orbit and the fleets on a 44×13 station, all inside x 200–320 and y 0–78 (`TALL_BAND`); `planet.test.ts` holds every sprite there over a whole orbit, with a hero stand-in among five fleets, and pins the wide stage as it was. The header (number, state, a title of up to three lines) and the caption take the band's left, and the panel runs 308 px across under it. On the status tab CAPTAIN and FLEET share a line and the value column is wider than the wide grid's, so long values (expedition, distress) are cut later than on the wide grid, and log lines too (292 px at 16 px, against 276). A zone tile shows its icon beside its id. A synthetic worst case (eleven status rows with four regions, four phases with eight zones in one, six Entropy units and the count of the rest, a three-line title) fits every tab.

## What it costs to change later

A few constants in `planetStage()` and the tall rules of `planet.css`. Option B needs `act()` in `ArcadeApp.tsx` to turn a tab's pages with A (which today also switches tabs) and a page count for `planet`; option C changes `PLANET_TABS`, which the wide layout shares. No data and no stored shape move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a planet 52 grid px across, with its fleets close around it, reads well on a real phone: seen only in Chromium at 393×700.
