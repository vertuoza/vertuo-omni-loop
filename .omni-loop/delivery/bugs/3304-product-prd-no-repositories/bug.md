# Bug 3304: a mission builds a product PRD whose plan names no repository into the default branch

## Triage

- **Domain:** missions: a product PRD's build line and its bases (`apps/omni-app/src/missions`)
- **Risk:** medium — a mission above with-you opens a product PRD's target feature PR into the default branch when its plan names no repository; a person retargets it by hand (Jev, 0.88)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/job.no-repositories.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ { prd: 'omni-loop-31', …(6) } ] to deeply equal []` (the job sent `"line": "/omni:ultra-yolo omni-loop-31"`, no `--base-of`)

## Fix

A product PRD's plan with no `## Repositories` table gives it no targets, and the mission sent its build with no `--base-of`, so the
target pull request opened into the default branch. The mission now never sends that build: a PRD the PM wrote goes back to the PM's
plan job (counted in the PM's two rounds, sent once while it works), and a PRD a person wrote, or one whose PM rounds are spent, waits
on a person with the reason `its plan names no repository`. The PM's plan-only skill rewrites a plan that names no repository and
pushes it as a new version even when the spec did not change.

## Guard

`productLineOf` refuses an empty base list for a product PRD's build and fix (`supervisor.test.ts`, "refuses the build and the fix of
a plan that names no repository"); `null` bases, at with-you, still send no flag. It fails on main's `supervisor.ts`.

## Mutation

mutation: no changed core file against origin/main (b36a5c59): nothing to mutate
