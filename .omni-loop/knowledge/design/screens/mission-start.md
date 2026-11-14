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

- **The fleet's level,** above the list: `Level: Works alone`, with `Change`.
- **One row per mission:** its goal, its status (`Draft`, `Running`, `Waiting on you`, `Paused`,
  `Delivered`, `Stopped`), its progress (`2 of 4 merged · 1 ready`) and a link to its brief.
- **What waits on a person:** each PRD that waits, with what it waits on (approve, answer, merge) and its link.
  At Works alone, only what the fleet sent back, with why (`answer s2-01, a locked law`).
- **A mission's level,** on its row; on a draft, with `Change for this mission`.
- **The branch line,** at Own branch and Works alone: the PRDs on the mission's branch, whether it is up to
  date with the default branch, and the mission pull request's link. The progress then reads
  `2 of 4 on main · 1 joined`.
- **The trust line,** at Works alone: `14 decisions by the fleet · 1 overturned`.
- **The primary action:** `Start`, on a draft. `Pause` on a running or waiting mission, `Resume` on a
  paused one.

## States

- **No mission:** `No mission yet. A mission is written with /omni:mission.`
- **Draft:** `Not started`, its level, with `Start`.
- **Reviews with you:** as before PRD 2879, with the level's name on the row and no branch line.
- **Branch behind with a conflict, or red:** the mission is `Waiting on you`, the branch line naming the
  files, or the PRD to drop.
- **Running, Waiting on you:** the progress and each PRD waiting, with `Pause`.
- **Paused:** with `Resume`.
- **Stopped:** why, and how to carry on, with no button.
- **Delivered:** every PRD merged; no button.
- **Refused or failed:** the refusal's words under the mission.

## Words

- `Start`, `Pause`, `Resume`, `Waiting on you`, `Not started`, `Level`, `Change`, `Change for this mission`,
  `Reviews with you`, `Own branch`, `Works alone`, `Branch`, `up to date`, `joined`, `decisions by the fleet`,
  `overturned`.

## Refusals

- No chart of the forecast, no hours drawn as bars.
- A mission never merges into the default branch. At Reviews with you it never answers for a person and a
  ready PRD waits for a merge; at Works alone the fleet answers in its own name, never a person's.

## Open questions

- A mission's progress counts the PRDs of its scope and those its events name; a roadmap's PRDs count once
  the supervisor has met them.
- Where `Change` and `Change for this mission` open: in place, or in a drawer.
- Where a person overturns a decision from this tab, beside the mission pull request's list.
- Whether the estimate line (`Likely ready for review <day> <time>`) ships once there is enough history.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
/omni:brainstorm, PRD 2879: .omni-loop/delivery/inbox/2879-fleet-works-alone/before-after.html
