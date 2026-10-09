---
title: Drive the loop
description: Leave your PRDs building, up to three steps at once that never collide, and watch it on the Loop page.
---

Once a PRD's phase-0 pull request is merged, every move until its feature PR is ready is
mechanical: a wave, the next wave, finishing the branch, the outbox gate, a review round. Typing
each command yourself means coming back to start the next one. **Driving** the loop types them for
you, several PRDs at once when they share no ground, until each of your PRDs is ready or waits on a
person, and then it stops.

It never merges into your default branch and never answers the outbox: everything it decides
lands in the PRD's outbox, under the same gate as when you run `/omni:yolo` yourself.

## Start it

In Claude Code, at the root of your repository, with your checkout up to date:

```text agent
/loop /omni:drive
```

With no number it drives **your own PRDs** in inbox, building or outbox: the ones `omni status`
marks yours. Name PRDs to drive exactly those, someone else's included:

```text agent
/loop /omni:drive 1017 1030
```

Leave out the interval: the loop paces itself, waking sooner after it built something and later
while CI runs or another session holds a claim.

To drive a **roadmap**, a milestone of several PRDs ordered by their blockers, give its number:

```text agent
/loop /omni:drive --roadmap 1170
```

It drives exactly the roadmap's PRDs, someone else's included (see **Drive a roadmap**, below).

In a **plan repository**, whose PRDs land in other repositories, the command is
`/loop /omni:mega-drive` (see **Drive a plan repository**, below). Each command refuses the other's
kind of repository, printing the line to type instead.

## The loop plan

Before its first action, the loop orders every slice of the PRDs it drives into one numbered list
of **steps**, and prints it:

```text agent
loop plan v1 · PRDs 1017, 1030 · 5 steps
  1. PRD 1030 wave 1: s1, s2 · beside 2
  2. PRD 1017 wave 1: s1 · beside 1
  3. PRD 1030 wave 2: s3 · after 1
  4. PRD 1017 wave 2: s2 · after 2, 3
  5. PRD 1030 finish · after 3
orders across PRDs:
  step 4: 1017 s2 after 1030 s3: both touch apps/galaxy/src/nav/
```

Each PRD's waves keep their order. Two PRDs whose slices touch the same files run those steps one
after the other, and the plan says why. A PRD whose spec is `blocked-by` another waits until that one
ships. Steps that share nothing are marked to run beside each other, and the loop runs them at the same
time (see **Several steps at once**, below).

The plan is computed, never written by hand: you can print it any time with
`omni next --plan`, which is what the first tick runs. It changes only when reality breaks it: a
slice goes stuck, a slice is added, a PRD ships or closes early. Then the loop writes the next
version and says why in one line, such as `replanned v2: s4 of PRD 1030 stuck → 1017 moves up`.

## One step per tick, up to three at once

Each tick asks `omni next` for the steps to run, up to three at once (see **Several steps at once**,
below), and for each one does one thing:

| the step's PRD | the tick |
|---|---|
| slices to build in the step's wave | runs `/omni:wave` |
| every slice merged, the feature PR still draft | runs `/omni:yolo`, which finishes, runs the gate and marks ready |
| the gate red, and answers posted on the feature PR | runs `/omni:yolo-fix` |
| the feature PR ready, with red CI, a conflict or a review comment | runs `/omni:pr-care --once`: one round, then back |
| CI running, or another session holding a claim | waits |
| waiting on a person | parks |

A PRD **parks** when only a person can move it: its phase-0 PR is open, or, when phase 0 is approved
on the server, it waits for approval on its page (or a file changed since it was approved), its outbox has questions,
its CI is stuck, its feature PR is ready to merge, or a slice's sub-PR has had no commit for
`limits.stallDays` (5 days by default): a claim nobody came back to, which a person takes over or
closes. The loop writes why on the feature PR's
status comment, so whoever opens the pull request sees it.

## Several steps at once

The loop keeps a **pool**: up to `limits.parallelSteps` steps running at the same time, **3** by
default. Each tick counts the steps still running, fills the free slots, and launches each new step
as its own background agent, in its own worktree, running that step's one skill exactly as above.
When an agent finishes, the loop wakes at once to fill its slot.

A step joins the pool only when it passes four rules against every step already running or launched
in the same tick:

| rule | a step is held when |
|---|---|
| another PRD | a step of the same PRD runs: a PRD's own steps keep their order |
| no open blocker | its PRD is `blocked-by` a PRD not shipped, or, under `--roadmap`, a blocker not merged |
| no shared ground | one of its slices touches a path a running step's slices touch, in the same repository; generated files never count, and a finish step stands on every slice of its PRD |
| the plan allows it | a step it comes `after` in the loop plan is not done |

A step kept back is **held**, with one line naming the rule and the step it waits on, in the terminal
and on the Loop page:

```text agent
step 7 (PRD 1030 w2) held: apps/galaxy/src/nav/ shared with step 4 (PRD 1017 w1, running)
```

It starts at the first tick after that step is done. `omni next --json` returns the pool as
`steps` (to launch now), `running` and `held`, beside the `step` and `verdict` it always returned.

The loop reads what runs from GitHub, never from your computer: a slice with a live claim, or a
feature PR carrying `omni:in-progress` with a fresh status comment. A closed terminal, started again,
counts the steps still running and launches nothing twice; an agent that died frees its slot when its
claim goes stale (`limits.claimStaleMinutes`).

Each step costs what a tick cost before, so three running steps cost up to three times as much. To
keep today's loop, one step per tick, set the limit to 1 in `.omni-loop/config.yml`:

```yaml file=.omni-loop/config.yml
limits:
  parallelSteps: 1
```

It takes a whole number from 1 to 6; `omni config` refuses any other.

## Drive a roadmap

With `--roadmap <n>`, a PRD the roadmap says is blocked by others waits until each blocker's feature
PR is **merged**, not merely built: it builds on reviewed code. Every PRD that waits on nothing runs
meanwhile, so only what must wait does.

A waiting PRD names the pull request it waits on and that pull request's state, in the terminal, on
the Loop page, on the roadmap's page and on its own issue:

```text agent
held: PRD 1213 — waits on app#1201 (p2 Invoices): ready, waiting for your merge
```

The state is one of `building wave <k>/<m>`, `outbox: <k> questions`, `CI red` or `ready, waiting for
your merge`: you know which pull request to review first. A question of the roadmap that only a
person can answer parks the PRDs it blocks, naming the question and the command that answers it
(`omni roadmap answer`); the next tick takes them up once it is answered. A blocker closed without
merging parks its dependents until someone fixes the roadmap. After every tick the loop sends the
roadmap's page where each PRD stands (`omni roadmap push`); with the app out of reach it prints one
line and carries on.

## Drive a plan repository

In a plan repository, run the same loop with its twin:

```text agent
/loop /omni:mega-drive
/loop /omni:mega-drive --roadmap 1170
```

It drives the multi-repository PRDs exactly as above, with the skills that build across
repositories: `/omni:ultra-wave`, `/omni:ultra-yolo` (which also writes the plan of a PRD that has
none yet), `/omni:ultra-yolo-fix` and `/omni:mega-pr-care --once`. Two steps run one after the other
only when they touch the same path **in the same repository**: a slice in one repository never waits
for a slice in another that shares nothing with it. Each PRD keeps its own copy of each target, at
`<worktrees>/targets/<name>@<prd>`, so two steps running at once never switch the same checkout. A park is written on the plan pull request's
status comment, naming each pull request still open by repository, and the Loop page shows the
repositories each tick touched. [Several repositories](/docs/several-repositories) explains plan
repositories.

## Stop and restart

When nothing is running and every PRD it drives is parked or done, the loop stops itself and lists
what waits on whom:

```text agent
loop stopped: nothing moves until a person acts
PRD 1017 — park: waits on the PRD's owner: 2 outbox questions to answer — https://…
PRD 1030 — park: waits on a person: the feature PR is ready to merge — https://…
```

It spends nothing while it waits for you. Answer, merge, then run `/loop /omni:drive` again.

To stop it yourself, end the `/loop` in Claude Code. If your terminal closed, run
`/loop /omni:drive` again: the loop kept in your checkout resumes, with the same plan.

## Watch it on the Loop page

Every tick is sent to the **Loop** page of the Omni app, beside Fleet in the sidebar. It lists every
loop of your workspace, who runs it, on which repository, and what it is doing:

| state | what it means |
|---|---|
| live | ticking now |
| sleeping | waiting for its next wake |
| parked | stopped with PRDs waiting on people |
| stopped | ended |
| silent | five minutes past its wake with no tick: the session that ran it died |

Open one to see its plan as a timeline per PRD, with every version and its reason, the ledger of
its ticks (each line links to its PRD's page, and lists the steps running by repository and every
held step with its reason), and the PRDs it parked with what each waits on.

The page needs your terminal signed in to the Omni app (`omni signin`). Signed out, or with the
app out of reach, the loop still runs: each tick prints one line saying the page missed it.

[Next → Several repositories](/docs/several-repositories)
