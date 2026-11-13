# Bug 2780: the nightly retro of a large repository fails: its "facts" step is over 1 MB

## Triage

- **Domain:** the App's retro on the job ledger (`apps/omni-app/src/retro/retro.ts`, `factSheet`)
- **Risk:** high — every retro of a large multi-repository PRD fails at its `facts` step: no retro PR or verdict comment is published, and `/api/health` reads `jobs: late`; no workaround short of a code change. (Jev, 0.96)
- **Regression:** yes — 8c11beba2 (#2725, v0.0.608) moved the retro from Inngest onto the job ledger, whose saved step is capped at 1 MB

## Reproduction

- **File:** `apps/omni-app/src/retro/retro.step-cap.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected Error: the database refused: Step "facts"… to be undefined` (`the database refused: Step "facts": its value is over 1 MB. (22023)`)

## Fix

The fact sheet repeated each red CI run's log tail on the red run and on every finding citing it, so a delivery red again and again saved a `facts` step past the ledger's 1 MB (1.34 MB in the failed production job, 0.24 MB of it without the tails). The step `facts` now saves the sheet without its excerpts, copies of what the `gather-<kind>` steps already saved, and `excerpts.ts` puts them back from the same sheet made again from those saved records (`detect` is pure), so the judge, the guard and `retro.json` get every tail as before and every number stays saved.

## Guard

`retro.step-cap.test.ts` runs the retro on a ledger that refuses a step over 1 MB, as `background_job_save()` does, with a delivery whose check was red 60 times; it also checks the step `facts` holds no log tail while the judge and `retro.json` still get them, and that a retry reads the same sheet back.

## Mutation

mutation: no changed core file against origin/main (1290f521): nothing to mutate
