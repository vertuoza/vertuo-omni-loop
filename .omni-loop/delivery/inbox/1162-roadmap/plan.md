# Plan: Roadmaps

PRD #1162, spec beside this plan (`spec.md`). The feature branch `feat/roadmap` goes into `main` with
`Closes #1162`. Each slice is a sub-PR from `feat/roadmap--<slice>` into the feature branch, marked
`Part of #1162`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | In a plan repository, `omni next` returns only `ultra-wave`, `ultra-yolo` (also when the PRD has no plan), `ultra-yolo-fix` and `mega-pr-care --once`, read from the plan PR, each target feature PR and the board across repositories; the loop plan puts two steps in series only when they share a path in the same repository, the reason naming it; a park names each open PR by repository | `kit/lib/next/` `kit/bin/commands/next.ts` `kit/bin/next.test.ts` `kit/dist/omni.mjs` | — | 1 |
| s2 | The Omni app stores roadmaps: a migration adds `roadmaps` and `roadmap_prds`, written only by `roadmap_push()` and read by workspace members, and adds the repositories of a loop tick; `POST /api/roadmaps` takes a pushed roadmap and its PRDs' states, and `/api/loops` takes a tick's repositories | `supabase/migrations/` `supabase/checks/roadmaps.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/app/api/roadmaps/` `apps/galaxy/src/roadmap/store` `apps/galaxy/src/roadmap/api` `apps/galaxy/src/roadmap/migration.test.ts` `apps/galaxy/src/loop/api` `apps/galaxy/src/loop/store` | — | 1 |
| s3 | `plan.targets` entries take `readOnly: true` and `consumes: [<target>]`; `omni plan check` refuses a slice in a `readOnly` target and a slice in a consumer target blocked by a slice in a target it consumes, each by name | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/bin/check-config.test.ts` `kit/lib/inbox/plan-grade` `kit/bin/plan.test.ts` `kit/dist/omni.mjs` | — | 1 |
| s4 | `roadmap.md` is read and graded: `omni roadmap check [<n>]` refuses a table that does not parse, a duplicate id, an unknown blocker, a cycle, a wave out of order, a blocker without its `why`, a row without its PRD folder or whose spec's `blocked-by` differs, a question blocking an unknown row, and in a plan repository a repo that is not a target, a `readOnly` repo, or a consumer PRD not after its provider's; `omni check inbox` runs it | `kit/lib/roadmap/parse` `kit/lib/roadmap/grade` `kit/lib/roadmap/index.ts` `kit/bin/commands/roadmap.ts` `kit/bin/roadmap.test.ts` `kit/bin/commands/index.ts` `kit/lib/inbox/check-inbox` `kit/lib/help/entries` `kit/bin/help.test.ts` `kit/dist/omni.mjs` | s3 | 2 |
| s5 | A **Roadmaps** entry above PRDs in the sidebar's Work group opens `/roadmaps`: every roadmap of the workspace, filterable by product, with its milestone, progress and what blocks it; `/roadmaps/<id>` shows the milestone, the Gantt (one row per PRD by wave, blocker arrows, state colours, real dates then a projection from merged PRDs, the waiting PR on its bar, a lane per repository), the open questions with an answer box for `person` ones, and links to each PRD's page; the Loop page shows each step's repositories | `apps/galaxy/app/roadmaps/` `apps/galaxy/src/roadmap/page/` `apps/galaxy/src/roadmap/gantt` `apps/galaxy/src/loop/page/` `apps/galaxy/src/nav/` `apps/galaxy/src/switch/headers.test.ts` `apps/galaxy/src/dashboard/render.test.ts` `packages/design/src/sprites` | s2 | 2 |
| s6 | `omni roadmap push <n>` sends `roadmap.md` and each PRD's state to the app without blocking (5 seconds, one token refresh, one-line failures); `omni roadmap answer <n> <question> "<answer>"` comments on the roadmap issue with a marker, and the answers are read back from it | `kit/lib/roadmap/push` `kit/lib/roadmap/answers` `kit/bin/commands/roadmap.ts` `kit/bin/roadmap.test.ts` `kit/lib/help/entries` `kit/bin/help.test.ts` `kit/dist/omni.mjs` | s2, s4 | 3 |
| s7 | `omni next --roadmap <n>` drives the roadmap's PRDs: a blocked PRD's first step is held until its blockers' feature PRs merged (in a plan repository, the plan PR and every target PR), every other step runs, the held `why` names the PR and its state; a `person` question not answered parks only the PRDs it blocks; a blocker closed unmerged parks its dependents; `omni loop push tick` carries the step's repositories | `kit/lib/next/` `kit/bin/commands/next.ts` `kit/bin/next.test.ts` `kit/lib/loop/` `kit/bin/loop.test.ts` `kit/lib/help/entries` `kit/bin/help.test.ts` `kit/dist/omni.mjs` | s1, s6 | 4 |
| s8 | `/loop /omni:mega-drive [<n>…] [--roadmap <n>]` runs one step per tick with the `ultra-` skills, parks on the plan PR's status comment and pushes the roadmap after each tick; `/omni:drive` gains `--roadmap` and refuses a plan repository with the `/omni:mega-drive` line (and the other way round); `/omni:mega-pr-care --once` runs one round; `/omni:ultra-yolo` plans a PRD with no plan before its first wave | `kit/plugin/skills/mega-drive/` `kit/plugin/skills/drive/` `kit/plugin/skills/mega-pr-care/` `kit/plugin/skills/ultra-yolo/` `kit/lib/help/entries` `kit/bin/help.test.ts` `kit/test/plugin.test.ts` `apps/galaxy/src/docs/skills` `docs/guide/drive.md` `docs/guide/several-repositories.md` `kit/dist/omni.mjs` | s7 | 5 |
| s9 | `/omni:roadmap <source>` and `/omni:mega-roadmap <source>` read a page, file or pasted text, show one map and take one answer, write every PRD's issue, folder and spec with its `blocked-by`, open the roadmap issue, write `roadmap.md`, run the checks, open one phase-0 PR, push the roadmap and hand off the drive line; each refuses the wrong kind of repository with the other's line; a guide page explains roadmaps | `kit/plugin/skills/roadmap/` `kit/plugin/skills/mega-roadmap/` `kit/lib/help/entries` `kit/bin/help.test.ts` `kit/test/plugin.test.ts` `apps/galaxy/src/docs/skills` `docs/guide/roadmaps.md` `docs/guide/meta.json` `apps/galaxy/src/docs/guide.test.ts` `kit/dist/omni.mjs` | s6 | 6 |

**Shared ground.**
- `kit/dist/omni.mjs`, the bundle `kit/test/dist.test.ts` checks against a fresh build, is generated:
  each kit slice rebuilds it with `pnpm kit:build` after merging the feature branch, and s1 and s3
  share wave 1 on it.
- `kit/lib/help/entries` and `kit/bin/help.test.ts`, the help table: s4 (`omni roadmap check`), s6
  (`push`, `answer`), s7 (`omni next --roadmap`), s8 (`/omni:mega-drive`, `--once`, `--roadmap`)
  and s9 (`/omni:roadmap`, `/omni:mega-roadmap`), in waves 2 to 6.
- `kit/test/plugin.test.ts` and `apps/galaxy/src/docs/skills`, every skill listed: s8 then s9.
- `kit/lib/next/`, `kit/bin/commands/next.ts` and `kit/bin/next.test.ts`: s1 then s7.
- `kit/bin/commands/roadmap.ts` and `kit/bin/roadmap.test.ts`: s4 then s6. `kit/lib/roadmap/` is
  split by prefix: s4 owns `parse`, `grade` and `index.ts`; s6 owns `push` and `answers`, and reads
  s4's parse without changing it.
- `apps/galaxy/src/roadmap/` is split by prefix: s2 owns `store`, `api` and `migration.test.ts`;
  s5 owns `page/` and `gantt`, and reads s2's store. `apps/galaxy/src/loop/` likewise: s2 owns
  `api` and `store`, s5 owns `page/`.
- s9 runs after s8 only because both list skills in the help table, `plugin.test.ts` and the docs;
  it needs nothing s7 or s8 build.

## Per slice: done when

**s1**
- `kit/lib/next/decide.test.ts`: one row per plan-repository verdict of the spec's part 3 table: a
  ready PR with red CI, a conflict or a new thread in any repository → `act mega-pr-care --once`;
  gate red with answers on the plan PR → `act ultra-yolo-fix`; no plan, or every slice merged with a
  PR still draft → `act ultra-yolo`; takeable slices in any repository → `act ultra-wave`; CI running
  in any repository or a claim held → `wait`; phase-0 open, questions open, or every PR ready and
  clean → `park` naming each open PR by repository; every PR merged or closed → `done`.
- In a plan repository no verdict names `wave`, `yolo`, `yolo-fix` or `pr-care`; outside one,
  every existing `decide.test.ts` row passes unchanged.
- `kit/lib/next/plan.test.ts`: the same path in two repositories → beside; the same path in one →
  in series, the reason naming `<repo>:<path>`.
- `kit/bin/next.test.ts` on a plan repository with gh stubbed per target: `--json` prints the ultra
  verdict and the repositories of the step.

**s2**
- `supabase/checks/roadmaps.sql` and `apps/galaxy/src/roadmap/migration.test.ts`: a member reads
  only their workspace's roadmaps and their PRDs; nothing but `roadmap_push()` writes them; a
  `product_id` from another workspace is refused.
- `apps/galaxy/src/roadmap/api.test.ts` on the fake store: the body is validated (missing fields, an
  unknown state, a foreign workspace refused with its status); a push creates the roadmap, a second
  replaces its document and PRD rows; a product named but unknown is stored as none, said in the
  response.
- `apps/galaxy/src/loop/api.test.ts`: a tick with repositories stores them; one without still
  passes.

**s3**
- `kit/lib/config.test.ts`: `readOnly` must be a boolean; `consumes` must name other targets of
  `plan.targets` by short name, never itself; both are optional and a config without them reads as
  today.
- `kit/lib/inbox/plan-grade.test.ts`: a slice in a `readOnly` target is refused naming it; a slice in
  a consumer target blocked by a slice in a target it consumes is refused naming both slices; a
  consumer slice blocked only by slices of its own repository passes.
- `kit/bin/plan.test.ts`: `omni plan check` prints both refusals and exits 1.

**s4**
- `kit/lib/roadmap/grade.test.ts`: one case per refusal in the slice, each naming the row or the
  question; a green roadmap in one repository and one in a plan repository.
- `kit/lib/roadmap/parse.test.ts`: the front matter (`roadmap`, `title`, `milestone`, optional
  `product` and `target`, `source`), the PRDs table with and without `repos`, the Open questions
  table with `default` and `person`.
- `kit/bin/roadmap.test.ts` on `makeRepo()`: `omni roadmap check` green prints the waves; red
  prints every violation and exits 1; `omni check inbox` fails on a broken roadmap.
- `omni help roadmap` prints its entry.

**s5**
- `apps/galaxy/src/nav/sidebar.test.ts`: `roadmaps` is the first id of the Work group, above `prds`.
- `apps/galaxy/src/roadmap/gantt.test.ts`, pure: rows grouped by wave; one arrow per blocker; real
  dates once a PRD started; a dashed projection from the median of merged PRDs; no dates before one
  merged; one lane per repository in a plan repository; the waiting PR on a held bar.
- `apps/galaxy/src/roadmap/page/render.test.ts` on demo data: the list filtered by product, a
  roadmap's page with its milestone, Gantt, questions with the answer box for `person` ones, links
  to `/prd/<n>`; the empty state names `/omni:roadmap`; signed out shows the demo.
- `apps/galaxy/src/loop/page/render.test.ts`: a step's repositories show on its ledger line.

**s6**
- `kit/bin/roadmap.test.ts` with the HTTP client stubbed: the push body matches s2's API; a 5-second
  limit; one refresh on a 401; `off`, `no sign-in (omni signin)`, `unreachable` and
  `refused (<status>)` each print one line and exit 1 without throwing.
- `omni roadmap answer 1200 Q5 "yes"` posts one comment on the roadmap issue carrying the marker;
  `kit/lib/roadmap/answers.test.ts` reads the latest answer per question from such comments and
  ignores unmarked ones.

**s7**
- `kit/lib/next/plan.test.ts`: in a roadmap, a blocked PRD's first step is held until its blocker's
  feature PR merged; in a plan repository, until the plan PR and every target PR merged; other steps
  run meanwhile.
- `kit/lib/next/follow.test.ts`: the held `why` reads `waits on <repo>#<pr> (<id> <title>): <state>`
  for each state the spec names; a `person` question unanswered parks only its PRDs and names the
  question; answered, the next call takes them up; a blocker closed unmerged parks its dependents.
- `kit/bin/next.test.ts`: `omni next --roadmap <n>` drives exactly the roadmap's PRDs, someone
  else's included; an unknown roadmap exits 2 with one line.
- `kit/bin/loop.test.ts`: a tick's body carries its repositories.

**s8**
- `kit/test/plugin.test.ts`: `mega-drive` is a skill, every `omni` command it names is registered,
  it names `omni sign trailer` and `omni sign footer` only where it commits (it commits nothing).
- `/omni:drive` and `/omni:mega-drive` each say, in step 0, to print the other's line and stop in
  the wrong kind of repository; `/omni:mega-pr-care` documents `--once`; `/omni:ultra-yolo` no
  longer stops on a PRD without a plan and plans it, graded by `omni plan check`.
- `omni help mega-drive` prints its entry; the docs list the skill; `docs/guide/drive.md` and
  `docs/guide/several-repositories.md` say how to drive a plan repository.

**s9**
- `kit/test/plugin.test.ts`: `roadmap` and `mega-roadmap` are skills, their commands registered,
  each names `omni sign trailer` and `omni sign footer`.
- Both skills say: one map and one answer, specs up front and no plan, one phase-0 PR proved by
  `omni phase0`, `omni roadmap check` and `omni check inbox` green, `omni roadmap push`, and the
  hand-off line; and the refusal in the wrong kind of repository.
- `docs/guide/roadmaps.md` is listed in `meta.json` and `guide.test.ts` passes; `omni help roadmap`
  and `omni help mega-roadmap` print their entries.
