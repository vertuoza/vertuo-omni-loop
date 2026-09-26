---
id: s4-01-levels-shows-the-first-five-levels
prd: 160
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The design says How to play shows how many XP each level needs, but not how much of that list. Levels run up to 99, far more than a Game Boy screen can hold: which ones should the page show?

## The decision, in plain words

The page shows the XP needed for the first five levels and says how high levels go, beside what each kind of point is worth and the level each game opens at.

## The intro, for fun

A staircase with ninety-nine steps is lovely, until you have to draw every step on a Game Boy.

## The punchline, for fun

So we drew the first five and hung a sign saying how high it goes.

## The options, in plain words

A. Show the XP for the first five levels, and say how high levels go.
B. Show every level up to the top one, over as many pages as it takes.
C. Show the rule as a sentence instead of a list of levels.

## What I had to decide

The spec (The arcade, How to play) and the plan's s4 done-when ask for a LEVELS section with "the weighted credits, the curve's first levels and each game's unlock level, all read from the rules", its own page on the tall grid and laid out on the wide one. Neither says how many of the curve's levels to show, how a weight of 0 reads, or how a third section fits the wide page beside EARN and ENTROPY. The cap is 99, so the whole curve cannot fit the tall grid's 320×288 page.

## What I did meanwhile

`BriefingOverlay` in `apps/galaxy/src/arcade/scenes/menu.tsx` gains a `levels` section, a third entry in `BRIEFING_PAGES` (`scenes/menu.ts`): its own page on the tall grid, across both columns under EARN and ENTROPY on the wide one. XP PER POINT lists the five weights as `×n` (a weight of 0 reads NOT COUNTED); XP TO REACH lists LV 1 to LV 5 (`CURVE_SHOWN`, fewer under a lower cap) through `xpForLevel()`; UNLOCKS lists each game in `xp.unlocks`, lowest level first, by its registry title; a note says UP TO LV 99. Every number comes from `view.rules.xp`, which `buildGalaxy()` now fills with the rulebook's `xp` block. To fit, the wide page's gaps are a few pixels tighter. `menu.test.ts` changes the rules and sees the new values.

## What it costs to change later

Low. Showing more or fewer levels is one constant, and each wording is one line. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players would rather read the rule itself (25 × n × (n − 1) XP) than the first five levels.
- (author) Whether ENTROPY CLEARED, EXPEDITION BONUS and CLOSER BONUS are the names players know: the closer bonus was not on How to play before.
