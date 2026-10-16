---
name: mega-drive
description: Drives a plan repository's multi-repository PRDs as a rolling pool of up to limits.parallelSteps steps at once, run as /omni:mega-drive [<n>…] on a loop, or a roadmap's PRDs with --roadmap <n> — /omni:drive for a plan repository, step for step. Its first tick orders every slice of the PRDs driven into a loop plan whose steps collide only on a path in the same repository (omni next --plan) and opens the loop on the Loop page; every tick it reads the steps that share no ground with what runs (omni next --json) and starts one agent per step, each in its own worktree with its PRD's own target clones, running that step's one skill, /omni:ultra-wave, /omni:ultra-yolo, /omni:ultra-yolo-fix or /omni:mega-pr-care --once, parks a PRD that waits on a person on its plan PR's status comment naming each open PR by repository, records a tick per step launched and per step finished with the repositories it touches and what runs and is held, under --roadmap checks the roadmap's prerequisites with omni roadmap prereqs --fix on the first tick and before a PRD one holds starts and pushes the roadmap, and sets the next wake; once nothing runs and every PRD is parked or done it stops itself, listing each open prerequisite with its command. A product PRD named by its id (<key>-<n>) is driven from any kitted checkout of its product, beside the loop plan — parked while it waits for approval or is drifted, held while the server is unreachable, built by /omni:ultra-yolo once approved, with no plan PR. Outside a plan repository it prints the /omni:drive line. Never merges into any repository's default branch, never answers the outbox. Triggers on "drive the plan repository", "drive my PRDs across the repositories", "run the loop across repositories", "/omni:mega-drive".
---

# Mega drive: a pool of loop plan steps, across repositories

A **plan repository** (its config has a `plan` section) holds the PRDs; its **target repositories**
hold the code. This skill drives those PRDs as `/omni:drive` drives a repository's own: a rolling pool of up
to `limits.parallelSteps` steps, a frozen loop plan, the Loop page, the self-stop. Each step it
launches runs one of the skills that build across repositories, in its own worktree with its PRD's
own target clones, and each says which repositories it touched.

It follows `/omni:drive` **step for step**, and never copies it: each step below either says "as
`/omni:drive` step N" and adds only what differs, or is new. Read `/omni:drive` alongside it; where
the two say the same thing, that skill's words are the rule.

`omni` below is `node .omni-loop/bin/omni.mjs`, always run in the plan repository. Never import the
kit, and never name a path, label, branch shape or command you can read with `omni config <key>`.

This skill is one **tick**. Something runs this tick again after the wait it names (in Claude:
`/loop /omni:mega-drive`, with no interval; **Waking up**, at the end, is the only part that is
Claude Code's). Everything else is the kit's,
and any runner that calls `omni next` and `omni loop push` the same way drives the loop the same way.

**Signing,** as `/omni:drive`: this skill commits nothing and opens no pull request or issue. The
skill a step agent runs signs its own commits and bodies with `omni sign trailer` and `omni sign footer`,
in whichever repository it writes, as its own steps say. The status comment it rewrites is a comment,
and comments are never signed.

**Nothing runs in a target from here.** This skill runs no command in a target repository: the
skill a step agent runs works there under its own rules (a target's own committed setup, then its own
committed preflight, nothing from an imported copy's playbook).

## Input

| input | example | what it is |
|---|---|---|
| nothing | `/omni:mega-drive` | drive your own multi-repository PRDs in inbox, building or outbox, as `omni status` marks them |
| PRD numbers | `/omni:mega-drive 1201 1213` | drive these PRDs, someone else's included: naming them is the ask |
| `--roadmap <key>-R<n>` | `/omni:mega-drive --roadmap mobile-R3` | drive a product roadmap's PRDs, read from the server: **From a product roadmap** below |
| `--roadmap <n>` | `/omni:mega-drive --roadmap 1170` | drive exactly roadmap n's PRDs, someone else's included, each held until its blockers' plan PR and every target PR merged. Name no PRD beside it |

Each runs as a loop, this tick again after the wait it names (in Claude: `/loop` before it, as
`/loop /omni:mega-drive --roadmap 1170`). Below, `[--roadmap <n>]` means: pass `--roadmap <n>` when
the loop was asked for one, and nothing otherwise.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON,
as `/omni:drive` step 0 keeps it, and its `plan` section. A product PRD's id among the arguments
(`<key>-<n>`, as `mobile-12`), or a product roadmap's id (`--roadmap <key>-R<n>`), is driven as **From a product** and **From a product roadmap** below say, a plan section or not.
Without a `plan` section (its
`plan.targets`) and with no product PRD's id among the arguments, this is a repository of its own:
stop with exactly one line, the arguments it was given carried over, and no wake:

```text
not a plan repository: /omni:drive [<n>…] [--roadmap <n>] (in Claude: /loop /omni:drive)
```

Then print the briefing, `node .omni-loop/bin/omni.mjs session start`, as `/omni:drive` step 0.

## From a product (`<key>-<n>`)

A **product PRD** (◆, PRD 1548) has no plan repository and no plan PR: its plan and its outbox are
on the Omni page, and its code lands as one `Part of <key>-<n>` target feature PR per target (see
`/omni:ultra-yolo`'s **From a product**). It is driven only when named,
`/omni:mega-drive mobile-12` (in Claude: `/loop /omni:mega-drive mobile-12`), from any kitted
checkout of a repository the product holds.
`omni next`, `omni care state` and `omni loop push` read a repository's PRD numbers only: a product
PRD is never passed to them, gets no step of the loop plan, and is driven beside it, at most one step
agent per product PRD, inside `limits.parallelSteps` with the others. Numbers given beside it are
driven as written.

**Each tick,** for each product PRD named, read where it stands first:

```bash
node .omni-loop/bin/omni.mjs prd <key>-<n>
```

| `state:` | the tick |
|---|---|
| `prd` | **parks** it: `waits on a reviewer: the PRD waits for approval on its page`, its link the `page:` line. A tick never waits on an approval |
| `drifted` or `refused` | **parks** it on a person, its `why` carrying the `approval:` lines: no step is launched while it is drifted |
| `unreachable` | a `wait`, never a park and never a failure (`server unreachable · held, not failed`): a later tick reads it again |
| `inbox` | while no step agent of this session runs it, launches one, as step 3 launches a step: `/omni:ultra-yolo <key>-<n>` until every target feature PR is ready, then `/omni:mega-pr-care <key>-<n> --once` each tick until each is merged or closed |

The target feature PRs are read with
`gh pr list --repo <slug> --head <feature branch> --state all --json number,state,isDraft,url`,
for each target of the plan (`node .omni-loop/bin/omni.mjs dossier get <key>-<n> plan`). An
`/omni:ultra-yolo` that returned on a red gate **parks** the PRD on a person,
`waits on answers on <product> › Questions`; one that returned held is a `wait`. The park is written
on no plan PR and sent to no Loop page: it is printed in the tick's line, and in step 5's list, one
line per product PRD naming each open target PR by repository.

When every PRD named is a product PRD, step 1 opens no loop plan and step 4 records no tick: the
tick prints its lines and sets its wake as **Waking up** says. Step 5 stops once each is parked or
done and no step agent of this session runs it.

## From a product roadmap (`--roadmap <key>-R<n>`)

A product roadmap (`mobile-R3`, PRD 2011) is on the Omni page and in no repository, and its PRDs are
product PRDs. `/omni:mega-drive --roadmap mobile-R3` drives it exactly as `/omni:drive`'s **From a
product roadmap** does, from any kitted checkout of a repository the product holds, a plan
repository or not: each tick it reads the rows with
`node .omni-loop/bin/omni.mjs dossier get <key>-R<n> roadmap`, drives each row's PRD as **From a
product** above drives a product PRD, holds a blocked row until every target feature PR of its
blockers' PRDs merged (naming the first still open, by repository), and records no tick on the Loop
page and pushes no roadmap with `omni roadmap push <n>`. Step 0 does not stop on the missing `plan`
section for it.

## 1. Open or resume the loop

As `/omni:drive` step 1, the same `loop status` table, `loop push start` and its one-line failures.
The plan is made by:

```bash
node .omni-loop/bin/omni.mjs next --plan [<n>…] [--roadmap <n>]
```

In a plan repository it orders the steps per repository: two steps go in series only when their
slices touch the same path **in the same repository**, the reason naming it
(`1213 s2 after 1201 s3: both touch crew:apps/crew-api/`); a crew step and an ai-domain step never
hold each other. Each step names the repositories it touches (`· in crew, ai-domain`). Print the plan
as it comes.

**The prerequisites,** under `--roadmap`, as `/omni:drive` step 1 checks them on the first tick, in
the plan repository:

```bash
node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix
```

It runs in the plan repository's checkout, never in a target or a clone; a row naming targets in its
`repos` cell is checked by the command it holds, which only reads. Exit `1` is not a failure.

## 2. Read the step

As `/omni:drive` step 2, its **Before a held PRD starts** included: when the last `next --json`
held a PRD with `waits on prerequisite <id> (<category>): <need>`, run
`node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix` again first, in the plan repository. Then:

```bash
node .omni-loop/bin/omni.mjs next --json [--roadmap <n>]
```

It reads, for each PRD, its phase-0 PR, its **plan PR** (the plan repository's feature PR), each
**target feature PR** its plan names, the board across every repository and the outbox in the plan
repository. The document has `/omni:drive`'s fields, and more:

| field | what it adds |
|---|---|
| `step.repos` | the short names of the repositories the step touches |
| `repos` | on each verdict of `prds`, the repositories that PRD's plan lands in |
| `steps` | as in `/omni:drive`, each entry with its `repos`. Two steps that touch the same path in two different repositories are both offered; the same path in one repository, never |
| `running` | as in `/omni:drive`, each entry with its `repos`. A PRD runs a step while a slice holds a live claim in any repository, or while its plan PR or a target PR carries the in-progress label with a fresh status comment |
| `held` | as in `/omni:drive`: under `--roadmap` the roadmap's entries first, each with its `gate`, then the pool's entries with none. A blocker in a plan repository stops blocking once its plan PR and every target PR merged; until then the held PRD's `why` names the first of its PRs still open, by repository (`waits on crew#40 (p3 Invoices): CI red`). A pool entry's `why` names the path by repository (`crew:apps/crew-api/ shared with step 4 (PRD 12 w1, running)`) |

`limits.parallelSteps` is the size of the pool, as in `/omni:drive`. Print the lines `/omni:drive`
step 2 prints, each step's ending with ` · in <repos>`. Never pick another step than the ones
`steps` lists.

## 3. Act on it

**Launch,** as `/omni:drive` step 3's **Launch**. While a step agent of this session runs a step
`running` does not list yet, launch nothing. Otherwise start
one agent per entry of `steps` whose PRD has no step agent of this session still running, each in
its own worktree, all at once (in Claude: one message with several Agent calls, each
`isolation: "worktree"`, in the background), so its commits in the plan repository (the
plan PR's branch, the outbox it relays into) happen in its own worktree, never in the loop's
checkout. Each runs its entry's one
skill, `verdict.skill`: `/omni:ultra-wave <prd>`, `/omni:ultra-yolo <prd>` (which also plans a PRD
that has no plan yet), `/omni:ultra-yolo-fix <prd>`, or `/omni:mega-pr-care <prd> --once`. That
skill makes the clones and worktrees it works in, and its rules hold as written. The prompt is
`/omni:drive`'s, and the result each agent returns names its sub-PRs merged in every repository and
the outbox items it opened or relayed.

**Each PRD has its own target clones,** at `<worktrees>/targets/<name>@<prd>`, where every skill
that builds across repositories makes and reads them, so no two running steps share a clone's HEAD.
`<worktrees>` is `omni config worktrees` taken from the plan repository's main checkout (the folder
holding `git rev-parse --path-format=absolute --git-common-dir`), so each step of one PRD, in
whichever worktree it runs, finds the same clones.

`omni next` in a plan repository returns no other skill. One skill per step agent, never two. When
`/omni:ultra-yolo` offers to take the outbox's answers here, choose **Later — stop here**, as in
`/omni:drive`. Only this session, the loop's, writes the loop record and the roadmap,
never a step agent. When `steps` is empty, run nothing.

Then **park** every PRD of `prds` whose verdict is `park`, as `/omni:drive` step 3 parks it, with
one difference: the park is written on the **plan PR's status comment**. `omni care state <prd>`
names the plan PR (`pr.number`); exit 1 means it has none yet (a phase-0 PR still open): skip that
item. The `why` names each pull request still open **by repository** (`crew#40`, `ai-domain#12`),
as `omni next` wrote it; keep it as it is. Then:

```bash
node .omni-loop/bin/omni.mjs loop push park --prd <prd> --who "<who>" --what "<what>" [--link <link>]
```

**Held,** under `--roadmap`: as `/omni:drive` step 3's **Held**,
only the entries of `held` that carry a `gate`, the PRD's issue being the plan repository's. The
pool's entries are never parked.

## 4. Record the tick

As `/omni:drive` step 4: one tick per step launched, and one per step that finished since the
last tick, each with the repositories its step touches:

```bash
node .omni-loop/bin/omni.mjs loop push tick --step <step> --steps <of> --prd <prd> \
  --action <word> --result "<one line>" --link <the PRD's page> \
  [--merged <pr,…>] [--items <id,…>] --repos <repo,…> --wake-in <seconds>
```

- `--action` is the skill's first word: `ultra-wave`, `ultra-yolo`, `ultra-yolo-fix`,
  `mega-pr-care`, or `wait`.
- `--repos` is `step.repos`, joined with commas; leave it out when the step has none, and the
  command sends the ones the kept plan gives the step.
- `--result` is `/omni:drive`'s: `launched` or the skill's one-line result, then `running: ` with
  each running step and the repositories it runs in (`step 4 PRD 12 ultra-wave in crew, ai-domain`),
  then `held: ` with every `why` of `held`, each naming its path by repository.
- `--merged` names the sub-PRs merged by their numbers alone, in whichever repository: `--repos`
  says where. `--items` names the items opened or relayed into the plan repository's outbox.
- A tick that launched nothing and recorded no finish records one tick for `step`, `--action wait`,
  as `/omni:drive` does.

Exit 1 is one line: print it, and the tick still counts. Under `--roadmap`, then:

```bash
node .omni-loop/bin/omni.mjs roadmap push <n>
```

Exit 1 is one line: print it, and the tick still counts. Then go to **Waking up**.

## 5. Stop

As `/omni:drive` step 5, once `stop` is `true` and nothing runs (`running` empty, no step agent of
this session still running): park what is not parked yet (on the plan PR's status comment), under
`--roadmap` send the gated entries of `held` and run `node .omni-loop/bin/omni.mjs roadmap push <n>` once, then
`node .omni-loop/bin/omni.mjs loop push stop`, and print what waits on whom, one line per PRD, each
naming its open pull requests by repository. Under `--roadmap`, then each open prerequisite with its
card's command and the repositories it concerns, as `/omni:drive` step 5 lists them from one more
`node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix`. Someone starts it again with the same
command once they acted.

## Waking up

Run this tick again after the wait it names: end each tick by scheduling the next one after the
`--wake-in` seconds of step 4, as `/omni:drive` does (in Claude: run as
`/loop /omni:mega-drive [<n>…] [--roadmap <n>]` with no interval, so the loop paces itself, and
schedule the next `/loop` wake); a step agent that returns wakes the session at once, as there. A
tick that stops, or that ends without a wake, schedules none, which ends the loop.

Any other runner calls the skill again after the same delay.

## Guardrails

- **Never merge into any repository's default branch,** the plan repository's or a target's, and
  never mark a pull request ready but through `/omni:ultra-yolo`: merging is a person's.
- **Never add `labels.outboxGo`,** in any repository, and **never answer the outbox**: its
  questions are a person's, on the Omni page or the plan PR. A PRD waiting on them parks.
- **Never push while a wave holds claims:** the skill a step agent runs keeps that rule in each target
  (`/omni:mega-pr-care` turns report-only there), and this skill pushes nothing itself.
- **Never run the single-repository skills here:** `omni next` returns only the `ultra-` skills and
  `mega-pr-care --once` in a plan repository.
- **At most `limits.parallelSteps` steps at once,** each one `omni next` lists in `steps`, each in
  its own worktree with its PRD's own target clones: never a step it did not list because it could
  run, never two of one PRD.
- **Only the loop session writes the loop record and the roadmap:** a step agent never runs
  `omni loop push` or `omni roadmap push`.
- **Never drive another person's PRDs unasked:** with no number and no roadmap, only your own.
- **Never edit the loop plan by hand:** it is computed, and a new version comes only from
  `omni next`, with its reason.
