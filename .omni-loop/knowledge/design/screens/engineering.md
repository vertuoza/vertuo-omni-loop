---
screen: engineering
status: draft
kind: page
mock: engineering.html
implements: ["apps/galaxy/app/app/engineering/page.tsx", "apps/galaxy/app/app/engineering/loading.tsx", "apps/galaxy/app/app/engineering/[owner]/[repo]/page.tsx", "apps/galaxy/app/app/engineering/[owner]/[repo]/loading.tsx", apps/galaxy/src/engineering/EngineeringScreen.tsx, apps/galaxy/src/engineering/EngineeringBoard.tsx, apps/galaxy/src/engineering/engineering.css]
reads: [apps/galaxy/src/engineering/load.ts, apps/galaxy/src/engineering/tally.ts, apps/galaxy/src/engineering/faced.ts, apps/galaxy/src/engineering/demo.ts, apps/galaxy/src/nav/AppShell.tsx]
routes: [/app/engineering, /app/engineering/<owner>/<repo>]
supersedes: null
---

## Purpose

The workspace's pull requests over its tracked repositories, for every member: opened, merged, open
now, time to merge, who opens, merges and reviews the most, Omni Loop's share, and Loop health. From
PRD 2410, Loop health also says how many PRDs broke main in the period. A repository's page is the
same screen narrowed to that repository.

## Regions

- **Totals:** PRs opened, PRs merged, Open now, Median time to merge, Commits, Lines +/−.
- **Omni Loop:** its share of the pull requests.
- **Loop health:** Right now (stuck, held and stale-claim pull requests), then In the period (the
  slices that needed a fix and, from PRD 2410, `<k> of <m> PRDs broke main · <p>%`, the PRDs still
  watched counted apart, and the list of those that broke, each linking its PRD page with what broke).
- **PRs merged per day**, **Repositories**, and the three lists of people.

## States

- Signed out: the sign-in card. In no workspace: the notice with a way to switch. No database: the
  board is not open here. No tracked repository: the empty state.
- Loop health with no PRD finished its watch in the period: the broke-main line is left out (PRD
  2410 does not say what it shows then: see Open questions).

## Words

Loop health, Right now, In the period, Nothing stuck right now; from PRD 2410: `PRDs broke main`,
`still watched`, and per listed PRD what broke: CI red, reverted, regression.

## Refusals

- Names PRDs, never people, for what broke main.

## Open questions

- What the broke-main line says when no PRD finished its watch in the period.
- Whether the share belongs in Totals as a tile rather than in Loop health.

## Source

- /omni:brainstorm, PRD 2410: .omni-loop/delivery/inbox/2410-broke-main/before-after.html
- apps/galaxy/src/engineering/EngineeringBoard.tsx
