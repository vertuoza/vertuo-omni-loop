---
screen: fleet-frame
status: draft
kind: shared
mock: fleet-frame.html
implements: [apps/galaxy/src/dashboard/fleet/tabs.ts, apps/galaxy/src/virtual-fleets/runners/RunsOn.tsx]
reads: [apps/galaxy/src/dashboard/fleet/FleetScreen.tsx, apps/galaxy/src/dashboard/fleet/fleet.css]
routes: [/app/ai-fleet, /app/fleet]
supersedes: null
---

## Purpose

The structure every page of a fleet shares: the fleet's header and its tabs, so a person moves
between the fleet's room, its missions, its heroes and its board without leaving the fleet. It sits
inside the app shell, under the sidebar's AI Fleet entry (PRD 3233), at `/app/ai-fleet?fleet=<name>`.
On an AI fleet only: a players' fleet stays on Fleet and shows today's board, unchanged, under a
picker that lists only the players' fleets.

## Regions

- **The header:** the fleet's name, its colour and its mascot, drawn once; under it the mission line
  (its title, `<k> of <n> merged`, `<k> waits on you`) and the **Runs on** line: each runner running
  the fleet's work, with its state dot, name and slots, a Shared one marked `Shared, n job`, each
  linking to the Runners tab (PRD 3233).
- **The tabs:** Operation room · Missions · Heroes · Runners · Board · Commander, the current one marked.
- **The page area:** the tab's own screen (`fleet-room`, `mission-start`, `fleet-seats` as the Heroes
  tab, `fleet-runners` as the Runners tab, or today's fleet board). The tab is `?tab=room|missions|heroes|board`, the Operation room by
  default; a tab whose slice is not built yet says `This tab is not open yet.`

## States

- **One fleet:** the header names it; no picker.
- **Several fleets:** which fleet the person sees is an open question.

## Words

- `Operation room`, `Missions`, `Heroes`, `Runners`, `Board`, `Commander`, `Runs on`, `Shared`, `This tab is not open yet.`

## Refusals

- No colour per role and no palette of its own: the fleet's colour appears once, in the header.
- No tab named Team: the glossary keeps "team" out.

## Open questions

- The routes: whether the Operation room becomes `/app/fleet` and today's board moves to a tab,
  or each tab gets its own path.
- How a person with several fleets picks one. PRD 3233 answers it for AI fleets: the AI Fleet list.
- Whether Missions replaces the sidebar's Loop entry (the panel's view) or sits beside it.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
/omni:brainstorm, PRD 3107: .omni-loop/delivery/shipped/3107-fleet-commander/before-after.html
/omni:brainstorm, PRD 3233: .omni-loop/delivery/inbox/3233-ai-fleet/before-after.html
