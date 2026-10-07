---
prd: 1162
title: Roadmaps — a milestone as a set of PRDs, written in one sitting and driven to the end
blocked-by: none
spec: file
---

# Roadmaps

**Date:** 2026-10-07 · **PRD:** #1162 · **Touches:** `kit/lib/roadmap/` (new), `kit/bin/commands/roadmap.ts`
(new), `kit/lib/next/` and `kit/bin/commands/next.ts` (`--roadmap`, the plan repository, the named
blocker), `kit/lib/config.ts` (`readOnly` and `consumes` on a target), `kit/lib/inbox/plan-grade.ts`
(the `consumes` rule), the command index and `omni help`, `kit/plugin/skills/roadmap/`,
`kit/plugin/skills/mega-roadmap/` and `kit/plugin/skills/mega-drive/` (new),
`kit/plugin/skills/drive/SKILL.md` (`--roadmap`, refusing a plan repository),
`kit/plugin/skills/ultra-yolo/SKILL.md` (plans a PRD that has no plan),
`kit/plugin/skills/mega-pr-care/SKILL.md` (`--once`), `kit/lib/loop/` (the repositories of a step), `supabase/migrations/`
(one new migration), `apps/galaxy/app/api/roadmaps/` and `apps/galaxy/app/roadmaps/` (new),
`apps/galaxy/src/roadmap/` (new), `apps/galaxy/src/nav/sidebar.ts` and its tests, `docs/guide/` (one
page on roadmaps).
**Out of scope:** publishing a package between repositories before it lands on a default branch
(a consumer waits for its provider's merge instead), stacked feature branches (a blocked PRD starts
from the default branch once its blockers merged), merging into any default branch, answering the
outbox, estimating durations a person did not give.

## Problem

Large product work is a milestone delivered by many PRDs, often across several repositories. The
Vertuoza Crew plan is seven phases of about twenty-five items, each tagged with the repositories it
touches (crew, ai-domain, ux-research, workflow, ERP), with a done-when line per phase and eight
open questions, each naming the phase it blocks. Today, turning that plan into delivery means:

- **One brainstorm per PRD.** `/omni:brainstorm` and `/omni:mega-brainstorm` take one idea to one
  PRD, gated by a design conversation each: twenty-five conversations for decisions the plan
  already took.
- **Nothing holds the whole graph.** `blocked-by` is declared in each spec and nothing checks the
  set: no cycle check, no wave order across PRDs, no view of what the milestone needs next.
- **Drive stops at a repository's edge.** `omni next` returns `wave`, `yolo`, `yolo-fix` or
  `pr-care` only. In a plan repository it returns plain `yolo`, which then stops on the multi-
  repository PRD: nothing loops across repositories.
- **A wait says too little.** A blocked PRD's step reads "blocked by it until it ships", never which
  pull request a person must review or merge to move it.
- **Rules a plan repository cannot state.** A target nobody may change (`vertuo-backend-php`) and a
  package a consumer installs only once its provider merged (`@vertuoza/ai-sdk`) live in people's
  heads; `omni plan check` passes a plan that breaks either.
- **Omni has no place for it.** The app shows PRDs one by one; nothing shows a milestone, its order,
  and what blocks it.

## Solution

A **roadmap** is its own object: a milestone, optionally of one product, delivered by a set of
normal-sized PRDs ordered by their blockers. Four parts ship together.

### 1. The roadmap: `roadmap.md` and `omni roadmap`

A roadmap has an issue labelled `omni:roadmap`, whose number is its id, and a folder
`<paths.delivery>/inbox/roadmaps/<nnnn>-<topic>/` holding `roadmap.md`:

```markdown
---
roadmap: 1200
title: Vertuoza Crew — from skeleton to earned autonomy
milestone: A company grants its first mandate after a trial week.
product: Vertuoza Crew        # optional: one of the workspace's products, by name
target: 2027-03-31            # optional: a date a person gave
source: https://claude.ai/artifact/…   # where it was read from
---

## PRDs

| id | PRD | title | repos | blocked by | why | wave |
|---|---|---|---|---|---|---|
| P1.1 | #1201 | Crew API and worker skeleton | crew | – | – | 1 |
| P3.4 | #1213 | Stateless think endpoint | ai-domain | P1.1 | the endpoint is called by the worker | 2 |

## Open questions

| id | question | recommendation | blocks | kind |
|---|---|---|---|---|
| Q2 | … | … | P3.1, P3.2 | default |
| Q5 | … | … | P4.4 | person |
```

- `repos` exists only in a plan repository, and each value is a target's short name.
- `wave` is 1 with no blocker, else one more than the highest blocker's wave.
- `why` is required on every blocker: a roadmap never claims a dependency it cannot explain.
- `kind`: `default` runs on the recommendation, written into each blocked PRD's spec as a
  **Decision** marked "recommended default", accepted when a person merges the phase-0 PR; `person`
  parks the PRDs it blocks until a person answers it.

`omni roadmap check [<n>]` grades every roadmap of the inbox, or one, and refuses: a table that does
not parse, an id used twice, a blocker that is not a row, a cycle, a wave that does not follow its
blockers, a row whose PRD has no inbox folder or whose spec's `blocked-by` differs from the row's
blockers, a blocker without its `why`, a question blocking a row that does not exist; in a plan
repository also a repo outside `plan.targets`, a repo whose target is `readOnly`, and a PRD that
changes a provider while a PRD of an earlier or the same wave changes a target that `consumes` it.
`omni check inbox` runs it, so the inbox check covers roadmaps.

`omni roadmap push <n>` sends `roadmap.md` and each PRD's state to the roadmap's page, as `omni
dossier push` sends a spec: it never blocks, a 5-second limit and one token refresh, and a failure
prints one line (`off`, `no sign-in (omni signin)`, `unreachable`, `refused (<status>)`).

`omni roadmap answer <n> <question> "<answer>"` is how a person's answer reaches the repository's
side: it comments on the roadmap issue with a marker. The page's answer box writes the same comment.

### 2. `/omni:roadmap` and `/omni:mega-roadmap`: a roadmap in one sitting

`/omni:roadmap <source>` in a repository, `/omni:mega-roadmap <source>` in a plan repository
(`plan.targets` set). Each run in the wrong kind of repository prints the other's line and stops.
`<source>` is a page link, a file in the repository, or pasted text.

1. **Read the source.** Each item that delivers something becomes one PRD row; each phase's
   done-when becomes the acceptance criteria of the PRDs that finish it; each open question becomes
   an Open questions row. `/omni:mega-roadmap` also surveys the targets through `omni targets` and a
   shallow read-only clone of each, as `/omni:mega-brainstorm` does.
2. **One map, every answer in one message.** It shows the PRD table (blockers with their reasons,
   repos, waves), the questions with their kind, and every row the check would refuse; the person
   answers once, then nothing more is asked. Blockers are the narrowest the source justifies; only
   where the source says nothing finer does a PRD wait for the whole previous phase.
3. **Write every PRD,** each as its brainstorm writes it (issue, inbox folder, spec, before/after;
   the mega one's spec with its Repositories section), its `blocked-by` from the table. No plan:
   each PRD is planned when the loop reaches it, against the code that then exists.
4. **Open the roadmap issue,** write `roadmap.md`, run `omni roadmap check` and `omni check inbox`
   until green, open **one phase-0 PR** carrying the roadmap and every PRD folder (`omni phase0`
   proves it docs-only and signed), and run `omni roadmap push`.
5. **Hand off** with `/loop /omni:drive --roadmap <n>` or `/loop /omni:mega-drive --roadmap <n>`.

### 3. `/omni:mega-drive`: the loop across repositories

`/loop /omni:mega-drive [<n>…] [--roadmap <n>]` is `/omni:drive` for a plan repository, with or
without a roadmap: one step per tick, a frozen loop plan, the Loop page, the self-stop. It drives the
plan repository's multi-repository PRDs, your own by default, the ones named otherwise.

**What `omni next` reads in a plan repository,** for each PRD: its phase-0 PR and its **plan PR** (the
plan repository's feature PR), its **target feature PRs**, one per target its plan names (by the
target's branch, as `/omni:ultra-yolo` opens them, read through `gh` on each target), the board across
every repository (`buildBoard` already reads one `gh pr list` per target), the outbox in the plan
repository with its replies, and, once ready, each PR's care state (`omni care state --repo`).

**Its verdicts:**

| the step's PRD | verdict |
|---|---|
| any of its PRs ready, and red CI, a conflict or a review thread not handled, in any repository | `act mega-pr-care --once` |
| outbox gate red, and answers posted on the plan PR | `act ultra-yolo-fix` |
| no plan yet, or every slice merged with a target PR or the plan PR still draft | `act ultra-yolo` (plans, finishes each target, runs the gate, marks ready) |
| slices takeable in the step's wave, in any repository | `act ultra-wave` |
| CI running in any repository, or a claim held | `wait`, with a wake hint |
| phase-0 PR open, outbox questions open, or every PR ready and clean, waiting for merges | `park`, naming the PRs, by repository |
| the plan PR and every target PR merged or closed | `done` |

**Overlap per repository and path.** The loop plan puts two steps in series only when they touch the
same path **in the same repository**: a crew slice and an ai-domain slice never hold each other, and
the reason names both (`1213 s2 after 1201 s3: both touch crew:apps/crew-api/`). Claims are counted
per repository, as `/omni:ultra-wave` already claims them.

**The tick** follows `/omni:drive`'s steps with these skills: `/omni:ultra-wave <n>`,
`/omni:ultra-yolo <n>`, `/omni:ultra-yolo-fix <n>`, `/omni:mega-pr-care <n> --once` (which gains
`--once`, one round, as `/omni:pr-care` did). A park is written on the plan PR's status comment. The
Loop page shows the repositories each step touches. `omni loop push` carries them.

**Each command in its own place.** `omni next` in a plan repository never returns the
single-repository skills (today it returns `yolo`, which stalls). `/omni:drive` in a plan repository
prints the `/omni:mega-drive` line and stops; `/omni:mega-drive` in a repository without
`plan.targets` prints the `/omni:drive` line and stops.

### 4. `--roadmap <n>` on `/omni:drive` and `/omni:mega-drive`

`omni next --roadmap <n>` drives exactly the roadmap's PRDs, someone else's included.

- **A blocker stops blocking when its feature PR is merged** into the default branch; in a plan
  repository, when its plan PR and every target feature PR are merged. Until then the blocked PRD's
  first step is held, and every other step runs: nothing waits but what must.
- **A wait names its pull request.** A held step's `why` reads `waits on <repo>#<pr> (<id> <title>):
  <state>`, `<state>` one of `building wave <k>/<m>`, `outbox: <k> questions`, `CI red`, `ready,
  waiting for your merge`, or, in a plan repository, the first of its PRs still open. The same line
  goes to the Loop page, the roadmap's page and the held PRD's issue.
- **A PRD with no plan** is planned by its first step: `/omni:yolo` plans it, as today;
  `/omni:mega-drive` runs `/omni:ultra-yolo`, which gains the same step: a PRD with no plan is
  planned the way `/omni:mega-brainstorm` plans one, graded by `omni plan check`, before its first wave.
- **A `person` question** parks the PRDs it blocks, naming the question and the roadmap's page;
  once `omni roadmap answer` (or the page) answered it, the next tick takes them up.
- **A blocker closed without merging** parks its dependents: `blocker #<pr> closed unmerged: fix the
  roadmap`.
- Answered outbox questions take `yolo-fix` (or `ultra-yolo-fix`), as they already do.
- Each tick runs `omni roadmap push` after `omni loop push tick`, so the page stays current.

### 5. Two target rules for `omni plan check`

`plan.targets` entries gain two optional fields:

- `readOnly: true` — no slice, and no roadmap row, may name it. It may still be read, surveyed and
  imported.
- `consumes: [<target>, …]` — this target installs what those targets publish from their default
  branch. A plan whose slice in a consumer is blocked by a slice in a target it consumes is refused:
  the change cannot be installed before it merges, so it is its own earlier PRD.

### 6. Roadmaps in Omni

- A migration adds `roadmaps` (workspace, repository, number, title, milestone, optional
  `product_id`, optional target date, its source, the last pushed document) and `roadmap_prds` (one
  row per PRD: id, number, title, repos, blockers, wave, state, the PR it waits on, started and
  ended times). Only the security-definer RPC `roadmap_push()` writes them; workspace members read
  them.
- A **Roadmaps** entry in the sidebar's Work group, above PRDs, opens `/roadmaps`: every roadmap of
  the workspace, filterable by product, each with its milestone, its progress (PRDs merged of all)
  and what blocks it now.
- A roadmap's page `/roadmaps/<id>`: the milestone and its done-when, a **Gantt** with one row per
  PRD grouped by wave, an arrow from each blocker, a bar per PRD coloured by state (waiting, building,
  outbox, waiting for merge, merged), drawn on real dates once a PRD started and as a dashed
  projection after that from the median length of the roadmap's merged PRDs (none until one merged:
  then bars sit in wave columns without dates), the PR each held PRD waits on on its bar; in a plan
  repository each bar splits into one lane per repository. Below it, the open questions, with an
  answer box for `person` ones, and each PRD linking to its page.

## Decisions

- **One PRD for roadmaps, mega-roadmaps, drive across repositories and the page.** The person needs
  the whole chain at once.
- **A roadmap is its own object, never a huge PRD.** Each PRD stays the size one plan carries; a
  milestone is a set of them. One PRD with landings was rejected: unreviewable, and a landing cannot
  span phases across repositories.
- **Two pairs of commands**, the kit's `mega-` pattern: `/omni:roadmap` and `/omni:drive` in one
  repository, `/omni:mega-roadmap` and `/omni:mega-drive` in a plan repository. One file format, one
  check and one page serve both.
- **A blocker stops blocking when its feature PR merges** (the person's call), not when it is built:
  a dependent PRD builds on reviewed code from the default branch. Stacked branches leave the scope.
  Throughput comes from running every unblocked PRD in every repository meanwhile, and from naming
  the exact PR a person must merge.
- **Blockers are the narrowest the source justifies, each with its reason;** the whole previous
  phase only when the source says nothing finer.
- **Specs up front, plans just in time,** in **one phase-0 PR** for the whole roadmap (the person:
  needed as soon as possible). Plans written for phase 6 today would describe code that does not
  exist yet.
- **Questions with a recommendation run on it,** accepted by the phase-0 merge; a question where two
  principles pull against each other is a person's and parks only what it blocks.
- **One map, one answer.** The roadmap skills ask once, as `/omni:mega-invade` does, not one design
  conversation per PRD.
- **No estimates.** The Gantt draws real dates and projects only from this roadmap's own history.
- **The voice — Lead Engineer objected:** "Twenty-five specs from one page land in one phase-0 PR. I
  can't review that properly, and specs written today for phase 6 will describe code that doesn't
  exist yet" (persona:Lead Engineer). **Not taken:** the person chose one phase-0 PR for speed;
  plans, not specs, are written just in time, which keeps phase 6's plan off code that does not exist.
- **The voice — B-E DEv objected** on the spec's sections: "Twenty-five PRDs written by a bot in one
  sitting is exactly the fluff I expect" (persona:B-E DEv). **Approved without a change:** the map
  step, the `why` on every blocker and `omni roadmap check` already stand between the source and the
  issues.
- **No proof video.**

## User stories

- As a PM, I paste the Crew plan into `/omni:mega-roadmap`, answer one map, merge one phase-0 PR, run
  `/loop /omni:mega-drive --roadmap <n>`, and come back to feature PRs ready for my merge.
- As a PM with three multi-repository PRDs in a plan repository, I run `/loop /omni:mega-drive` once
  and it builds them across crew and ai-domain side by side, with no roadmap at all.
- As the person merging, every waiting PRD tells me which pull request it waits on, so I know what
  to review first.
- As a lead engineer, I open **Roadmaps**, pick the Crew product, and see the milestone's Gantt: what
  merged, what builds, what waits on whom.
- As a back-end developer, `omni plan check` refuses a plan that touches `vertuo-backend-php`, or that
  installs `@vertuoza/ai-sdk` in crew before ai-domain's change merged.
- As a single-repository team, `/omni:roadmap` and `/loop /omni:drive --roadmap <n>` give me the same
  without a plan repository.

## Scope

In: `/omni:mega-drive` and `omni next` in a plan repository (its verdicts, overlap per repository,
`/omni:mega-pr-care --once`), `roadmap.md`, `omni roadmap check|push|answer`, `omni check inbox` running the roadmap check,
`/omni:roadmap`, `/omni:mega-roadmap`, `/omni:mega-drive`, `/omni:drive --roadmap`, `omni next
--roadmap` and its plan-repository verdicts, the named blocker, `readOnly` and `consumes` with their
`omni plan check` rules, the migration and RPC, the API route, the Roadmaps entry and pages, `omni
help` entries, a guide page.
Out: everything under **Out of scope** above; changing how a PRD is built once its step runs.

## Test seams

Following `omni kb show testing`: tests beside the code, never calling GitHub or Supabase.

- `kit/lib/roadmap/parse.test.ts` and `grade.test.ts`: each refusal of `omni roadmap check` above,
  a green roadmap in one repository and one in a plan repository.
- `kit/lib/next/plan.test.ts` and `follow.test.ts`: a roadmap's blocked PRD held until its blocker's
  feature PR merged (every PR, in a plan repository), other steps running meanwhile, the held `why`
  naming the PR and its state, a `person` question parking only its PRDs, a closed blocker.
- `kit/lib/next/decide.test.ts`: one row per plan-repository verdict in the table of part 3.
- `kit/lib/next/plan.test.ts`: overlap per repository: same path in two repositories → beside;
  same path in one → in series, with the reason naming the repository.
- `kit/lib/inbox/plan-grade.test.ts`: `readOnly` and `consumes` refused and passed.
- `kit/lib/config.test.ts`: the two new target fields.
- `kit/bin/roadmap.test.ts` and `kit/bin/next.test.ts` through `main()` on `makeRepo()` with gh and
  HTTP stubbed: `check`, `push` (the one-line failures), `answer`, `next --roadmap`.
- `kit/test/plugin.test.ts`: the three new skills, their commands registered, signing.
- `apps/galaxy/src/roadmap/gantt.test.ts`: the layout (waves, arrows, real dates, the projection,
  none before a merge, lanes per repository), pure.
- `apps/galaxy/src/roadmap/api.test.ts` and `render.test.ts`: validation, the list filtered by
  product, the page on demo data, the empty and signed-out states.
- `apps/galaxy/src/nav/sidebar.test.ts`: the `roadmaps` id in its lists.
- The migration: a member reads only their workspace's roadmaps; only `roadmap_push()` writes.

## Risks

Read with `omni kb show releasing`. Merging this PRD publishes:

- **The database:** `roadmaps` and `roadmap_prds` applied to production Supabase. Additive only;
  rollback is a migration dropping both tables and `roadmap_push()`, nothing else reading them.
- **The kit:** `kit/dist/omni.mjs` and the plugin gain `omni roadmap`, three skills, `--roadmap` on
  `omni next` and `/omni:drive`, and two optional target fields. A plan repository's `omni next`
  changes its verdicts from the single-repository skills (which stalled) to the `ultra-` ones; every
  other behaviour is unchanged. Rollback is reverting the feature commit and releasing.
- **Many PRDs written at once:** a wrong blocker or repo tag reaches twenty-five issues. The map step,
  the `why` on every blocker and the check stop most of it; the phase-0 review stops the rest, and a
  fix is a docs PR on `roadmap.md`.
- **Cost:** an unattended roadmap spends tokens across repositories. One step per tick and the
  self-stop once everything waits on a person keep it bounded, as for `/omni:drive`.

## Acceptance criteria

1. `/omni:mega-roadmap <the Crew page>` in a plan repository shows one map, takes one answer, and
   opens one phase-0 PR holding `roadmap.md` and one inbox folder per PRD, each spec's `blocked-by`
   matching its row; `omni roadmap check` and `omni phase0` are green on it.
2. `/omni:roadmap` in a plan repository, and `/omni:mega-roadmap` in one that is not, each print the
   other's line and write nothing.
3. `omni roadmap check` refuses a cycle, a wave out of order, a blocker without its `why`, a spec
   whose `blocked-by` differs from its row, a repo that is `readOnly` or not a target, and a consumer
   PRD in a wave not after its provider's, each by name.
4. `omni plan check` refuses a slice in a `readOnly` target, and a slice in a consumer target blocked
   by a slice in the target it consumes.
5. `/loop /omni:mega-drive --roadmap <n>` runs `ultra-` skills, builds every unblocked PRD in every
   repository, and holds a blocked PRD until its blockers' plan PR and target PRs are all merged.
6. `/loop /omni:mega-drive` with no roadmap drives the person's own multi-repository PRDs: it returns
   only `ultra-wave`, `ultra-yolo`, `ultra-yolo-fix` and `mega-pr-care --once`, never holds a crew
   step behind an ai-domain one that shares no path in the same repository, and parks on the plan
   PR's status comment naming each PR still open, by repository.
7. Every held step names the pull request it waits on and that PR's state, in the terminal, on the
   Loop page, on the roadmap's page and on the held PRD's issue.
8. A `person` question parks only the PRDs it blocks; answering it on the roadmap's page lets the next
   tick take them up.
9. `/omni:drive` in a plan repository prints the `/omni:mega-drive` line and stops, and the other way
   round.
10. The **Roadmaps** sidebar entry lists the workspace's roadmaps, filterable by product; a roadmap's
   page shows its Gantt with one row per PRD by wave, blocker arrows, state colours, the waiting PR,
   and lanes per repository in a plan repository.
11. `omni roadmap push` with the app unreachable prints one line, and the tick still runs.
