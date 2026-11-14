---
screen: mission-start
status: draft
kind: page
mock: mission-start.html
implements: []
reads: []
routes: []
supersedes: null
---

## Purpose

The fleet's Missions tab: start a mission from an approved roadmap, then follow, pause and resume
it. A mission keeps moving on the fleet's runners while the person's laptop is closed.

## Regions

- **The roadmap picker:** approved roadmaps only; one not approved shows why it cannot be picked.
- **The seats:** who will hold each seat for this mission.
- **One estimate line:** `Likely ready for review <day> <time>. May ask you once.`
- **The primary action:** `Start mission`.
- **Running:** the mission's state and its current step, with `Pause`; paused, with `Resume`.

## States

- **No approved roadmap:** the page says so and how a roadmap gets approved.
- **Running**, **Paused** (by whom, since when), **Stopped** (why, how to resume), **Ready for
  review**, **Merged**: ready and merged are two states, never one.

## Words

- `Start mission`, `Pause`, `Resume`, `May ask you once.`

## Refusals

- No chart of the forecast, no hours drawn as bars.
- A mission never starts from a roadmap that is not approved.

## Open questions

- PRD 2842 makes this tab a list of the fleet's missions (goal, status, `2 of 4 merged · 1 ready`, what a
  waiting PRD waits on), with Start on a draft and Pause or Resume on the others; a mission's scope
  is PRDs and/or roadmaps, not one roadmap, and the estimate line is not built.

- Whether the estimate line ships in the first version or waits for enough history.
- One mission per roadmap: what the tab shows when a roadmap's mission already runs.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/inbox/2842-missions/before-after.html
