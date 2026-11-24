# Bug 3275: a PM's plan names its repository so the build cannot read it, and one such PRD holds the whole mission

## Triage

- **Domain:** missions — the mission branch cut in every repository a product PRD's plan names (`apps/omni-app/src/missions/branch.ts`, `job.ts` › productBranch), and the PM's `/omni:mega-brainstorm --plan-only` run that writes those plans
- **Risk:** medium — a mission's fleet: one product PRD whose plan names a repository GitHub cannot find holds every other PRD of the mission; the workaround is a person correcting that plan by hand (Jev, 0.78)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/job.unknown-target.test.ts`, `kit/test/brainstorm-mission-product.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [] to deeply equal [ "/omni:ultra-yolo omni-loop-31 --base-of demo-org/api=mission/14-faster-quotes" ]`; `AssertionError: expected '## Plan only (`--product <key> --plan…' to contain '`## Repositories` table is always wri…'`

## Fix

The mission cut its branch in every repository its product PRDs name and, when one was refused (a repository GitHub does not find), sent no product PRD at all. Now `prepareAll` names each refused repository with its reason, the branch is kept in the others, and only the PRDs whose plans name a refused repository wait, each naming why; the others are planned, reviewed and built. `/omni:mega-brainstorm --plan-only` always writes the plan's `## Repositories` table, each `repo` cell the repository's full `owner/name` from `omni targets` or the spec, never the product's key, a short name or a sentence.

## Guard

The reproduction is the guard: the job-level test holds a mission with one refused repository and asserts the other PRD is built, `branch.test.ts` asserts `prepareAll` names each refusal by repository, and the skill test asserts the plan-only run writes `owner/name` cells.

## Mutation

MUTATION_LINE
