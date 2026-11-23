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
- **The fleet's daily cap** (PRD 3040), under the level: `Tokens per day: No daily cap`, or `1.3M of 2M`, with `Change` for an owner.
- **The New mission box** (PRD omni-loop-24), under the daily cap: one field, `New mission`, and one button, `Start`, with the hint
  `Back as one pull request.` Pressing `Start` saves the goal as typed and a runner writes the mission at Works alone. A member
  who is not an owner, on a fleet below Works alone, sees `Start` disabled and `Works alone only. Ask an owner.` below the box.
- **A request not yet pushed,** first in the list: its goal and `Writing the mission`.
- **One row per mission:** its goal, its status (`Draft`, `Running`, `Waiting on you`, `Paused`,
  `Delivered`, `Stopped`), its progress (`2 of 4 merged · 1 ready`) and a link to its brief.
- **What waits on a person:** each PRD that waits, with what it waits on (approve, answer, merge) and its link.
  At Works alone, only what the fleet sent back, under the heading `Waiting on you`, with why (`answer s2-01, a locked law`).
  What the fleet decided is on the mission pull request, in two lists (`Approved by the fleet`, `Answered by the fleet`); a person overturns one
  there or with `omni mission overturn <mission> <decision>`.
- **A mission's level,** on its row; on a draft, with `Change for this mission`.
- **The branch line,** at Own branch and Works alone: the PRDs on the mission's branch, whether it is up to
  date with the default branch (`up to date`, or `behind the default branch` with what the supervisor
  said, or the PRD to drop when the branch is red), and the mission pull request's link. The progress then
  reads `2 of 4 on main · 1 joined`. A mission at Reviews with you, and a draft, show no branch line.
- **The budget line** (PRD 3040), on each row: `412k of 2M tokens`, or `No token budget`; on a draft, set for this mission.
- **Retros** (PRD 3065), under a delivered roadmap or mission: one card per milestone retro, `Roadmap #<n> delivered` or
  `Mission delivered`, with `Went well` and `To change`, each sentence citing what it rests on, and a link to its file on the
  mission branch (at Reviews with you, `Kept on this page only`).
- **Questions** (PRD 3065): one card per mission item, a proposed change to a rule, a law or a playbook form, with its
  wording and evidence, and `Adopt` or `Decline`; once answered, who answered and how to apply it (`Not applied yet`).
- **The trust line,** at Works alone: `14 decisions by the fleet · 1 overturned`.
- **The primary action:** `Start`, on a draft. `Pause` on a running or waiting mission, `Resume` on a
  paused one.

## States

- **No mission:** the New mission box, then `No mission yet.`
- **New mission refused:** `Start` disabled with `Works alone only. Ask an owner.`; a repository on phase 0 pull request, or any other
  refusal, is said under the box in its own words (`A goal-only mission needs phase 0 on the server.`).
- **Writing the mission:** a request whose mission is not pushed yet; its goal and `Writing the mission`, no button.
- **Writing the roadmap:** a goal-only mission running with no PRD yet: `Running`, `Writing the roadmap`, with `Pause`.
- **No PRD written:** the PM wrote no PRD twice: `Waiting on you`, `No PRD written` and a `Why` link to the mission's brief, which
  holds the PM's reason (`the PM wrote no PRD for the goal: <why>`), with `Resume`, which sends the PM's roadmap once more (#3203);
  never `Delivered`.
- **Draft:** `Not started`, its level, with `Start`.
- **Reviews with you:** as before PRD 2896, with the level's name on the row and no branch line.
- **Branch behind with a conflict, or red:** the mission is `Waiting on you`, the branch line naming the
  files, or the PRD to drop.
- **Running, Waiting on you:** the progress and each PRD waiting, with `Pause`.
- **Paused:** with `Resume`.
- **Paused: budget reached** (PRD 3040): what was spent and whose cap (`this mission's budget`, `this fleet's daily cap`), with `Raise the cap` and `Stop the mission`; the fleet's cap adds one notice above the list with `Resume tomorrow` and `Raise the cap`, asked once for the fleet.
- **Stuck** (PRD 3065): `Stuck: 5 jobs, nothing moved`, `Repairing (1 of 3) · 7 left in this mission`, the cause and the fix PR, with `Pause`.
- **Paused: stuck** (PRD 3065): the cause, the repairs tried, the proposed fix, `Each cause gets 3 more · 6 of 9 left`, with `Resume` and `Stop the mission`, asked once.
- **Stopped:** why, and how to carry on, with no button.
- **Delivered:** every PRD merged; no button.
- **Refused or failed:** the refusal's words under the mission.

## Words

- `New mission`, `Back as one pull request.`, `Works alone only. Ask an owner.`, `No mission yet.`, `Writing the mission`,
  `Writing the roadmap`, `No PRD written`, `Why`,
  `Start`, `Pause`, `Resume`, `Waiting on you`, `Not started`, `Level`, `Change`, `Change for this mission`,
  `Reviews with you`, `Own branch`, `Works alone`, `Branch`, `up to date`, `behind the default branch`,
  `Mission pull request`, `on main`, `joined`, `decisions by the fleet`,
  `overturned`, `Stuck`, `nothing moved`, `Retros`, `Went well`, `To change`, `Questions`, `Adopt`, `Decline`,
  `Not applied yet`, `Kept on this page only`.

## Refusals

- No chart of the forecast, no hours drawn as bars.
- A mission never merges into the default branch. At Reviews with you it never answers for a person and a
  ready PRD waits for a merge; at Works alone the fleet answers in its own name, never a person's.

## Open questions

- A mission's progress counts the PRDs of its scope and those its events name; a roadmap's PRDs count once
  the supervisor has met them.
- Where `Change` and `Change for this mission` open: in place, or in a drawer.
- Where a person overturns a decision from this tab, beside the mission pull request's list.
- Where a long retro or a long item wording folds, past five sentences.
- Whether the estimate line (`Likely ready for review <day> <time>`) ships once there is enough history.

- Whether a mission waiting on `No PRD written` offers `Resume` (the omni-loop-24 after draws it) or `Pause`, the only move a waiting
  mission allows today.
- How long a request whose mission never got pushed stays listed as `Writing the mission`.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
/omni:brainstorm, PRD 2896: .omni-loop/delivery/shipped/2896-fleet-alone/before-after.html
/omni:brainstorm, PRD 3040: .omni-loop/delivery/shipped/3040-token-budget/before-after.html (the caps, the budget line, Paused: budget reached)
/omni:brainstorm, PRD 3065: .omni-loop/delivery/shipped/3065-mission-retros/before-after.html (Stuck, Paused: stuck, Retros, Questions)
/omni:brainstorm, PRD omni-loop-24: the dossier on the Omni page, `omni dossier get omni-loop-24 before-after` (the New mission box, Writing the roadmap, No PRD written; screens 1.A to 1.D)
