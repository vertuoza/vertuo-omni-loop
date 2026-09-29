---
prd: 549
title: mega-brainstorm — one plan across repositories, reviewed in one phase-0
blocked-by: none
spec: file
---

# mega-brainstorm: one plan across repositories, reviewed in one phase-0

**Date:** 2026-09-29 · **PRD:** #549 · **Series:** multi-repository mode, part 2 of 3 (after
PRD 522 mega-invade, before ultra-yolo) · **Touches:** the slice table's parser
(`kit/lib/inbox/territory.mjs`), `omni plan check`, `omni prd`, a new skill
`kit/plugin/skills/mega-brainstorm/`, and short paragraphs in `/omni:plan`, `/omni:yolo` and
`/omni:wave`. No migration, and no change to the galaxy app, the GitHub App or the game.

## Problem

PRD 522 made a **plan repository** (`vertuoza/vertuo-automation-plan`) know its **target
repositories**: the config's `plan.targets` lists each one with a role and where its knowledge
lives, and `omni targets` says whether that knowledge is current. But nothing can plan across
them yet. `/omni:brainstorm` designs for the checkout it runs in, and a plan's slice table has no
place to say that the quote-total API goes into `vertuo-backend-php` while the screen that shows it
goes into `vertuo-apps`. A territory is a path, and a path means nothing without its repository.

A PM who wants one feature across the back-end and the front-end would have to brainstorm it twice,
in two repositories, with two phase-0 pull requests nobody sees side by side.

## Solution

**1. The plan names a repository per slice.** In a plan repository (a config with a `plan`
section), `plan.md` carries two tables.

```markdown
## Repositories

| repo | role | read at | knowledge |
| --- | --- | --- | --- |
| vertuo-backend-php | back-end | 3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4 | imported (stale) |
| vertuo-apps | front-end | 9b01e44c2d7a3f5e8b6c1d0a9f8e7d6c5b4a3921 | own |

## Slices

| id | repo | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- | --- |
| s1 | vertuo-backend-php | the quote total is served | `src/Quote/` | — | 1 |
| s2 | vertuo-apps | the quote screen shows the total | `apps/quote/` | s1 | 2 |
| s3 | vertuo-apps | the empty quote says why | `apps/i18n/` | — | 1 |
```

- `repo` is the **short name** (the part after the `/`) of a repository in `plan.targets`, or of
  the plan repository itself (`repo.slug`), for a docs change the feature needs there.
- A territory is a path in that slice's repository.
- `## Repositories` has one row per repository a slice names: its `role` (the target's, or `plan`
  for the plan repository), `read at` (the full 40-character commit of the clone its territories
  were read at, or `—` for the plan repository), and `knowledge` (`own`, `imported`,
  `imported (stale)` or `none`, as `omni targets` read it at brainstorm time).
- Waves are **one numbering across every repository**. Two slices collide only when they share a
  repository and their territories meet. A slice that needs another repository's work first says so
  in `blocked by`, which works across repositories.

**2. `omni plan check` grades it.**

- In a plan repository it refuses, naming the field first:
  - a slice table without a `repo` column;
  - a `repo` that is neither a target's short name nor the plan repository's;
  - a short name two entries share (two owners with the same repository name);
  - a repository a slice names with no `## Repositories` row, and a row no slice names;
  - a `read at` that is not 40 hex characters on a target's row, or anything but `—` on the plan
    repository's row.
- Collisions are computed per repository: the same path in two repositories is not a collision.
- It prints each wave with the repository beside each slice
  (`wave 1: s1 (vertuo-backend-php), s3 (vertuo-apps)`), and the collision matrix per repository.
- **Outside a plan repository** it refuses a `repo` column
  (`a repo column needs a plan repository`) and a `## Repositories` table, and otherwise behaves
  exactly as today.

**3. `omni prd <n>` tells a multi-repository plan apart.** When the PRD's `plan.md` has a `repo`
column, `omni prd` prints one more line, `repos: <name>, <name>` (in `## Repositories` order);
it prints no such line otherwise. `/omni:yolo` and `/omni:wave` read it at their
step 0 and stop with one line, `PRD <n> spans repositories: /omni:ultra-yolo <n> builds it`, so
they never build a back-end slice inside the plan repository.

**4. `/omni:mega-brainstorm`.** A new plugin skill, run in a plan repository. It follows
`/omni:brainstorm` step for step (the same conversation, the same gate, the same signing, the same
files, the same phase-0 review), with these differences:

0. **Step 0.** `omni config`; with no `plan` section it stops in one line:
   `not a plan repository: run /omni:mega-invade first, or /omni:brainstorm for this repository alone`.
   Then the briefing and `/omni:dossier-open`, as today.
1. **Survey.** `omni targets --json`, printed as its table. A `stale` or `drifted` target is
   warned about, with `/omni:mega-invade --sync` suggested, never run. An `unreachable` target is
   left out and can hold no slice. It reads `plan.guide`, then each target's knowledge where it
   lives: an `own` target's from its clone, an `imported` target's from
   `<paths.knowledge>/repos/<name>/`, a `none` target's from the guide alone.
2. **Design.** The same classification and gate as `/omni:brainstorm`. Which repository does what is
   part of the design: asked and confirmed, never assumed.
3. **Clones.** A shallow, read-only clone of each repository the design touches, in the scratch
   folder, outside the plan repository; **nothing runs in a clone** (no install, no test, no script),
   as in `/omni:mega-invade`. Its head is the row's `read at`. A clone that fails leaves that
   repository out of the design, and the person is told.
4. **PRD issue and feature branch** in the plan repository, as today.
5. **Spec.** The same sections, plus `## Repositories`, one paragraph per repository: its role, what
   changes there, and which knowledge it was read from. **Risks** names every stale copy the design
   relied on, and what a merge publishes in each target: from that target's releasing form (own or
   imported), or `unknown: no knowledge base` for a `none` target.
6. **Before/after.** One page, grouped by repository.
7. **Commit, `omni check inbox`, push, `/omni:dossier-push`,** as today.
8. **Plan.** `/omni:plan`, whose new paragraph "In a plan repository" says how to fill the `repo`
   column and the `## Repositories` table; `omni plan check` must be green. The draft feature PR
   opens in the plan repository, its body listing the slices grouped by repository. It is the one
   pull request that closes the PRD, where ultra-yolo will hang each target's pull request and run
   its one gate.
9. **One mega phase-0.** An ordinary phase-0 PR in the plan repository, graded by `omni phase0`
   unchanged; no phase-0 in any target. Its body adds a **What lands where** table
   (`repo · role · slices · waves`) so each team finds its part.
10. **Hand-off.** The same three blocks; the last line is `/omni:ultra-yolo <n>`. While the kit has
   no ultra-yolo skill, the line just above it says
   `ultra-yolo is not in this kit yet: the plan waits in the inbox`.

It writes nothing in any target repository.

## Decisions

- **A new skill, `/omni:mega-brainstorm`,** beside `/omni:brainstorm`, as `/omni:mega-invade`
  sits beside `/omni:invade`. It names the brainstorm steps it keeps instead of copying them, so the
  two cannot drift on what they share.
- **A `repo` column, one slice table** (not one table per repository, not a `repo:` prefix inside
  each territory): a slice lives in exactly one repository, and blockers and waves read across one
  table.
- **One wave numbering across repositories.** Unrelated back-end and front-end slices share a wave;
  a cross-repository dependency is a `blocked by`. Ultra-yolo can run a wave across repositories at
  once.
- **A slice may name the plan repository itself,** for a docs change the feature needs there.
- **A bad target warns, it does not stop.** Stale and drifted targets are warned about and written
  into the spec's Risks; only an unreachable one cannot hold a slice.
- **Targets are read through a shallow clone in the scratch folder,** and its head is recorded as
  `read at`, so ultra-yolo can tell when a target moved since the plan was written.
- **The draft feature PR lives in the plan repository** and is the one that closes the PRD; no
  branch or pull request is opened in any target before ultra-yolo.
- **One phase-0, in the plan repository,** as PRD 522 fixed for the series.
- **The hand-off already names `/omni:ultra-yolo`,** so the next PRD does not reopen this skill.
- **`/omni:yolo` and `/omni:wave` refuse a multi-repository plan** until ultra-yolo exists, rather
  than building target slices in the plan repository.

## User stories

- As a PM in the plan repository, I run `/omni:mega-brainstorm` with one idea and get one PRD whose
  plan says which slice lands in the back-end and which in the front-end.
- As a reviewer, I open one phase-0 pull request and see what lands where, per repository, before
  any code exists.
- As a tech lead of the front-end, I find my repository's slices in the **What lands where** table
  and their territories in my repository's paths.
- As the same PM, when the back-end's imported copy is stale, I am told at the start and the spec's
  Risks says the design relied on it.
- As someone who runs `/omni:yolo` on that PRD by habit, I am told it spans repositories instead of
  getting back-end code in the plan repository.
- As the coming ultra-yolo, I read `omni prd <n>`'s `repos:` line and the plan's `## Repositories`
  `read at` to know where to cut each branch and whether a target moved.

## Scope

In:

- `kit/lib/inbox/territory.mjs`: `parsePlanSlices` reads an optional `repo` column (`repo: null`
  when absent) and a `## Repositories` table; `collisions` compares only slices of the same `repo`.
- `kit/bin/commands/plan.mjs`: the refusals and the per-repository output of point 2.
- `kit/lib/delivery/prd.mjs` and `kit/bin/commands/prd.mjs`: `repos` of point 3.
- `kit/plugin/skills/mega-brainstorm/SKILL.md` (new); its entry in `kit/lib/help/entries.mjs`.
- `kit/plugin/skills/plan/SKILL.md`: the "In a plan repository" paragraph.
- `kit/plugin/skills/yolo/SKILL.md` and `kit/plugin/skills/wave/SKILL.md`: the step-0 stop of
  point 3.
- `docs/guide/invade.md`: its plan-repository section names `/omni:mega-brainstorm`.
- `kit/dist/`: rebuilt.

Out:

- ultra-yolo: branches and pull requests in each target, the one gate on the plan repository's
  PRD. The next PRD.
- Writing anything in a target repository, or running anything in a clone.
- `omni phase0`: unchanged; the plan repository's phase-0 is already docs-only.
- The Omni app, its dossier pages and the game: they read the PRD as they read any other.
- Acceptance scenarios: `acceptance.enabled` is off in this repository.

## Test seams

Every test runs on fixtures; none calls GitHub or Supabase (`omni kb show testing` › Never).
Commands are tested through `main()` on a fixture repository (`makeRepo()` in
`kit/test/fixture.mjs`), with a `plan` section in its config where the case needs one.

- **Parser (unit, `kit/lib/inbox/territory.test.mjs`):** a table with a `repo` column parses each
  slice's `repo`; a table without it parses `repo: null` exactly as today; the `## Repositories`
  rows parse; the same territory in two repositories is no collision, in one repository it is.
- **`omni plan check` (command):** in a plan repository, each refusal of point 2, named field first;
  a valid multi-repository plan passes and prints each wave with its repositories; outside a plan
  repository a `repo` column and a `## Repositories` table are refused, and every existing plan
  test passes unchanged.
- **`omni prd` (command):** the `repos:` line printed for a multi-repository plan, and no such
  line otherwise, every other line unchanged.
- **Skills (`kit/test/plugin.test.mjs`):** the new skill parses, names only commands the CLI has,
  and follows the signing and footer rules (ADR-0042); the edited `/omni:plan`, `/omni:yolo` and
  `/omni:wave` keep passing it.
- **Help:** `omni help mega-brainstorm` and `omni help /omni:mega-brainstorm` print its entry.
- **Bundle:** `kit/dist/omni.mjs` rebuilt; `kit/test/dist.test.mjs` passes.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the kit. The root package's bin and the
  plugin marketplace hand out the new parser rules, the `repos` field and the new skill on the next
  release (`v0.0.N`). Rollback: revert the merge; the next release hands out the kit without them.
  A multi-repository plan written in between would then be read as an ordinary plan with an
  unknown column, so `/omni:yolo` would no longer stop on it: whoever reverts says so on the PRD.
- **Every existing plan must grade the same.** A plan without a `repo` column parses exactly as
  today, in every repository; the existing plan, board and wave tests guard it.
- **Clones read at one commit.** A target that moves after the brainstorm makes territories stale;
  `read at` records the commit so ultra-yolo can detect it, and this PRD does not re-read.
- **Proof on a real plan repository is owed.** Tests run on fixtures; a first live run in
  `vertuoza/vertuo-automation-plan` follows the merge, after PRD 522's own live run.

## Acceptance criteria

- In a plan repository, a `plan.md` whose slices each name a target or the plan repository, with a
  `## Repositories` row for each, passes `omni plan check`, which prints each wave with the
  repository beside each slice.
- In a plan repository, `omni plan check` refuses, field first: no `repo` column; an unknown
  `repo`; a short name two entries share; a repository with slices and no row; a row with no slice;
  a malformed `read at`.
- The same territory in two repositories is not a collision; in one repository and one wave it is
  refused as today.
- A slice in wave 2 blocked by a slice of another repository in wave 1 passes; the reverse is
  refused as today.
- Outside a plan repository, a plan without a `repo` column grades exactly as today, and a plan
  with one is refused with `a repo column needs a plan repository`.
- `omni prd <n>` prints `repos:` for a multi-repository plan, and `/omni:yolo` and `/omni:wave`
  stop on it with `PRD <n> spans repositories: /omni:ultra-yolo <n> builds it`.
- `/omni:mega-brainstorm` in a repository without a `plan` section stops with the one line of
  point 4, step 0.
- `/omni:mega-brainstorm` in a plan repository ends with a PRD issue, a spec with a
  `## Repositories` section, a before/after page grouped by repository, a graded multi-repository
  `plan.md`, a draft feature PR and one phase-0 PR, all in the plan repository, a **What lands
  where** table in the phase-0 body, and `/omni:ultra-yolo <n>` as its last line; it writes nothing
  in any target and runs nothing in any clone.
- `omni help mega-brainstorm` prints its entry, and `pnpm test` is green.
