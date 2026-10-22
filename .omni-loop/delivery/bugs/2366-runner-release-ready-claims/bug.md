# Bug 2366: A runner job whose skill ended early shows Done, and a ready sub-PR it claimed is not released

## Triage

- **Domain:** the runner's release of an ended job's claims, `kit/lib/runner/release.ts` (PRD 2175)
- **Risk:** medium — a ready sub-PR claimed by a job that is gone keeps `omni:in-progress`, so it reads as someone's work and a person has to take the label off by hand; nothing is lost (Jev, 0.87)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/runner/release.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected { released: [ 2339, 2344 ], …(1) } to deeply equal { Object (released, releaseError) }`

## Fix

When a job ended, `release()` listed only the open drafts on `omni:in-progress` (`gh pr list --draft`), so a sub-PR the job had already marked ready, but not merged, kept its claim: on job 93914438, #2345. It now lists every open pull request on `omni:in-progress`, draft or ready, and still releases only those whose status comment names the job. The half of the report about the job reading Done needs a new ending and is handed to `/omni:brainstorm` on the issue.

## Guard

The reproduction, with the test's fake `gh` now answering only drafts when asked for `--draft`, as `gh` does: a release that leaves a ready claim out fails it.

## Mutation

mutation: no changed core file against origin/main (7fa27e28): nothing to mutate
