---
prd: 1139
title: Loop drive — a loop plan across your PRDs, one step per tick, monitored on the Loop page
blocked-by: none
spec: file
---

# Loop drive

**Date:** 2026-10-07 · **PRD:** #1139 · **Touches:** `kit/lib/next/` (new), `kit/lib/loop/` (new),
`kit/bin/commands/next.ts` and `kit/bin/commands/loop.ts` (new), the command index and `omni help`,
`kit/plugin/skills/drive/` (new), `kit/plugin/skills/pr-care/SKILL.md` (`--once`),
`supabase/migrations/` (one new migration), `apps/galaxy/app/api/loops/` and
`apps/galaxy/app/app/loop/` (new), `apps/galaxy/src/loop/` (new), `apps/galaxy/src/nav/sidebar.ts`
and its tests, `docs/guide/` (one page on driving the loop).
**Out of scope:** brainstorm and phase-0 review (a person's conversation), merging into `main`,
answering the outbox, driving another person's PRDs unasked, PRDs that span repositories (the plan
repository's `/omni:ultra-yolo` keeps them), a notification channel beyond the PRD's status comment
and the Loop page.

## Problem

Large work in this repository is many PRDs, each moving brainstorm → phase-0 → waves → gate →
yolo-fix → pr-care → merge. Every move after phase-0 is mechanical, yet each needs a person to type
the next command:

- `/omni:yolo` runs every wave in one long context and, when a slice is `in-flight` or `held`, stops
  with "re-run later". Nobody re-runs it until someone remembers.
- `/omni:pr-care` waits with a hand-rolled background `sleep 300`, because a foreground command dies
  after 10 minutes.
- Nothing looks **across** PRDs. Two feature branches can touch the same files, and nothing notices
  until a merge conflict in pr-care. `blocked-by` between PRDs is declared in each spec and read by
  no runner.
- When a person leaves work running, nothing in the Omni app shows it: there is no page that lists
  running sessions, what they did, or what they wait on.

Claude Code's `/loop` can run a prompt again and again, pacing itself. The loop's skills are already
safe to re-run (the board is rebuilt from GitHub every time), so what is missing is a single answer
to "what is the next step, and when do I stop", an order across PRDs, and a place to watch it.

## Solution

Three parts, shipped together: neither is worth having alone.

### 1. `omni next`: the verdict and the loop plan (kit, agent-agnostic)

`omni next [<n>…] [--json] [--plan]` decides; it writes nothing on GitHub. With no number it drives
**your own PRDs** in **inbox, building or outbox**: the list `omni status` already marks yours.
Numbers given name PRDs explicitly, someone else's included.

**The loop plan.** On a loop's first tick, `omni next --plan` orders every slice of every driven PRD
into one numbered sequence of **steps**, from each PRD's `plan.md` and its live board:

- each PRD's waves keep their order;
- two PRDs whose slices share territory run their colliding steps **in series**, and the plan says
  why (`1017 s2 after 1030 s3: both touch apps/galaxy/src/nav/`);
- a PRD whose `blocked-by` has not shipped waits on it;
- steps with no collision and no blocker are marked to run **beside** each other.

The plan is deterministic (the same plans and boards give the same steps), saved as the loop's plan
version 1, printed, and pushed to the Loop page.

**Following the plan.** On each later tick, `omni next` reads the frozen plan and the live boards and
returns the verdict for the **first step not done**. It never jumps to a later step because it could
run, save a step the plan already marked to run beside it.

| the step's PRD | verdict |
|---|---|
| feature PR ready, and red CI, a conflict or a review thread not handled | `act pr-care --once` |
| outbox gate red, and answers posted on the feature PR | `act yolo-fix` |
| every slice merged, the feature PR still draft | `act yolo` (finishes, runs the gate, marks ready) |
| slices takeable in the step's wave | `act wave` |
| CI running, or another session holds a claim on the step | `wait`, with a wake hint |
| phase-0 PR open, outbox questions open, or a ready PR clean and waiting to be merged | `park`, with who, what and the link |
| feature PR merged or closed | `done` |

**Replanning.** The plan changes only when reality breaks it: a slice goes `stuck`, a slice is added,
a PRD ships or closes early, an answer reworks a slice. Then the tick writes plan version k+1, says
why in one line (`replanned v2: s4 of PRD 1030 stuck → 1017 moves up`), and pushes it. Nothing
changed: no new version.

### 2. `/omni:drive`: one step per tick (plugin skill)

`/loop /omni:drive [<n>…]`. One tick:

1. `omni next --json`. First tick only: `omni next --plan`, then `omni loop push start`; the loop's
   id and plan are kept under `.omni-loop/local/`.
2. `act`: run that one skill, to its end, in the PRD's worktree (`/omni:wave`, `/omni:yolo`,
   `/omni:yolo-fix`, `/omni:pr-care --once`, each unchanged but for pr-care's flag). `wait`: run
   nothing. `park`: write the reason on the feature PR's status comment and `omni loop push park`.
3. `omni loop push tick`: the step (`step 7/23`), the PRD, the action, a one-line result, the PRD's
   page link, the sub-PRs it merged and the outbox items it opened, and the next wake.
4. Every driven PRD parked or done: `omni loop push stop`, print each PRD with what it waits on and
   the link where a person acts, and end the loop. Otherwise schedule the next wake: 60–120 s after
   an `act`, the hint after a CI `wait` (at most 10 minutes), 20 minutes after a claim `wait`.

Everything a tick decides lands in the **PRD's outbox**, where it is reviewed, never in the ledger:
`/omni:do-work` already records each decision as an outbox item. The loop's own choice is
deterministic and carries its reason.

`/omni:pr-care --once` runs one round and returns; `/omni:pr-care` without it keeps its own wait.

### 3. The Loop page (Omni app)

- `omni loop push <start|tick|park|stop>` sends the loop's state to `POST /api/loops`. It never
  blocks: a 5-second limit and one token refresh, like `omni dossier`; a failure prints one line
  (`off`, `no sign-in (omni signin)`, `unreachable`, `refused (<status>)`) and the tick carries on.
- A migration adds `loops` (one row per loop: owner, workspace, repository, the PRDs it drives, its
  state, last tick, next wake) and `loop_ticks` (the ledger) and `loop_plans` (every plan version).
  Only the security-definer RPC `loop_push()` writes them; workspace members read them.
- A **Loop** entry in the sidebar's Dashboard group, beside Fleet, opens `/app/loop`: every loop of
  the workspace, who runs it, the repository, its state and its last tick. One loop opened shows its
  plan as one timeline per PRD with collisions marked and every version, its ledger (each line
  linking to its PRD's page), and its parked PRDs with what each waits on.
- A loop's state is **live** while ticking, **sleeping** until `nextWakeAt`, **parked** when it
  stopped with PRDs waiting on people, **stopped**, or **silent** once `nextWakeAt` plus 5 minutes
  has passed without a tick: the session died.

## Decisions

- **One PRD for both the single-PRD drive and the fleet.** The person: one without the other is
  useless.
- **The fleet drives your own PRDs by default** (inbox, building, outbox, as `omni status` reads
  "yours"); naming numbers drives others'. Someone else's worktrees and claims would collide.
- **One action per tick**, so a tick costs at most one wave of subagents.
- **The loop stops itself** when every PRD is parked or done, rather than ticking slowly to pick up
  answers: no tokens spent waiting on people. A person restarts it.
- **The loop follows a frozen loop plan,** replanned only when reality breaks it, every version kept.
  A free pick each tick would "loop wrong" across PRDs (the person's words). This replaces an earlier
  "closest to shipping first" rule.
- **The plan is computed, never hand-written,** so it cannot drift from the PRDs' plans and boards.
- **The kit stays agent-agnostic:** `omni next` and `omni loop push` know nothing of `/loop`; any
  runner (cron, CI) can call them. Only `/omni:drive` is Claude-specific.
- **A new `loops` record, not `working_pings`:** a liveness ping carries no ledger and no plan, which
  is what makes the page worth opening (option 1 of 3; reading GitHub only could not tell a sleeping
  loop from a dead one).
- **The voice — F-E Developer objected:** "A loop that builds wave after wave while nobody watches is
  exactly how slop gets to production" (persona:F-E Developer). **Accepted:** every tick links to
  the PRD it works on, and everything it decided is in that PRD's outbox, under the same gate as
  today; the loop never merges into `main`.
- **No proof video.**

## User stories

- As a PM with five PRDs merged into the inbox, I start `/loop /omni:drive` once and come back to
  feature PRs ready or parked on my questions, without typing a command in between.
- As the person running it, I see the loop plan before the first wave, and why one PRD waits on
  another.
- As a lead engineer, I open **Loop** in the Omni app and see who has a loop running, on what, what it
  did tick by tick, and where its decisions are waiting for review.
- As a reviewer, every tick I look at leads me to its PRD's page and outbox.
- As the person whose terminal closed, I run `/loop /omni:drive` again and the same loop resumes its
  plan.

## Scope

In: `omni next` (verdict, plan, replan, follow), `omni loop push`, `/omni:drive`,
`/omni:pr-care --once`, the migration and RPC, the API route, the Loop page and sidebar entry, `omni
help` entries for the two commands and the skill, a guide page.

Out: everything under **Out of scope** above; changing how `/omni:wave`, `/omni:yolo` or
`/omni:yolo-fix` work; running several actions per tick.

## Test seams

Following `omni kb show testing`: tests beside the code, never calling GitHub or Supabase.

- `kit/lib/next/decide.test.ts`: one row per verdict in the table above, and an unreadable board →
  `wait`.
- `kit/lib/next/plan.test.ts`: colliding territories in series with the reason; `blocked-by` held;
  non-overlapping PRDs beside each other; the same input gives the same plan.
- `kit/lib/next/replan.test.ts`: stuck slice, added slice, early ship → a new version; nothing
  changed → none.
- `kit/lib/next/follow.test.ts`: the first step not done, never a later runnable one, save one
  planned beside it.
- `kit/bin/next.test.ts` through `main()` on `makeRepo()` with gh stubbed: default "yours", explicit
  numbers, `--json` shape, `--plan`, gh unreachable.
- `kit/bin/loop.test.ts` with the HTTP client stubbed: each event's body, the 5-second limit, the
  401 refresh, the one-line failures; a second live loop refused; `--take-over` on a silent loop only.
- `apps/galaxy/src/loop/api.test.ts`: validation, response shape, failures, on a stubbed store.
- `apps/galaxy/src/loop/state.test.ts`: `loopState(row, now)` at each boundary.
- `apps/galaxy/src/loop/render.test.ts`: the list, one loop with its plan timeline and versions, the
  ledger links, parked PRDs, the empty and signed-out states, on demo data.
- `apps/galaxy/src/nav/sidebar.test.ts`: the `loop` id in its lists.
- The migration: a member reads only their workspace's loops; only `loop_push()` writes.

## Risks

Read with `omni kb show releasing`. Merging this PRD publishes:

- **The database:** the migration applies `loops`, `loop_ticks` and `loop_plans` to production
  Supabase. Additive only; rollback is a migration dropping the three tables and `loop_push()`, with
  nothing else reading them.
- **The kit:** `kit/dist/omni.mjs` and the plugin gain `omni next`, `omni loop` and `/omni:drive`,
  and `/omni:pr-care` gains `--once`. Nothing existing changes behaviour; rollback is reverting the
  feature commit and releasing.
- **Cost:** an unattended loop spends tokens. One action per tick, a self-stop when nothing can move,
  and the same subagent bound as `/omni:wave` keep it bounded.
- **Wrong order across PRDs** would build on a collision: the plan's collision rule and the existing
  claims hold it; the replan line makes every change visible.

## Acceptance criteria

1. `/loop /omni:drive` with no number drives the person's own PRDs in inbox, building or outbox, and
   prints the loop plan, with each cross-PRD order and its reason, before its first action.
2. Each tick takes exactly one step, the first not done in plan order, and its ledger line names the
   step and links to its PRD's page.
3. A slice going `stuck` produces plan version 2 with its one-line reason, visible in the terminal and
   on the Loop page; a tick where nothing changed produces no version.
4. A PRD waiting on a person parks, and its feature PR's status comment says on what.
5. When every driven PRD is parked or done, the loop stops itself and lists what waits on whom, with
   links.
6. The **Loop** sidebar entry shows the loop live, then sleeping, then stopped, with its plan versions
   and its ledger.
7. A loop whose session died shows **silent**; running `/loop /omni:drive` again resumes the same loop
   and its plan.
8. `omni loop push` with the app unreachable prints one line and the tick still runs its action.
