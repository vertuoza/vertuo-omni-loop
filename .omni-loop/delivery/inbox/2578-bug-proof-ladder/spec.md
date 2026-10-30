---
prd: 2578
title: A bug fix proves its change before and after
blocked-by: none
spec: file
phase0: server
---

## Problem

`/omni:bug-fix` proves a fix with a GIF of its red and its green (PRD 1972, PRD 2100): two outputs of
the reproduction, run on the machine that made the fix. That works when the reproduction runs there.
It fails when it cannot, and the person who reviews the pull request then gets no before/after at all.

A runner fixing a bug in nimbus-web, a front-end repository, shows the whole chain. Its reproduction
is a component story, and nimbus-web runs stories in CI only. So step 7 writes
`Red not proven here — <why>; CI is the proof` and goes on, and step 12.4 turns that into
`GIF not produced` and opens the pull request as a draft. nimbus-web's CI skips its story job on a
draft. The red was deferred to a CI run that never happens, and nobody ever sees the bug or the fix,
neither on a screen nor in a log. The pull request waits for a person to prove by hand what the
agent claimed.

Three things the kit has, or could have, are not used:

- **A preview environment.** Many repositories build one per pull request. Filming the screen there
  before and after the fix is the proof a reviewer trusts most, and the kit cannot reach one: how to
  create it, sign in and tear it down is each repository's own business.
- **The CI run itself.** `/omni:mega-bug-fix` already takes a failing CI run as its red ("push the
  reproduction alone, open the draft PR, and the red is the failing CI run's link"); `/omni:bug-fix`
  takes one only through `commands.smoke`, and neither turns the run into a before/after.
- **The repository's own practice.** A repository plugs its review and reproduction habits into a
  slice through flow hooks (PRD 1089), at `do-work.start` and `do-work.review`. A bug fix fires
  `pr.open` only, so none of those hooks ever runs on a bug fix.

## Solution

**A proof ladder.** At step 12.4, `/omni:bug-fix` takes its proof from the first level that works,
and the pull request says which one it reached:

| level | where red and green are seen | what `## Proof` shows |
|---|---|---|
| A | on a preview environment, through the repository's `bug-fix.proof` hook | a GIF of the hook's two recordings, and the environment's link |
| B | in CI: a run on the reproduction commit alone (red), then on the fix commit (green) | a GIF of the two log excerpts, and each run's link |
| C | on the machine that made the fix, as today | a GIF of the two outputs |
| D | nowhere | `GIF not produced - A: <why>; B: <why>; C: <why>`, the pull request left a draft |

Levels B and C prove the reproduction test, not what a person sees: their `Proved on` line says so.
A repository with no hook gets B, then C, then D: that is every repository's default proof.

**The pull request opens earlier.** Levels A and B need a pull request that exists: a preview
environment is built from it, and CI runs on it. So `/omni:bug-fix` takes `/omni:mega-bug-fix`'s order:
the reproduction is committed and pushed alone, the pull request opens as a draft, the fix is pushed
on top, then the proof is made and the body completed. The proof check (`omni bug <n>`) moves from
before the pull request opens to before it is marked ready, reading the open pull request's body.

**Three flow points.** `/omni:bug-fix` and `/omni:mega-bug-fix` fire them; a repository plugs its own
markdown hooks there, as PRD 1089 lets it do at every other point:

| point | where it fires | modes | handed | a hook gives back |
|---|---|---|---|---|
| `bug-fix.reproduce` | step 7, before the reproduction is written | before, after | `issue`, `branch`, `suspect`, `boundary` | notes the skill reads to write its reproduction; the verdict |
| `bug-fix.review` | after step 9 (guard), before mutation | before, after | `issue`, `branch`, `base` | fixes it commits; the verdict |
| `bug-fix.proof` | step 12, once the draft pull request holds the fix | before, after, replace | `issue`, `base`, `head`, `pr`, `targets`, `reproduction`, `out` | `before.*` and `after.*` in `out`, an `env:` line; the verdict |

Every hook ends with the verdict line PRD 1089 reads: `omni-hook <point>: pass` or
`omni-hook <point>: fail <why>`. A failed hook never stops a fix:

- `bug-fix.reproduce` failing is one line in the pull request's **Reproduction** section. The red is
  always a test committed alone; a hook informs it and never replaces it, so the point allows no
  `replace`.
- `bug-fix.review` may commit fixes; the full preflight runs again after it, and a red one counts as
  an attempt (`limits.attempts`), as a fix does. Its failure is one line in the pull request.
- `bug-fix.proof` passing with two readable files is level A: the skill runs `omni bug film`, then
  `omni proof push --kind bug`, and writes the `env:` line in the body. Anything else (no hook, a
  `fail`, no verdict, a missing or unreadable file) is level A's reason, and the skill goes on to B.

**Level B is a command, `omni bug ci <n>`.** Handed the pull request, the reproduction commit, the fix
commit and the reproduction test's name, it reads the checks of both commits through `gh` and:

- proves the red when a check failed on the reproduction commit and its log names the test, and the
  green when that same check passed on the fix commit;
- writes `red.txt` and `green.txt` for `omni bug film`: the log lines around the test, masked as every
  log excerpt the kit writes, and the run's link;
- otherwise prints why on one line and exits 1: the check was skipped (it names the job, so the pull
  request can say which CI condition skipped it on a draft), no failed log names the test, every check
  passed on the reproduction commit, or the runs did not finish within `/omni:pr`'s CI wait.

The kit never edits a repository's CI and never marks a pull request ready to get a run.

**The body says where the proof comes from.** `## Proof` gains one line, which `omni bug` requires
with every GIF:

```markdown
- **Proved on:** a preview environment
- **Proved on:** CI · reproduction test only, the screen was not filmed
- **Proved on:** the machine that made the fix · reproduction test only, the screen was not filmed
```

Level A adds `- **Preview:** <url> · <lifetime>` from the hook's `env:` line.

**The preview environment lives with the pull request.** The hook creates it and says how long it
lives (`until the pull request closes`, a date, or `deleted`). No agent runs when a person merges or
closes the pull request, so the repository's own CI removes it on `pull_request: closed`. The kit
never creates or deletes an environment.

**`/omni:mega-bug-fix`.** In each target, `bug-fix.reproduce` and `bug-fix.review` fire with that
target's hooks, read from its default branch, as its `commands.smoke` is today. `bug-fix.proof` fires
once, in the target the triage names as the one where the bug shows, after every target's pull request
holds its fix: `targets` hands it every target's repository and pull request, so it can build one
environment holding them all. The record's pull request carries the proof; target pull requests stay
without one. When that target has no hook, mega keeps today's CI red per target, and the record's
`Proved on` line says the screen was not filmed.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | flow point | `bug-fix.reproduce`, `bug-fix.review`, `bug-fix.proof` | a point is `<skill>.<step>` after the base skill, and a mega variant fires the same point ← `kit/lib/flow/points.ts:3-4` |
| omni-loop | hook verdict | `omni-hook bug-fix.proof: pass` | ← `kit/lib/flow/verdict.ts:1-2` |
| omni-loop | CLI | `omni bug ci <n>` | no written convention: follows `omni bug film <n>` ← `kit/bin/omni.ts:130-131`, `kit/bin/commands/bug-film.ts` |
| omni-loop | kit module | `kit/lib/bug/ci.ts` | no written convention: follows `kit/lib/bug/film.ts` beside it |
| omni-loop | PR body | `- **Proved on:** …`, `- **Preview:** …` | no written convention: follows `- **Before the fix**` ← `kit/lib/bug/proof-body.ts:11-12` |
| omni-loop | CI files | `red.txt`, `green.txt` | ← the text cards of `filmKind` ← `kit/lib/bug/film.ts:33` |

## Decisions

- **The repository films, the kit orders.** Level A is a flow point, not a config section: how to
  create a preview environment, sign in and film it stays in the repository's hook, and no host's
  name enters the kit.
- **Named `bug-fix.*`.** The design said `bug.proof`; the catalog's rule names a point after its base
  skill, so the three points are `bug-fix.reproduce`, `bug-fix.review` and `bug-fix.proof`, and
  `/omni:mega-bug-fix` fires the same ones.
- **A hook's outcome is its verdict.** The design said `skipped <why>`; the kit already reads
  `pass` and `fail <why>` at every point, so `bug-fix.proof` uses them, and its `fail` hands down to B.
- **CI that skips drafts is detected and reported, never gamed.** Opening the pull request ready
  for its CI run was refused: ready means a person can review and merge, a pull request holding only
  a failing test is not that, and it would ask every reviewer for nothing. The skill goes down a
  level and names the CI condition to change.
- **One proof for a mega bug fix,** in the target where the bug shows, over every target's pull
  request: a bug across two repositories is seen only with both fixes deployed together.
- **The environment lives with the pull request,** removed by the repository's CI when it closes:
  a reviewer can open it, and the kit holds no teardown.
- **Two more points.** A repository's reproduction and review practice reaches a bug fix through
  `bug-fix.reproduce` and `bug-fix.review`, so the kit never depends on any plugin: a repository
  that uses one plugs it there.
- **The voice objected, and the objection was accepted.** persona:F-E Developer: "A CI red then green
  proves the test the agent wrote, not the bug the customer saw. If level B reads as strong as a
  filmed screen, I'll merge slop thinking I saw it fixed." So levels B and C say
  `reproduction test only, the screen was not filmed` on their `Proved on` line.
- **No proof video** for this PRD: it changes skills and the CLI, not a screen of the arcade.

## User stories

- As a person reviewing a bug fix, I see the bug and the fix on the product itself whenever my
  repository can build a preview environment, and I can open that environment until I close the
  pull request.
- As a person reviewing a bug fix in a repository without one, I still get a before/after from CI,
  and the pull request tells me it proves the test, not the screen.
- As a repository's maintainer, I plug how we reproduce, review and film a bug into three points,
  without changing the kit.
- As a person taking over a fix nobody could prove, I read in one line what each level answered,
  and which CI condition to change.

## Scope

In:

- `kit/lib/flow/points.ts`: the three points, their modes, inputs and outputs.
- `kit/lib/bug/ci.ts` and `omni bug ci <n>`: level B.
- `kit/lib/bug/proof-body.ts`: the `Proved on` line, its mention at B and C, and D's reasons.
- `kit/plugin/skills/bug-fix/SKILL.md`: the early draft pull request, the three points, the ladder.
- `kit/plugin/skills/mega-bug-fix/SKILL.md`: the points in each target, the one proof.
- `docs/guide/flow.md` (the three points) and `docs/guide/use-cases.md` › Fix a bug (the ladder), on nimbus, with a
  `bug-fix.proof` hook for a preview environment and the CI job that removes it on close.
- `kit/dist/`, rebuilt.

Out:

- Any repository's hooks, verification skills, CI conditions or preview environments: each
  repository writes its own.
- `/omni:visual-fix`, which has its own proof.
- A new config key: the points need none.

## Test seams

Tests sit beside the code, as `omni kb show testing` says; none calls GitHub.

- `kit/lib/flow/points.test.ts`: the catalog lists the three points with their skills, modes,
  inputs and outputs.
- `kit/lib/flow/schema.test.ts`: a config with `bug-fix.*` hooks reads; a `replace` at
  `bug-fix.reproduce` or `bug-fix.review` is refused, naming the point.
- `kit/lib/bug/ci.test.ts`: the pure rule on checks and logs: red proven, green proven, a skipped
  check named, no log naming the test, every check green on the reproduction, a secret masked in
  the excerpt.
- `kit/bin/bug.test.ts`: `omni bug ci` through `main()` on a fixture repository, with a fake `gh`,
  writes `red.txt` and `green.txt` or prints its one line and exits 1.
- `kit/lib/bug/proof-body.test.ts`: each level's body passes; a GIF without `Proved on`, a B or C
  line without its mention, and a D line without a reason per level are refused.
- `kit/test/plugin.test.ts` and the `mega-bug-fix-*.test.ts` files: the skills name the three points,
  the ladder's order and the early draft pull request.
- `kit/test/dist.test.ts`: the bundle is rebuilt.

## Risks

Merging publishes a kit release: two skills that open a bug fix's pull request earlier and look for
their proof on a ladder, one more CLI verb and a stricter proof check. Rollback: revert the merge;
fixes go back to today's GIF or `GIF not produced`, and hooks plugged at the new points stop firing.

- **`pr.open` hooks fire earlier.** A repository's `pr.open` hook now runs on a draft holding only
  the reproduction. A hook that expects the fix there sees none yet.
- **A slower fix.** Waiting for two CI runs adds their time to a bug fix; the wait is `/omni:pr`'s
  and never unbounded.
- **Pull requests already open.** The `Proved on` line is checked before ready, so a pull request
  opened on an older kit is graded by the new rule the next time it is marked ready.
- **A hook that lies.** A `bug-fix.proof` hook could film the wrong screen; its recordings are on the
  pull request for the reviewer to judge, as any proof is.

The Legal entries it touches:

- L-GDPR-2: a CI log excerpt could hold a secret; `omni bug ci` masks it before writing `red.txt`
  and `green.txt`, as every log excerpt the kit writes.
- L-AIACT-1: the proof is an agent's; the pull request stays signed as one.

The locked laws it touches:

- N-PRODUCT-15: unreviewed work reaches every user; nothing here merges, and the pull request is
  never marked ready to get a CI run. Changing it needs @pierrederval or @dervalp to approve the
  pull request on GitHub.

## Acceptance criteria

- With a `bug-fix.proof` hook that passes, the bug fix's pull request shows a GIF of the hook's
  recordings, `Proved on: a preview environment` and the `Preview` line.
- With no hook, and a CI that runs the reproduction on a draft, it shows a GIF of the failing and the
  passing CI excerpts with both runs' links, and `Proved on: CI · reproduction test only, the screen
  was not filmed`.
- With a CI that skips the reproduction's job on a draft, the skill goes on to the next level, and
  the pull request names the skipped job.
- With no level working, the pull request stays a draft with `GIF not produced - A: …; B: …; C: …`.
- `omni bug <n>` refuses a GIF proof without its `Proved on` line, and a B or C proof without its
  mention.
- A hook at `bug-fix.reproduce` and one at `bug-fix.review` run in a bug fix, and in each target of a
  mega bug fix; a failed one is a line in the pull request, and the fix goes on.
- A mega bug fix runs `bug-fix.proof` once, in the target where the bug shows, handed every target's
  pull request, and its record's pull request carries the proof.
- `omni flow show bug-fix.proof` prints the point, its modes and what it hands a hook.
