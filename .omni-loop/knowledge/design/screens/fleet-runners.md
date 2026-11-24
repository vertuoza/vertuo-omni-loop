---
screen: fleet-runners
status: draft
kind: page
mock: fleet-runners.html
implements: [apps/galaxy/src/virtual-fleets/runners/RunnersTab.tsx, apps/galaxy/src/virtual-fleets/runners/runners-tab.css]
reads: [apps/galaxy/src/virtual-fleets/runners/runners-view.ts, apps/galaxy/src/runners/runners.service.ts, apps/galaxy/src/runners/page/model.ts, apps/galaxy/src/runners/page/health.ts, apps/galaxy/src/runners/page/NeedHuman.tsx, apps/galaxy/src/runners/page/Terminal.tsx, apps/galaxy/src/dashboard/fleet/FleetScreen.tsx]
routes: [/app/ai-fleet]
supersedes: null
---

## Purpose

An AI fleet's Runners tab (`?tab=runners`, inside `fleet-frame`): which runner runs each of the
fleet's jobs, in which role, for how long, and why a job waits, so a member never goes to the
Runners page to find out.

## Regions

- **Its own runners:** one row per runner whose fleet is this fleet: name and repositories, state,
  `used of slots`, the fleet's jobs it runs now (role, PRD or pull request with its title, status,
  time), Terminal, and the health gauges (CPU, Memory, Disk, Tokens over 5 h).
- **Shared runners running its work:** the runners of no fleet running one of its missions' jobs,
  marked `Shared`, `n for <fleet>` under their slots, under the reason `No runner of <fleet> holds
  <repo>`.
- **Waiting for a slot:** the fleet's queued jobs, each with its reason in a few words.
- **The foot:** `Give it a runner: Runners`, linked.

## States

- **4.A, running:** own runners busy and online, a job `Waiting on answers` with `Answer` (the one
  primary action, opening today's Need human drawer), one Shared runner, one queued job.
- **4.B, no runner of its own:** `No runner of its own.`, then the Shared runners running its work.
- **4.C, its only runner offline:** the row muted, `Offline, 2 h ago`, `2 jobs wait for atlas-1.`
- **4.D, no runner in the workspace:** `No runner in this workspace.`, `Start one:` and the start
  command.
- **4.E, out of tokens and a job no runner can take:** `Out of tokens until 14:00`, the runners
  `Paused: out of tokens`, a queued job `Cannot run: Update the runner's kit` with `How to update`.

## Words

`Its own runners` · `Shared runners running its work` · `Waiting for a slot` · `Runner` · `State` ·
`Slots` · `Running now` · `Terminal` · `Answer` · `Shared` · `<n> for <fleet>` · `Running` · `Queued` ·
`Waiting on answers` · `Need human` · `Online` · `Busy` · `Offline, <n> ago` · `Paused: <why>` ·
`Engineer` · `QA` · `Reviewer` · `PM` · `Architect` · `Supervisor` · `No runner of its own.` ·
`No runner in this workspace.` · `Start one:` · `Out of tokens until <hh:mm>` · `Cannot run: <reason>` ·
`Give it a runner:`

## Refusals

- No setting of a runner's fleet here: that stays on Runners, owners only.
- No colour per role: a role is a plain pill; state and status colours are the Runners page's.
- A Shared runner's other fleets' jobs are not shown here; only `n for <fleet>` counts this fleet's.
- No sentence longer than seven words at rest (the word pass).

## Open questions

- Whether the gauges show for a Shared runner too (drawn: only for the fleet's own).
- How long a job's time reads past a day (`2 d`, from the Runners page's `spanOf`?).

## Source

/omni:brainstorm, PRD 3233: .omni-loop/delivery/inbox/3233-ai-fleet/before-after.html
