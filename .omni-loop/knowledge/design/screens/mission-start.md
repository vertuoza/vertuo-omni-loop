---
screen: mission-start
status: draft
kind: page
mock: mission-start.html
implements: [apps/galaxy/src/missions/page/MissionsTab.tsx, apps/galaxy/src/missions/page/missions-tab.ts, apps/galaxy/src/missions/page/missions-tab.css]
reads: [apps/galaxy/src/missions/missions.contract.ts, apps/galaxy/src/dashboard/fleet/FleetScreen.tsx]
routes: [/app/fleet]
supersedes: null
---

## Purpose

The fleet's Missions tab: every mission of the Virtual Fleet, where it stands and what waits on a person.
A person starts a draft, pauses a running mission and resumes a paused one; the fleet keeps going on its
runners while the laptop is closed.

## Regions

- **One row per mission:** its goal, its status (`Draft`, `Running`, `Waiting on you`, `Paused`,
  `Delivered`, `Stopped`), its progress (`2 of 4 merged · 1 ready`) and a link to its brief.
- **What waits on a person:** each PRD that waits, with what it waits on (approve, answer, merge) and its link.
- **The primary action:** `Start`, on a draft. `Pause` on a running or waiting mission, `Resume` on a
  paused one.

## States

- **No mission:** `No mission yet. A mission is written with /omni:mission.`
- **Draft:** `Not started`, with `Start`.
- **Running, Waiting on you:** the progress and each PRD waiting, with `Pause`.
- **Paused:** with `Resume`.
- **Stopped:** why, and how to carry on, with no button.
- **Delivered:** every PRD merged; no button.
- **Refused or failed:** the refusal's words under the mission.

## Words

- `Start`, `Pause`, `Resume`, `Waiting on you`, `Not started`.

## Refusals

- No chart of the forecast, no hours drawn as bars.
- A mission never merges and never answers for a person: a ready PRD waits for a merge.

## Open questions

- A mission's progress counts the PRDs of its scope and those its events name; a roadmap's PRDs count once
  the supervisor has met them.
- Whether the estimate line (`Likely ready for review <day> <time>`) ships once there is enough history.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
