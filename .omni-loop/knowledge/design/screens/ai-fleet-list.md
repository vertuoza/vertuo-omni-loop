---
screen: ai-fleet-list
status: draft
kind: page
mock: ai-fleet-list.html
implements: [apps/galaxy/app/app/ai-fleet/page.tsx, apps/galaxy/src/virtual-fleets/list/AiFleetList.tsx, apps/galaxy/src/virtual-fleets/list/ai-fleet-list.css]
reads: [apps/galaxy/src/virtual-fleets/runners/runners-view.ts, apps/galaxy/src/runners/runners.service.ts, apps/galaxy/src/virtual-fleets/drawer/NewVirtualFleet.tsx, apps/galaxy/src/people/FleetChip.tsx, apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/sidebar.ts]
routes: [/app/ai-fleet]
supersedes: null
---

## Purpose

The list of the workspace's AI fleets, opened by the sidebar's AI Fleet entry: what each fleet is
doing, what waits on the viewer, and which runners run its work, without opening Fleet or Runners.

## Regions

- **The head:** the title `AI Fleet`, the line `<k> of <n> fleets wait on you`, and `New AI fleet`, the
  page's one primary action, opening today's New virtual fleet drawer.
- **The table,** one row per AI fleet: AI fleet (mascot and name in its colour, its heroes' roles) ·
  Mission (title, progress bar, `3 of 6 merged · 2 ready`, or `Goal only: PM writing PRDs`, or
  `No mission yet.`) · Waits on you (`1 answer`, `1 approval`, filled; or `Nothing`) · Runs on (each
  runner with its state dot, name and slots, Shared ones marked `Shared`, and one warning line) ·
  Open.
- **The foot:** `Players' fleets: Fleet`, linked.

## States

- **2.A, fleets:** the table as above, on a mission, goal only, without a mission, with no runner of
  its own, with its only runner offline.
- **2.B, no AI fleet yet:** `No AI fleet yet.`, the button, and the link to Settings › Fleets for a
  players' fleet.

## Words

`AI Fleet` · `New AI fleet` · `<k> of <n> fleets wait on you` · `AI fleet` · `Mission` · `Waits on you` ·
`Runs on` · `Open` · `Shared` · `Nothing` · `No mission yet.` · `Goal only: PM writing PRDs` ·
`No runner of its own` · `Its only runner is offline` · `Players' fleets:` · `No AI fleet yet.`

## Refusals

- No season place or rank: they belong to the players' fleets.
- No badge on the sidebar entry: Inbox and Runners already count what waits.
- No word "Virtual Fleet": the glossary avoids it.
- The fleet's colour appears once per row, on its name.

## Open questions

- The order of the rows: by what waits on the viewer first, then by name, as drawn? The spec does
  not settle it.
- Whether a row whose only runner is offline also shows on the Inbox.

## Source

/omni:brainstorm, PRD 3233: .omni-loop/delivery/shipped/3233-ai-fleet/before-after.html
