---
screen: arcade-menu
status: draft
kind: page
mock: arcade-menu.html
implements: [apps/galaxy/src/arcade/scenes/menu.tsx, apps/galaxy/src/arcade/scenes/menu.css]
reads: [apps/galaxy/src/arcade/scenes/menu.ts, apps/galaxy/src/arcade/scenes/chart.tsx, apps/galaxy/src/arcade/deep-link.ts]
routes: [/play#menu]
supersedes: null
---

## Purpose

The arcade's menu: the galaxy map, the star chart, the fleets, the heroes, the game room and the briefing, each row with a short tally. After PRD 1808 the STAR CHART row shows its tally only once the chart has been read in the session.

## Regions

- **The rows:** one per door, its label left and its tally right (`306 PLANETS`, `9 SYSTEMS · 214 WORLDS`).
- **The selected row,** highlighted; A opens it.
- **The hint:** `▲ ▼ CHOOSE · A OPEN · B BACK`.

## States

- **The STAR CHART row before the chart is read:** no tally (PRD 1808).
- **After the chart is read in the session:** its tally, as before.
- **Out of reach / not in this build:** `OUT OF REACH`, `NOT IN THIS BUILD` on the row, as today.

## Words

GALAXY MAP · STAR CHART · FLEETS · GAME ROOM · OUT OF REACH · NOT IN THIS BUILD · ▲ ▼ CHOOSE · A OPEN · B BACK

## Refusals

- The menu never reads the star chart itself (PRD 1808): its tally waits for the chart's own read.

## Open questions

- Whether an empty tally reads well beside the other rows' tallies, or the row should say something (`PRESS A`), is not decided.

## Source

- /omni:brainstorm, PRD 1808: .omni-loop/delivery/shipped/1808-arcade-lazy-details/before-after.html
