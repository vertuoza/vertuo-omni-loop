# Bug 2786: the retro fails its gather-ci step over 1 MB for a delivery with many red CI runs

## Triage

- **Domain:** the App's retro (`apps/omni-app/src/retro`), its steps saved on the job ledger (PRD omni-loop-4)
- **Risk:** high — a delivery whose CI was red many times never gets its retro: the ledger refuses its `gather-ci` step over 1 MB, the job retries then fails, and `/api/health` turns to `jobs: late`; no workaround but a smaller delivery. (Jev, 0.66)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/retro/retro.step-cap.test.ts`
- **Level:** unit
- **Red:** `the database refused: Step "gather-ci": its value is over 1 MB. (22023)`

## Fix

The step "gather-ci" saved every red run's log tail in one value, so a delivery red on many commits gathered more than the 1 MB the ledger saves a step (a production job's largest was already 646 KB: 341 jobs, 62 tails). Each gather step, the plan repository's and each target's, is now saved through `savedStepInParts` (`apps/omni-app/src/saved-parts.ts`): a value that fits is saved as before, and a bigger one is cut, as JSON text, into parts of at most 512 KB, each saved as a step of its own before a head naming them, then read back whole. Nothing is left out: the judge, the guard and `retro.json` read the same records as before.

## Guard

The reproduction itself, on a ledger refusing a step over 1 MB as `background_job_save()` does: a delivery red on 140 commits must finish its retro with every saved step under the cap; and `saved-parts.test.ts`, which checks every part stays under its budget, a retry reads the parts back without gathering again, and a run that stopped between two parts never mixes them with a value made differently after.

## Mutation

mutation: no changed core file against origin/main (133632f8): nothing to mutate
