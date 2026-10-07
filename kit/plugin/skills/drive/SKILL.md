---
name: drive
description: Drives your PRDs one step per tick, run as /loop /omni:drive [<n>…] — on its first tick it orders every slice of the PRDs driven into a loop plan (omni next --plan) and opens the loop on the Loop page (omni loop push start); every tick it takes the first step not done (omni next --json) and runs that one skill, /omni:wave, /omni:yolo, /omni:yolo-fix or /omni:pr-care --once, or waits, parks a PRD that waits on a person on its feature PR's status comment, records the tick with omni loop push tick and sets the next wake; once every PRD is parked or done it stops itself, listing what waits on whom. A closed terminal resumes the same loop and plan. Never merges into the default branch, never answers the outbox. Triggers on "drive my PRDs", "run the loop", "keep building until it needs me", "/loop /omni:drive", "/omni:drive".
---

# Drive: one step of the loop plan per tick

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

This skill is one **tick**. Something runs it again and again: in Claude Code that is `/loop`
(**Waking up**, at the end, is the only part that is Claude Code's). Everything else is the kit's,
and any runner that calls `omni next` and `omni loop push` the same way drives the loop the same way.
Each tick takes exactly one step of a frozen **loop plan**, runs at most one skill, says what it did
on the Loop page, and picks when to look again. The loop ends itself once nothing can move without a
person.

**Signing.** This skill commits nothing and opens no pull request or issue: the skill a tick runs
signs its own commits and bodies with `omni sign trailer` and `omni sign footer`, as its own steps
say. The status comment it rewrites is a comment, and comments are never signed.

## Input

| input | example | what it is |
|---|---|---|
| nothing | `/loop /omni:drive` | drive your own PRDs in inbox, building or outbox, as `omni status` marks them |
| PRD numbers | `/loop /omni:drive 1017 1030` | drive these PRDs, someone else's included: naming them is the ask |

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON:
later steps read `repo.slug`, `repo.defaultBranch`, `labels.outboxGo` and `markers.prefix` from it.

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
| `silent`, driving the PRDs asked (or no number was given) | **resume**: the session that ran it died. Say `resuming <loopId>, plan v<version>`, and go to step 2: the same id and plan carry on |
| `live` or `sleeping` | another session is driving this checkout: say `a loop is <state> here (<loopId>); stop it with omni loop push stop, or wait until it reads silent`, and end without a wake |
| `silent`, driving other PRDs than the ones asked | **new loop** below, with `--take-over` on the start |
| `null`, `parked` or `stopped` | **new loop** below |

**New loop.** Order every slice of the PRDs driven into the loop plan, version 1, and print it to
the person as it comes, every order across PRDs with its reason:

```bash
node .omni-loop/bin/omni.mjs next --plan [<n>…]
```

Exit 2 is a refusal on one line (no PRD of yours is in inbox, building or outbox; it cannot tell
which PRDs are yours): print it and end without a wake. Then open the loop on the Loop page:

```bash
node .omni-loop/bin/omni.mjs loop push start [--take-over]
```

Exit 0 prints `start: <loopId> …`. Exit 1 is one line (`off`, `no sign-in (omni signin)`,
`unreachable`, `refused (<status>)`, or the loop already here): print it and **carry on**. The loop
runs the same without the page; its later pushes then each say so in one line.

## 2. Read the step

```bash
node .omni-loop/bin/omni.mjs next --json
```

With no number it follows the plan kept in this checkout. It writes nothing on GitHub; GitHub out of
reach is a `wait`, never a failure. It prints one document:

| field | what it says |
|---|---|
| `replanned` | `null`, or the one line of a new plan version, written because reality broke the plan (a slice went stuck, a slice was added, a PRD ended early). Print it as is |
| `stop` | `true` once every PRD driven is parked or done: go to **5. Stop** |
| `step` | the first step not done: `step` of `of`, its `prd`, its `kind`, its `wave` and `slices` |
| `verdict` | that step's verdict: `act` with its `skill`, or `wait` with its `wakeHint` in seconds; its `why`, and its `link` when it has one |
| `prds` | every PRD's own verdict, `park` and `done` ones included |

Never pick another step than `step`: the plan already chose, and a step it runs beside is one it
returns itself. Print one line: `step <step>/<of> · PRD <prd> · <verdict> <skill> · <why>`.

## 3. Act on it

| `verdict` | the tick |
|---|---|
| `act` | run `/omni:<skill> <prd>` to its end, from this checkout: `/omni:wave <prd>`, `/omni:yolo <prd>`, `/omni:yolo-fix <prd>`, or `/omni:pr-care <prd> --once`. That skill makes the worktrees it works in, and its rules hold as written |
| `wait` | run nothing |

One skill per tick, never two. When the skill offers to take the outbox's answers here (the
terminal door at the end of `/omni:yolo`'s red gate), choose **Later — stop here**: the loop never
answers the outbox; the next tick parks the PRD on its questions. From the skill's report keep its
one-line result, the sub-PRs it merged and the outbox items it opened.

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

## 4. Record the tick

The PRD's page is the link `omni dossier link <prd>` prints; when it prints `none` or cannot reach
the app, it is the PRD's issue on GitHub (`https://github.com/<repo.slug>/issues/<prd>`).

```bash
node .omni-loop/bin/omni.mjs loop push tick --step <step> --steps <of> --prd <prd> \
  --action <word> --result "<one line>" --link <the PRD's page> \
  [--merged <pr,…>] [--items <id,…>] --wake-in <seconds>
```

- `--action` is the skill's first word (`wave`, `yolo`, `yolo-fix`, `pr-care`), or `wait`.
- `--result` is the skill's one-line result, or the verdict's `why` for a `wait`.
- `--merged` and `--items` name the sub-PRs the skill merged and the outbox items it opened; leave
  them out when there are none.
- `--wake-in` is when the loop looks again: 90 seconds after an `act`; after a `wait`, its
  `wakeHint` (5 minutes on running CI, 20 on a claim another session holds), never more than 1200.

A new plan version goes with this tick by itself. Exit 1 is one line (`no loop (omni loop push
start)` when the start was refused, `unreachable`, …): print it, and the tick still counts. Then go
to **Waking up**.

## 5. Stop

`stop` is `true`: every PRD driven is parked or done, so nothing moves until a person acts.

1. Park every PRD of `prds` whose verdict is `park` and that this session has not parked yet, as in
   step 3.
2. `node .omni-loop/bin/omni.mjs loop push stop`. Exit 1 is one line: print it.
3. Print what waits on whom, one line per PRD driven, in plan order, then end the loop:

   ```text
   loop stopped: nothing moves until a person acts
   PRD <n> — <verdict>: <why> — <link>
   ```

   Someone starts it again with the same command once they acted; the next first tick plans anew.

## Waking up

**Claude Code.** Run as `/loop /omni:drive [<n>…]` with no interval, so the loop paces itself: end
each tick by scheduling the next `/loop` wake after the `--wake-in` seconds of step 4. A tick that
stops (step 5), or that ends without a wake (step 1), schedules none, which ends the `/loop`. Under
`/loop <interval>`, the interval wins: a tick that wakes early takes its `wait` as it is.

Any other runner calls the skill again after the same delay.

## Guardrails

- **Never merge into `repo.defaultBranch`,** and never mark a feature PR ready but through
  `/omni:yolo`: merging is a person's.
- **Never add `labels.outboxGo`,** and **never answer the outbox**: its questions are a person's,
  on the Omni page or the pull request. A PRD waiting on them parks.
- **Never push while a wave holds claims:** the skill a tick runs keeps that rule (`/omni:pr-care`
  turns report-only), and this skill pushes nothing itself.
- **One step per tick,** the one `omni next` returns: never a later one because it could run.
- **Never drive another person's PRDs unasked:** with no number, only your own.
- **Never edit the loop plan by hand:** it is computed, and a new version comes only from
  `omni next`, with its reason.
