---
screen: star-chart
status: draft
kind: page
mock: star-chart.html
implements: [apps/galaxy/src/arcade/scenes/chart.tsx, apps/galaxy/src/arcade/scenes/chart.css]
reads: [apps/galaxy/src/arcade/scenes/chart.ts, apps/galaxy/src/arcade/scenes/chart-layout.ts, apps/galaxy/src/data/load-knowledge.ts]
routes: [/play#chart]
supersedes: null
---

## Purpose

The star chart: the repository's knowledge base drawn as suns and worlds, for the crew only. After PRD 1808 it is read when the chart is opened, not on every load of the game.

## Regions

- **The title:** `STAR CHART · <REPOSITORY>`.
- **The sky:** each sun a system of the knowledge base, its worlds around it.
- **The hint:** `◀ ▲ ▼ ▶ MOVE · A OPEN · B MENU`.

## States

- **Loading:** `LOADING…` until the chart arrives (PRD 1808); B MENU still leaves.
- **Loaded:** the chart as today.
- **Out of reach:** `THE STAR CHART IS OUT OF REACH`, with `ONLY THE CREW READS THE KNOWLEDGE BASE, AND IT COULD NOT BE READ HERE.`
- **Not in this build:** `NO STAR CHART IN THIS BUILD`.

## Words

STAR CHART · LOADING… · THE STAR CHART IS OUT OF REACH · NO STAR CHART IN THIS BUILD · A OPEN SYSTEM · B MENU

## Refusals

- Only the crew reads the knowledge base: the chart never reaches anyone else.

## Open questions

- Whether the chart, once read, should stay for the session only or across visits is not said; PRD 1808 keeps it for the session.

## Source

- /omni:brainstorm, PRD 1808: .omni-loop/delivery/shipped/1808-arcade-lazy-details/before-after.html
