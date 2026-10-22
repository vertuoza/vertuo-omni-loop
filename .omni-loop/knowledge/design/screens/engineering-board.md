---
screen: engineering-board
status: draft
kind: page
mock: engineering-board.html
implements: [apps/galaxy/app/app/engineering/page.tsx, apps/galaxy/app/app/engineering/loading.tsx, apps/galaxy/src/engineering/EngineeringBoard.tsx, apps/galaxy/src/engineering/EngineeringScreen.tsx, apps/galaxy/src/engineering/engineering.css]
reads: [apps/galaxy/src/engineering/tally.ts, apps/galaxy/src/engineering/load.ts, apps/galaxy/src/timeline/, apps/galaxy/src/dashboard/board/PeriodSwitch.tsx, apps/galaxy/src/nav/AppShell.tsx]
routes: [/app/engineering]
supersedes: null
---

## Purpose

The workspace's Engineering board: how its repositories' pull requests move, how much of the work
Omni Loop signs, and, from PRD 2370, how long each step of a PRD takes across the PRDs done in the
period.

## Regions

- **The period switch** (`PeriodSwitch`), shared with the dashboard.
- **The tiles:** merged pull requests, the median time to merge, the needs-fix rate.
- **The panels:** Omni Loop, Loop health, PRs merged per day, Repositories, the top-5 lists
  (`EngineeringBoard.tsx`).
- **Time per step** (PRD 2370): one row per step of a PRD's timeline (Writing it, Approval,
  Starting, Building, Finishing, Review), its median over the PRDs done in the period and how many it
  covers, then the slowest step named.

## States

- **No PRD done in the period:** Time per step says so in a sentence, with no table.
- **A step no PRD of the period dated:** its row reads `–`, the board's word for no value.

## Words

Time per step; Step, Median, PRDs; Slowest step: <step>, median <duration>. Durations as
`durationWords` writes them (min, h, d).

## Refusals

- A step names a role, never a person's login: who was waited on by name is the bottleneck board's
  question, not this panel's.

## Open questions

- Where Time per step sits among the panels: after Loop health, or first.
- Whether a step's median links to the PRDs it covers.

## Source

- /omni:brainstorm, PRD 2370: .omni-loop/delivery/shipped/2370-prd-timeline/before-after.html
