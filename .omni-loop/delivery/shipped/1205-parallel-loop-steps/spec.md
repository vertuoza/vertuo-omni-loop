---
prd: 1205
title: The loop runs up to three non-colliding steps at once
blocked-by: none
spec: file
---

# Parallel loop steps

**Date:** 2026-10-08 · **PRD:** #1205 · **Touches:** `kit/lib/next/` (`follow.ts`, `decide.ts` and
their tests), `kit/bin/commands/next.ts` (`tickJson`, `tickLines`), `kit/lib/config.ts`
(`limits.parallelSteps`), `kit/plugin/skills/drive/SKILL.md`, `kit/plugin/skills/mega-drive/SKILL.md`,
`kit/plugin/skills/ultra-wave/SKILL.md` and `kit/plugin/skills/ultra-yolo/SKILL.md` (the target clone
path), `omni help`, `docs/guide/` (the page on driving the loop).
**Out of scope:** how `/omni:plan` slices a PRD into waves, the plan's ordering rules (`plan.ts`
keeps its `after` and `beside` marks as they are), more than one loop per checkout, merging into any
default branch, and the Loop page's layout beyond the lines this PRD adds to each tick.

## Problem

`/loop /omni:drive 12 13 14` and `/loop /omni:mega-drive 12 13 14` drive several PRDs, yet each
tick runs **one step**: one wave of one PRD. The loop plan already marks steps of different PRDs
that share no ground as `beside` each other (`kit/lib/next/plan.ts`), but `followPlan`
(`kit/lib/next/follow.ts`) only uses that mark to swap a waiting step for another one, never to run
two. So while PRD 12's wave builds, PRDs 13 and 14 sit idle even when nothing they touch overlaps,
and a person driving several PRDs waits on each in turn. PRD 1139 made "each tick takes exactly one
step" an acceptance criterion as a cost bound; this PRD replaces that bound with a configured one.

Two steps running at once also share more than files: `/omni:ultra-wave` switches the HEAD of one
clone per target (`<worktrees>/targets/<name>`), and `/omni:wave` makes its claim commits in the
checkout it runs from. Two steps there would fight over a HEAD even with disjoint territories.

## Solution

**A rolling pool of steps.** Each tick fills free slots, up to `limits.parallelSteps` (default
**3**) steps running at once, counting those already running. It launches each new step as its own
background agent, which runs that step's one skill exactly as a tick runs it today.

### 1. `omni next --json` returns `steps`

Beside today's `step` and `verdict`, the tick document gains:

- `steps`: the steps to launch now, each `{ step, of, prd, kind, wave, slices, repos?, verdict }`,
  in plan order. Its first entry is today's `step` with today's `verdict`, so a reader of `step`
  alone keeps working.
- `running`: the steps already running, each `{ step, prd, kind, repos?, since }`.
- `held`: each step that could run but was kept back, each `{ step, prd, why }`.

`steps.length + running.length` is never above `limits.parallelSteps`. With `parallelSteps: 1` the
document's existing fields are byte-identical to today's, and `steps` holds `step` alone.

**Running** is read from GitHub only, so a closed terminal resumes it right: a PRD has a step
running when a slice of its current wave holds a live claim (a draft sub-PR whose claim is not stale,
`isClaimedStale`), or when its finish, yolo-fix or pr-care step holds the PRD's `omni:in-progress`
label with a status comment updated within `limits.claimStaleMinutes`.

### 2. The collision check

`omni next` offers a step only when it passes all four rules against **every running step and every
step already offered** in this tick:

1. **Another PRD.** No two steps of one PRD run at once; a PRD's own steps keep their order.
2. **No open blocker.** Its PRD's `blocked-by` and, under `--roadmap`, its roadmap blockers have
   merged (the existing hold).
3. **No shared ground.** Its slices' territories share no path in the same repository with any
   running or offered step's slices, by the existing `groundOf` / `sharedGround` rule
   (`kit/lib/next/plan.ts`, `kit/lib/inbox/territory.ts`); generated paths are ignored.
4. **The plan allows it.** Its `after` steps are done, or it is marked `beside` the steps it runs
   with.

A step kept back by a rule is listed in `held` with one line naming the rule and the other step:
`step 7 (PRD 14 w2) held: apps/galaxy/src shared with step 4 (PRD 12 w1, running)`. A PRD's finish
step has no territory of its own; its ground is the union of its PRD's slices.

### 3. Isolation

- **`/omni:drive`:** each step agent runs with `isolation: "worktree"`, so its claim commits and
  `git switch --detach` happen in its own worktree, never in the loop's checkout.
- **`/omni:mega-drive`:** each PRD keeps its own target clones, at `<worktrees>/targets/<name>@<prd>`,
  where `/omni:ultra-yolo`, `/omni:ultra-wave` and `/omni:ultra-yolo-fix` make and read them. No two
  running steps share a HEAD.
- Every PRD has its own feature branch, plan PR branch and outbox folder, so no two steps push one
  branch.

### 4. The tick (`/omni:drive`, `/omni:mega-drive`)

1. Read `omni next --json`.
2. Launch one background agent per entry of `steps`, in one message, each running its step's one
   skill (`/omni:wave <n>`, `/omni:yolo <n>`, `/omni:pr-care <n> --once`, or under `/omni:mega-drive`
   `/omni:ultra-wave <n>`, `/omni:ultra-yolo <n>`, `/omni:ultra-yolo-fix <n>`,
   `/omni:mega-pr-care <n> --once`). Each agent is told its PRD and step, and its result is the
   skill's report.
3. Record one `omni loop push tick` per step launched, and one per step that finished since the last
   tick, with its result. Each tick on the Loop page lists the running steps by repository and every
   `held` line. Only the loop session writes the loop record and the roadmap, never a step agent.
4. Park what waits on a person, as today.
5. Set the wake: an agent finishing wakes the loop at once to fill its slot; otherwise the usual
   wake hint. The loop stops itself only when nothing is running and every PRD is parked or done.

### 5. The setting

`limits.parallelSteps`: an integer from 1 to 6, default 3, in the omni config. `1` is today's loop.

## Decisions

- **Several PRDs at once, not wider plans.** The person saw several PRDs built one at a time; how
  `/omni:plan` slices a single PRD is left as it is.
- **A setting, default 3.** The person: "3 or 4"; a repository raises it to 4 or sets 1.
- **Both loops.** `/omni:drive` and `/omni:mega-drive` share the plan code, so both change.
- **A rolling pool, not a batch per tick and not several loops** (option A of 3). A batch leaves
  slots idle behind the slowest wave; several loops in separate terminals have no collision guard.
  The person added: run a check before launching that the steps will not collide, which is the
  collision check of **Solution 2**.
- **Running steps are read from GitHub, never kept on this computer,** so a closed terminal resumes
  the pool and an agent that died frees its slot when its claim goes stale.
- **Supersedes PRD 1139's "each tick takes exactly one step"** (its acceptance criterion 2) and PRD
  1162's "one step per tick" cost bound: the bound is now `limits.parallelSteps`; the self-stop
  stays.
- **A target clone per PRD** under `/omni:mega-drive`: territory alone cannot stop two steps from
  switching one clone's HEAD.
- **The voice — Lead Engineer objected:** "Three PRDs landing in parallel across my repositories is
  three streams of agent decisions to keep coherent at once" (persona:Lead Engineer). **Accepted:**
  each tick on the Loop page lists the running steps by repository and why any step was held; no
  per-repository cap.
- **No proof video:** this is loop behaviour, not a screen.

## User stories

- As a person driving PRDs 12, 13 and 14 whose territories do not overlap, I see all three build at
  the same time, and I come back to three PRDs further along instead of one.
- As a person driving two PRDs that both touch `apps/galaxy/src/nav/`, I see the second held with
  the path and the step it waits on, and it starts as soon as the first one's step is done.
- As a lead watching the Loop page, I see which steps run in which repository, and why any step is
  held.
- As a repository that wants today's loop, I set `limits.parallelSteps: 1` and nothing changes.
- As a person who closed the terminal mid-tick, I start the loop again and it counts the steps still
  running from their claims, launching nothing twice.

## Scope

In: `steps`, `running` and `held` in `omni next --json` and their lines in its plain output; the
collision check; `limits.parallelSteps`; the drive and mega-drive tick; the per-PRD target clone
path in the ultra skills; the tick record of running and held steps; `omni help` and the guide page.

Out: the plan's ordering (`plan.ts`), slicing, more than one loop per checkout, a per-repository cap,
a new database table (the tick record already carries free lines).

## Test seams

Following `omni kb show testing`: unit tests beside the code in `kit/lib/next/`, test-first, no
network and no git in a unit test (the live board is a fixture).

- `follow.test.ts`: `followSteps(plan, live, slots)` returns up to `slots` steps, minus the running
  ones; never two of one PRD; never a step whose blocker is open; never a step sharing ground in the
  same repository with a running or offered step; the same paths in two repositories do not collide;
  generated paths do not collide; a finish step's ground is its PRD's slices.
- Each of the four rules holds a step with its own reason line.
- `slots: 1` gives exactly today's `followPlan` result, across the existing `follow.test.ts` cases.
- Running is read from a fixture board: a live claim counts, a stale claim does not, an
  `omni:in-progress` label with a fresh status comment counts.
- `next` command test: `tickJson` keeps `step` and `verdict` and adds `steps`, `running` and `held`;
  with `parallelSteps: 1` the existing fields are byte-identical.
- Config test: `limits.parallelSteps` defaults to 3 and refuses 0, 7 and a fraction.
- The skill files pass the kit's existing skill checks.

## Risks

Merging this PRD publishes a new kit version (`omni kb show releasing`): every repository on the kit
gets the pool at its next update, running up to 3 steps' worth of agents per tick instead of one.
That multiplies a loop's token cost by up to 3. Rollback: set `limits.parallelSteps: 1` in the
repository's omni config, which restores today's loop with no other change; or revert the feature
PR, since nothing stored changes shape. A step agent that strays outside its territory is still
refused at merge by the territory check.

## Acceptance criteria

1. With `limits.parallelSteps` unset and three driven PRDs whose current waves share no ground,
   one tick of `omni next --json` lists three entries in `steps`, each of a different PRD.
2. With two driven PRDs whose current waves share a path in the same repository, `steps` lists the
   first and `held` names the second with that path and the step it waits on.
3. Two PRDs whose waves touch the same path in **different** repositories are both in `steps`.
4. A step whose PRD's `blocked-by` has not merged is never in `steps`.
5. With one step running (a live claim on GitHub), `steps` holds at most `parallelSteps - 1`
   entries and never a second step of that PRD.
6. With `limits.parallelSteps: 1`, `omni next --json`'s `step`, `verdict`, `waiting` and `prds` are
   byte-identical to today's for the same plan and boards.
7. A tick of `/omni:drive` or `/omni:mega-drive` launches one background agent per entry of `steps`,
   each in its own worktree (drive) or with its own `<worktrees>/targets/<name>@<prd>` clones
   (mega-drive), and records one tick per step launched.
8. The Loop page's tick lists each running step with its repository and each held step with its
   reason.
9. The loop stops itself only when nothing is running and every PRD is parked or done.
10. `limits.parallelSteps` defaults to 3 and `omni config` refuses a value outside 1 to 6.
