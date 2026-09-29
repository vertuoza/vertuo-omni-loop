# Plan: mega-brainstorm — one plan across repositories, reviewed in one phase-0

PRD #549, spec in `spec.md` beside this plan. Built on the feature branch `feat/mega-brainstorm`
into `main` (`Closes #549`), through sub-PRs from `feat/mega-brainstorm--<slice>` into the feature
branch (`Part of #549`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | In a plan repository a `plan.md` names a repository per slice (`repo` column) and records each one in a `## Repositories` table; `omni plan check` grades it — every refusal of spec point 2 named field first, collisions only inside one repository, one wave numbering, waves printed with their repositories — and outside a plan repository refuses a `repo` column while grading every other plan exactly as today | `kit/lib/inbox/territory` `kit/bin/commands/plan.mjs` `kit/bin/plan.test.mjs` `kit/dist/` | — | 1 |
| s2 | `omni prd <n>` prints `repos: <name>, …` for a multi-repository plan, and `/omni:yolo` and `/omni:wave` stop on such a PRD with `PRD <n> spans repositories: /omni:ultra-yolo <n> builds it` | `kit/lib/delivery/prd` `kit/bin/commands/prd.mjs` `kit/bin/prd.test.mjs` `kit/plugin/skills/yolo/` `kit/plugin/skills/wave/` `kit/dist/` | s1 | 2 |
| s3 | `/omni:mega-brainstorm` exists as a plugin skill with the steps of spec point 4, `/omni:plan` says how to fill the `repo` column and the `## Repositories` table in a plan repository, `omni help` lists the new skill, and the invade guide's plan-repository section names it | `kit/plugin/skills/mega-brainstorm/` `kit/plugin/skills/plan/` `kit/lib/help/` `docs/guide/invade.md` | — | 1 |

**Shared ground.**
- `kit/dist/` (the committed bundle, rebuilt by `pnpm kit:build` whenever kit source changes):
  s1 in wave 1, s2 in wave 2. s3 changes no bundled source.
- s1 and s3 share wave 1 and no prefix: s1 is kit source under `kit/lib/inbox/` and the `plan`
  command; s3 is plugin skills, the help entries and one guide page.
- s2 reads the `repo` column and the `## Repositories` table through s1's parser (its `repos:` line
  is the `## Repositories` order), hence its blocker. Its tests live in a new
  `kit/bin/prd.test.mjs`, so it never edits the shared `kit/bin/omni.test.mjs`.
- `kit/lib/board.mjs`, `kit/lib/inbox/collisions.mjs` and `kit/lib/policy/rework.mjs` call the
  parser but are not in any territory: a plan without a `repo` column parses to `repo: null` on every
  slice, and collisions between two `null` repositories are computed as today, so they need no
  change.

## Per slice: done when

**s1: the plan names a repository per slice, and `omni plan check` grades it**

- `parsePlanSlices` reads each slice's `repo` from a `repo` column, and `repo: null` on every slice
  of a table without one; every existing case of `kit/lib/inbox/territory.test.mjs` passes unchanged.
- The `## Repositories` table parses to `[{ repo, role, readAt, knowledge }]`, and to `[]` when the
  plan has none.
- `collisions` reports two slices only when they share a `repo` (two `null`s count as the same) and
  their territories meet: `src/` in `vertuo-apps` and `src/` in `vertuo-backend-php` is no
  collision; `src/` twice in `vertuo-apps` in one wave is refused as today.
- Through `main()` on a fixture repository whose config has a `plan` section, `omni plan check`
  refuses, each with the field named first: a slice table without `repo`; a `repo` that is neither
  a target's short name nor the plan repository's; a short name two entries share; a repository
  with slices and no `## Repositories` row; a row no slice names; a target row whose `read at` is not
  40 hex characters; a plan-repository row whose `read at` is not `—`.
- A valid multi-repository plan passes, a slice blocked by a slice of another repository in an
  earlier wave included, and the output prints `3 slices · 2 waves · 2 repositories` and each wave
  as `wave 1: s1 (vertuo-backend-php), s3 (vertuo-apps)`.
- On a fixture repository without a `plan` section, a plan with a `repo` column is refused with
  `a repo column needs a plan repository`, one with a `## Repositories` table is refused too, and
  every existing case of `kit/bin/plan.test.mjs` passes unchanged.
- No test calls GitHub; `kit/test/no-literals.test.mjs` passes (repository names only in fixtures).
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.

**s2: `omni prd` tells a multi-repository plan apart, and yolo and wave stop on it**

- `kit/bin/prd.test.mjs` (new), through `main()` on a fixture repository: `omni prd <n>` on a PRD
  whose `plan.md` has a `repo` column prints `repos: vertuo-backend-php, vertuo-apps` in
  `## Repositories` order; on a PRD with an ordinary plan, or with no plan, it prints no `repos:`
  line and every other line exactly as before.
- `kit/plugin/skills/yolo/SKILL.md` and `kit/plugin/skills/wave/SKILL.md` each say, at their
  step 0 reading of `omni prd <n>`, that a `repos:` line stops them with
  `PRD <n> spans repositories: /omni:ultra-yolo <n> builds it`, before any branch, claim or
  dispatch.
- `kit/test/plugin.test.mjs` passes on both edited skills.
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.

**s3: the skill**

- `kit/plugin/skills/mega-brainstorm/SKILL.md` exists with the steps of spec point 4 (step 0 with
  the `not a plan repository` stop, survey through `omni targets --json`, design, read-only
  shallow clones in the scratch folder, PRD issue and feature branch, spec with `## Repositories`
  and its Risks, before/after grouped by repository, commit and check, plan, one mega phase-0 with
  the **What lands where** table, hand-off ending on `/omni:ultra-yolo <n>` with the
  "not in this kit yet" line while the skill is absent), names the `/omni:brainstorm` steps it
  keeps rather than copying them, and says it writes nothing in any target and runs nothing in a
  clone.
- `kit/plugin/skills/plan/SKILL.md` has an "In a plan repository" paragraph: the header row
  `| id | repo | slice | territory | blocked by | wave |`, the `## Repositories` table and its
  columns, `read at` from the clone's head, and collisions only within one repository.
- `kit/test/plugin.test.mjs` passes: the new skill parses, names only commands the CLI has, and
  follows the signing and footer rules (ADR-0042).
- `omni help mega-brainstorm` and `omni help /omni:mega-brainstorm` print its entry.
- `docs/guide/invade.md`'s "A plan repository" section names `/omni:mega-brainstorm` as the next
  step after `/omni:mega-invade`; the guide's own tests pass.
- `pnpm test` is green.
