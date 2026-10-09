---
name: drive
description: Drives your PRDs as a rolling pool of up to limits.parallelSteps steps at once, run as /loop /omni:drive [<n>…], or a roadmap's PRDs with --roadmap <n> — on its first tick it orders every slice of the PRDs driven into a loop plan (omni next --plan) and opens the loop on the Loop page (omni loop push start); every tick it reads the steps that share no ground with what runs (omni next --json) and launches one background agent per step, each in its own worktree running that step's one skill, /omni:wave, /omni:yolo, /omni:yolo-fix or /omni:pr-care --once, parks a PRD that waits on a person on its feature PR's status comment, records a tick per step launched and per step finished with omni loop push tick, naming what runs and what is held, and sets the next wake; under --roadmap it checks the roadmap's prerequisites with omni roadmap prereqs --fix on the first tick and before a PRD one holds starts, holds a blocked PRD until its blockers merged, naming the pull request it waits on, or until the prerequisite it waits on is met, and pushes the roadmap after each tick; once nothing runs and every PRD is parked or done it stops itself, listing what waits on whom and each open prerequisite with its command. A closed terminal resumes the same loop and plan. A plan repository gets the /loop /omni:mega-drive line. Never merges into the default branch, never answers the outbox. Triggers on "drive my PRDs", "run the loop", "keep building until it needs me", "/loop /omni:drive", "/omni:drive".
---

# Drive: a pool of loop plan steps, filled each tick

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

This skill is one **tick**. Something runs it again and again: in Claude Code that is `/loop`
(**Waking up**, at the end, is the only part that is Claude Code's). Everything else is the kit's,
and any runner that calls `omni next` and `omni loop push` the same way drives the loop the same way.
Each tick fills a rolling **pool**: up to `limits.parallelSteps` steps of a frozen **loop plan** run
at once, each as its own background agent in its own worktree, and no two of them share a PRD or a
path. A tick launches the steps `omni next` offers for the free slots, records the steps it launched
and the ones that finished on the Loop page, and picks when to look again. The loop ends itself once
nothing runs and nothing can move without a person. With `limits.parallelSteps: 1`, it takes one step
at a time.

**Signing.** This skill commits nothing and opens no pull request or issue: the skill a step agent
runs signs its own commits and bodies with `omni sign trailer` and `omni sign footer`, as its own
steps say. The status comment it rewrites is a comment, and comments are never signed.

## Input

| input | example | what it is |
|---|---|---|
| nothing | `/loop /omni:drive` | drive your own PRDs in inbox, building or outbox, as `omni status` marks them |
| PRD numbers | `/loop /omni:drive 1017 1030` | drive these PRDs, someone else's included: naming them is the ask |
| `--roadmap <n>` | `/loop /omni:drive --roadmap 1170` | drive exactly roadmap n's PRDs, someone else's included, each held until its blockers' feature PRs merged. Name no PRD beside it |

Below, `[--roadmap <n>]` means: pass `--roadmap <n>` when the loop was asked for one, and nothing
otherwise.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON:
later steps read `repo.slug`, `repo.defaultBranch`, `labels.outboxGo` and `markers.prefix` from it.

**A plan repository is not this skill's.** When the config has a `plan` section (its `plan.targets`),
its PRDs land in other repositories and the single-repository skills stall on them: stop with
exactly one line, the arguments it was given carried over, and no wake:

```text
a plan repository: /loop /omni:mega-drive [<n>…] [--roadmap <n>]
```

Then print the briefing, `node .omni-loop/bin/omni.mjs kb show briefing`. Its rules bind every step
below, and the skill a tick runs reads it again on its own.

## 1. Open or resume the loop

Only on the first tick of this session; every later tick starts at **2. Read the step**.

```bash
node .omni-loop/bin/omni.mjs loop status --json
```

It prints the loop kept in this checkout, `{ loop, plan }`, and calls nothing. `loop` is `null`
when none is kept; otherwise its `state` is `live`, `sleeping`, `parked`, `stopped` or `silent`, and
its `prds` are the PRDs it drives.

| what `loop status` shows | the tick |
|---|---|
| `silent`, driving the PRDs asked (or no number was given; under `--roadmap`, the roadmap's PRDs) | **resume**: the session that ran it died. Say `resuming <loopId>, plan v<version>`, and go to step 2: the same id and plan carry on, and the steps still running are read from GitHub (`running`), so none is launched twice |
| `live` or `sleeping` | another session is driving this checkout: say `a loop is <state> here (<loopId>); stop it with omni loop push stop, or wait until it reads silent`, and end without a wake |
| `silent`, driving other PRDs than the ones asked | **new loop** below, with `--take-over` on the start |
| `null`, `parked` or `stopped` | **new loop** below |

**New loop.** Order every slice of the PRDs driven into the loop plan, version 1, and print it to
the person as it comes, every order across PRDs with its reason:

```bash
node .omni-loop/bin/omni.mjs next --plan [<n>…] [--roadmap <n>]
```

Exit 2 is a refusal on one line (no PRD of yours is in inbox, building or outbox; it cannot tell
which PRDs are yours; no roadmap n in the inbox, or one that does not parse): print it and end
without a wake. Then open the loop on the Loop page:

```bash
node .omni-loop/bin/omni.mjs loop push start [--take-over]
```

Exit 0 prints `start: <loopId> …`. Exit 1 is one line (`off`, `no sign-in (omni signin)`,
`unreachable`, `refused (<status>)`, or the loop already here): print it and **carry on**. The loop
runs the same without the page; its later pushes then each say so in one line.

**The prerequisites,** under `--roadmap` only, on this first tick of the session, whether the loop
is new or resumed:

```bash
node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix
```

It runs the roadmap's `## Prerequisites` rows on this machine, the `agent` rows' fixes once, keeps
the result as this machine's last (which `omni next` reads) and sends it to the roadmap's
**Prerequisites** tab. Print its lines. Exit `1` means a row waits on a person: never a failure, the
PRDs that row blocks are held and every other PRD builds. A roadmap without the section prints that
it has none: carry on.

## 2. Read the step

**Before a held PRD starts,** under `--roadmap`: when the last `next --json` of this session held a
PRD on a prerequisite (an entry of `held` whose `why` reads `waits on prerequisite <id> (<category>):
<need>`), check again first, so a row a person fixed since frees its PRDs on this very tick:

```bash
node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix
```

Its exit `1` is not a failure, as in step 1. Then read the step:

```bash
node .omni-loop/bin/omni.mjs next --json [--roadmap <n>]
```

With no number it follows the plan kept in this checkout; under `--roadmap`, the roadmap's plan. It writes nothing on GitHub; GitHub out of
reach is a `wait`, never a failure. It prints one document:

| field | what it says |
|---|---|
| `replanned` | `null`, or the one line of a new plan version, written because reality broke the plan (a slice went stuck, a slice was added, a PRD ended early). Print it as is |
| `stop` | `true` once every PRD driven is parked or done: go to **5. Stop** |
| `step` | the first step not done: `step` of `of`, its `prd`, its `kind`, its `wave` and `slices` |
| `verdict` | that step's verdict: `act` with its `skill`, or `wait` with its `wakeHint` in seconds; its `why`, and its `link` when it has one |
| `prds` | every PRD's own verdict, `park` and `done` ones included |
| `steps` | the steps to launch now, in plan order, each `{ step, of, prd, kind, wave, slices, verdict }` with an `act` verdict and its `skill`. Never more than `limits.parallelSteps` less the steps running, never two of one PRD, and none sharing a path with a running or launched step. Empty when nothing can start |
| `running` | the steps already running, read from GitHub (a live claim on a slice, or the PRD's in-progress label with a fresh status comment), each `{ step, prd, kind, since }` |
| `held` | each step or PRD kept back, with its `why`. Under `--roadmap`, the roadmap's entries come first, each with its `gate` (`hold` or `park`) and its `link`: a held PRD's `why` names the pull request it waits on and that PR's state (`waits on <repo>#<pr> (<id> <title>): <state>`), or the prerequisite not met on this machine (`waits on prerequisite <id> (<category>): <need>`, its link the roadmap's Prerequisites tab); a parked one names the question a person must answer, or the blocker closed unmerged. Then the pool's entries, `{ step, prd, why }` with no `gate`: a step the collision check keeps back this tick (`… shared with step 4 (PRD 12 w1, running)`) |

`limits.parallelSteps` (`omni config limits.parallelSteps`, 3 unless the repository sets it) is the
size of the pool. Never pick another step than the ones `steps` lists: the plan and the collision
check already chose. Print one line per entry of `steps`, `step <step>/<of> · PRD <prd> · act <skill> · <why>`,
then one per entry of `running`, `running: step <step> · PRD <prd> · <kind> since <since>`, then one
per entry of `held`, `held: <why>`. When `steps` is empty, print `step <step>/<of> · PRD <prd> ·
<verdict> <skill> · <why>` for `step`, as it is.

## 3. Act on it

**Launch.** Count this session's **step agents**, the ones it launched that have not returned yet.
One whose step `running` does not list yet (launched a moment ago, before its claim or label shows on
GitHub) has ground the collision check cannot see: while there is one, launch nothing this tick.
Otherwise launch one background agent per entry of `steps` whose PRD has no step agent of this
session still running, all in one message, each with `isolation: "worktree"`, so its claim commits
and its `git switch --detach` happen in its own worktree, never in the loop's checkout. This
session never has more than `limits.parallelSteps` step agents running at once. Each agent runs its
entry's one skill, `verdict.skill`: `/omni:wave <prd>`, `/omni:yolo <prd>`, `/omni:yolo-fix <prd>`,
or `/omni:pr-care <prd> --once`. That skill makes the worktrees it works in, and its rules hold as
written. Keep the prompt this small:

> Run step <step>/<of> of the loop plan: `/omni:<skill> <prd>` (`--once` after `pr-care`), to its
> end. When it offers to take the outbox's answers here, choose **Later — stop here**. Never run
> `omni loop push` or `omni roadmap push`: the loop records the tick. Return the skill's one-line
> result, the sub-PRs it merged and the outbox items it opened.

One skill per step agent, never two. The loop never answers the outbox: the next tick parks the PRD
on its questions. Keep, for each step agent, its step, PRD and skill; when it returns, keep its
one-line result, the sub-PRs it merged and the outbox items it opened for step 4 (an agent that
returns nothing usable has the result `no result`). Only this session, the loop's, writes the loop
record and the roadmap: never a step agent.

When `steps` is empty, run nothing.

Then, for every PRD in `prds` whose verdict is `park`, and that this session has not parked yet for
that same `why`, **park** it. A park's `why` reads `waits on <who>: <what>`:

1. Write it on the PRD's feature PR's status comment. `omni care state <prd>` names the feature PR
   (`pr.number`); exit 1 means it has none yet (a phase-0 PR still open): skip this item. Otherwise
   rewrite the status comment with `/omni:pr`'s **The status comment** recipe, keeping its lines,
   and add or replace one line, `- loop: parked · <why> · <link>`.
2. Send it to the Loop page:

   ```bash
   node .omni-loop/bin/omni.mjs loop push park --prd <prd> --who "<who>" --what "<what>" [--link <link>]
   ```

   Exit 1 is one line: print it and carry on.

**A PRD born on the server** (◆, its spec saying `phase0: server`) is approved on its PRD page, not
by a phase-0 PR, and `omni next` reads its approval for you. Waiting for approval, it parks the way
an open phase-0 PR parks a ◇ PRD: `why` is `waits on a reviewer: the PRD waits for approval on its
page`, and `link` is its dossier link, which both park items carry. Drifted from its approval
(`≠ <file> · … · ✗ refuse · restore it, or approve again: <link>`) or refused (`approver <login> is
not a workspace member`, `refused (<status>)`), it parks on a person, its `why` carrying those
lines. Its approval unanswered (`server unreachable · held, not failed`) is a `wait`, never a park
and never a failure: a later tick reads it again. Never approve one: a workspace member does, on its
page.

**Held.** Under `--roadmap`, only the entries of `held` that carry a `gate` are the roadmap's, and
only they are parked or held here; the pool's entries (no `gate`) are steps kept back for this tick,
which step 4 lists and a later tick launches. For every gated entry this session has not sent yet
for that same `why`, a `park` gate is parked as above. A `hold` gate holds only that PRD's first step
while every other step runs, and the PR it waits on is named in two places:

1. The Loop page: `node .omni-loop/bin/omni.mjs loop push park --prd <held prd> --who "<who>" --what "<what>" --link <link>`,
   splitting its `why` (`waits on <who>: <what>`) as a park's. Exit 1 is one line: carry on.
2. The held PRD's issue, one comment with the `why` and its link:
   `gh issue comment <held prd> --body-file <file>`. Comments are never signed.

The roadmap's page gets the same line from step 4.

## 4. Record the tick

The PRD's page is the link `omni dossier link <prd>` prints; when it prints `none` or cannot reach
the app, it is the PRD's issue on GitHub (`https://github.com/<repo.slug>/issues/<prd>`).

Record one tick per step launched in step 3, and one per step that finished since the last tick (a
step agent of this session that returned), each with its own step and PRD:

```bash
node .omni-loop/bin/omni.mjs loop push tick --step <step> --steps <of> --prd <prd> \
  --action <word> --result "<one line>" --link <the PRD's page> \
  [--merged <pr,…>] [--items <id,…>] --wake-in <seconds>
```

- `--action` is the skill's first word (`wave`, `yolo`, `yolo-fix`, `pr-care`), or `wait`.
- `--result` starts with what happened: `launched` for a step launched, the skill's one-line result
  for a step that finished. Then come the pool's lines, each after ` · `: `running: ` and every
  entry of `running` and every step agent still running, `step <step> PRD <prd> <kind>` each, comma
  separated, followed by `in <repositories>` when the step names them; then `held: ` and every
  `why` of `held`, separated by `; `. Leave out a list that is empty. The command keeps a line to
  300 characters.
- `--merged` and `--items` name the sub-PRs the step merged and the outbox items it opened, on the
  tick of a step that finished; leave them out when there are none.
- `--wake-in` is when the loop looks again: 90 seconds after a tick that launched a step or recorded
  one that finished; otherwise `verdict`'s `wakeHint` when it waits (5 minutes on running CI, 20 on a
  claim another session holds), else 20 minutes; never more than 1200.

When the tick launched nothing and nothing finished, record one tick for `step`: `--action wait`
and `--result` the verdict's `why`, then the pool's lines as above.

A new plan version goes with the first tick recorded by itself. Exit 1 is one line (`no loop (omni
loop push start)` when the start was refused, `unreachable`, …): print it, and the tick still counts.

Under `--roadmap`, then send the roadmap's page where each PRD stands, the PR each held one waits
on included:

```bash
node .omni-loop/bin/omni.mjs roadmap push <n>
```

Exit 1 is one line (`off`, `no sign-in`, `github unreachable`, `unreachable` or `refused`): print it,
and the tick still counts. Then go to **Waking up**.

## 5. Stop

`stop` is `true` and nothing runs: every PRD driven is parked or done, `running` is empty and no
step agent of this session is still running, so nothing moves until a person acts. While a step
still runs, `stop` is no stop: record the tick as step 4 says and wait for it.

1. Park every PRD of `prds` whose verdict is `park` and that this session has not parked yet, as in
   step 3, and, under `--roadmap`, every gated entry of `held` not sent yet, then
   `node .omni-loop/bin/omni.mjs roadmap push <n>` once.
2. `node .omni-loop/bin/omni.mjs loop push stop`. Exit 1 is one line: print it.
3. Print what waits on whom, one line per PRD driven, in plan order, then end the loop:

   ```text
   loop stopped: nothing moves until a person acts
   PRD <n> — <verdict>: <why> — <link>
   ```

   Under `--roadmap`, then list each open prerequisite with its card's command, so the person
   knows what to do: run `node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix` once more and
   print each of its `waits on you` lines, under one line:

   ```text
   open prerequisites: each holds the PRDs it blocks until it is done
   ```

   None waits on you: leave both out.

   Someone starts it again with the same command once they acted; the next first tick plans anew.

## Waking up

**Claude Code.** Run as `/loop /omni:drive [<n>…] [--roadmap <n>]` with no interval, so the loop paces itself: end
each tick by scheduling the next `/loop` wake after the `--wake-in` seconds of step 4. A step agent
that returns wakes the session at once: take it as a tick, so its finish is recorded and its slot
filled, without waiting for the wake. A tick that stops (step 5), or that ends without a wake (step
1), schedules none, which ends the `/loop`. Under `/loop <interval>`, the interval wins: a tick that
wakes early takes its `wait` as it is.

Any other runner calls the skill again after the same delay, and runs each step as its own process
in its own worktree.

## Guardrails

- **Never merge into `repo.defaultBranch`,** and never mark a feature PR ready but through
  `/omni:yolo`: merging is a person's.
- **Never add `labels.outboxGo`,** and **never answer the outbox**: its questions are a person's,
  on the Omni page or the pull request. A PRD waiting on them parks.
- **Never push while a wave holds claims:** the skill a step agent runs keeps that rule
  (`/omni:pr-care` turns report-only), and this skill pushes nothing itself.
- **At most `limits.parallelSteps` steps at once,** each one `omni next` lists in `steps`, each in
  its own worktree: never a step it did not list because it could run, never two of one PRD.
- **Only the loop session writes the loop record and the roadmap:** a step agent never runs
  `omni loop push` or `omni roadmap push`.
- **Never drive another person's PRDs unasked:** with no number and no roadmap, only your own.
- **Never edit the loop plan by hand:** it is computed, and a new version comes only from
  `omni next`, with its reason.
