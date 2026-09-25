---
id: s8-01-how-to-play-keeps-the-wide-rules
prd: 94
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The game hands the How to play screen three rules it has never shown: the bonus for helping clear a planet you did not work on, how soon a planet calls for help, and how much bigger planets pay. Should the upright Game Boy's How to play show them?

## The decision, in plain words

No: the upright screen shows exactly the rules the computer screen shows, split over two pages, so both say the same thing. The three rules stay unshown on both, as today.

## The intro, for fun

Every rulebook has a few pages at the back that nobody has ever turned to.

## The punchline, for fun

The pocket edition kept the same pages, and left the back ones where they were.

## The options, in plain words

A. Show on the upright screen exactly the rules the computer screen shows, and leave the three unshown on both. This is what was built.
B. Add the three rules to How to play on both screens, the computer's and the upright Game Boy's.
C. Add the three rules to the upright Game Boy's How to play only, where its first page has room.

## What I had to decide

The plan asks that How to play on the tall grid show every rule `game/rulebook.mjs` gives it, and the spec that a tall layout show the same information as the wide one. The rules the galaxy hands the screen (`view.rules`) hold three that the wide `BriefingOverlay` never shows: `terraformCloser` (+25 for a closer who was not on the expedition), `distressAfterHours` (8 working hours) and `classMultipliers` (1, 1.5, 2, 2.5; the wide page says only "× CLASS", and the planet screen shows a planet's own). Showing them only on the tall grid would make the two layouts differ, and the wide layouts must stay unchanged in this slice.

## What I did meanwhile

The tall How to play shows exactly what the wide one shows: EARN on page 1 (four ways to score and the night and cross-fleet multipliers) and ENTROPY on page 2 (the six kinds with what clearing each earns and what it costs, the decay period and when a planet is lost). `menu.test.ts` holds that every run of text on the wide page is on one of the tall pages. The three rules above stay on neither page.

## What it costs to change later

A constant: three list lines in `BriefingOverlay` in `apps/galaxy/src/arcade/scenes/menu.tsx`, on both grids or on the tall one only. On the tall grid the EARN page has room for them; on the wide grid the EARN panel would grow by about three rows. No data, no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether "every rule the rulebook gives it" in the plan meant every rule the screen is handed or every rule it shows today: the plan does not say, and the spec's same-information rule points to the second.
