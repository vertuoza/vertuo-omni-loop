# Plan: Mega retro

PRD #1130, spec beside this plan (`spec.md`). The feature branch `feat/mega-retro` goes into `main`
with `Closes #1130`. Each slice is a sub-PR from `feat/mega-retro--<slice>` into the feature branch,
marked `Part of #1130`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | When a multi-repository PRD's plan PR merges, the retro reads each target of `## Repositories` through the App's own installation there (its feature PRs, sub-PRs, timeline, delivery, CI and churn, one saved step per target and kind), a target it cannot read is `not read` with its reason, and `retro.md` and `retro.json` group Timeline, Checks, Churn and Findings by repository, each finding naming its repository | `apps/omni-app/src/retro/targets` `apps/omni-app/src/retro/retro.ts` `apps/omni-app/src/retro/retro.test.ts` `apps/omni-app/src/retro/retro.schema` `apps/omni-app/src/retro/retro.types.ts` `apps/omni-app/src/retro/qualify` `apps/omni-app/src/retro/github` `apps/omni-app/src/retro/detect` `apps/omni-app/src/retro/render` `apps/omni-app/src/retro/kinds/index.ts` `apps/omni-app/src/retro/kinds/schema` `apps/omni-app/src/retro/kinds/records.ts` `apps/omni-app/src/octokit-for.ts` `apps/omni-app/src/functions.ts` | — | 1 |
| s2 | Every retro issue opens in the plan repository with its finding's repository in the title, and each read target's merged feature PR carries one comment, marked and rewritten in place, with the retro's link and that repository's findings (or `No finding for this repository.`) | `apps/omni-app/src/retro/issues` `apps/omni-app/src/retro/publish` `apps/omni-app/src/retro/target-comment` `apps/omni-app/src/retro/retro.ts` `apps/omni-app/src/retro/retro.test.ts` | s1 | 2 |
| s3 | On day 14, the after-merge look counts the plan repository's `For PRD #<n>` bug issues from `/omni:mega-bug-fix`, reads each fix PR its fix plan names in its own repository, and places it against that repository's churn at the merge | `apps/omni-app/src/retro/kinds/after-merge` | s1 | 2 |

**Shared ground.**
- `apps/omni-app/src/retro/retro.ts` and `apps/omni-app/src/retro/retro.test.ts` belong to s1 (the
  per-target gathering) and s2 (the target comment step), in waves 1 and 2.
- s3 works inside the after-merge kind only: it reads the targets' access and churn that s1 puts in
  the run's scope and fact sheet, and its render lines come through the kind's own facts, so it
  shares no file with s2 in wave 2.

## Per slice: done when

**s1**
- `targets.ts`, from a config with `plan.targets` and a `plan.md` with `## Repositories`, returns the
  targets to read in the table's order, the plan repository excepted, and none for a PRD of one
  repository (its own tests).
- On a stubbed GitHub with a plan repository and two targets, the real retro function runs one
  `gather-<kind>-<target>` step per target and kind, reading each target's feature PR (one per
  landing) and its sub-PRs through that target's installation, looked up with the App's call.
- A third target with no installation is `not read — <reason>` in the fact sheet and in `retro.md`,
  and the run finishes.
- The published `retro.md` (a new golden) groups Timeline, Checks, Churn and Findings by repository,
  the plan repository first, then `## Repositories`'s order; every finding carries its repository.
- The existing one-repository retro tests and goldens pass unchanged.

**s2**
- An issue for a target's finding opens in the plan repository, its title naming the repository.
- Each read target's merged feature PR gets exactly one comment marked
  `<!-- <markers.prefix>-retro-target -->`, with the retro PR's link and that repository's findings,
  one line each, or `No finding for this repository.`; a replay and the day-14 run rewrite it in place.
- A target not read gets no comment; a one-repository PRD posts none.

**s3**
- A plan-repository bug issue whose body carries `For PRD #<n>`, with fix-plan rows naming PRs in two
  targets, is counted in the After merge section, each fix PR read in its own repository and placed
  against that repository's churn ranges at the merge.
- A target fix PR that cannot be read is listed as not read; bug issues naming `#<n>` in the plan
  repository are counted as today.
- The existing after-merge tests pass unchanged.
