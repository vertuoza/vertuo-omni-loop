# Bug 3287: a mission's product PRD build that ends without its result line goes straight to a person

## Triage

- **Domain:** missions — the supervisor's product PRD steps (`apps/omni-app/src/missions/supervisor.ts`, `productStateOf`)
- **Risk:** medium — a goal-only mission's product PRD stops at the first build that ends without its result line, held or stopped mid-way, and waits on a person instead of being sent again; workaround: take the PRD to ready by hand
- **Regression:** new bug — no evidence this ever worked: product PRD builds were added by #3142 (omni-loop-21) with "any other end waits for a person"

## Reproduction

- **File:** `apps/omni-app/src/missions/job.product-build.test.ts`
- **Level:** unit
- **Red:** `FAIL apps/omni-app/src/missions/job.product-build.test.ts > a product PRD whose build ended without its result line (bug #3287) > omni-loop-27: run 1 ended done with no result line, so run 2 of the same build is sent, and no person is asked — AssertionError: expected [ [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ] ]`

## Fix

A product PRD's build was read as a person's on any end but Ready, so a build that ended halfway or held was never sent again. Now `productStateOf` sends the build again as its next run, the way a repository PRD's step goes again: at `alone` while it ended halfway at most `mandate.resumes` times (a spend or rate limit counts none, ten builds at most), below `alone` and for a hold once. Past that, and for a question to a person, a failure or a cancel, it still waits for a person, saying why; the job passes the mission's `mandate.resumes` to it.

## Guard

`apps/omni-app/src/missions/supervisor.product.test.ts`: the supervisor's product PRD reading alone, each end and each cap (6 of its 7 tests fail on main's code).

## Mutation

mutation: no changed core file against origin/main (3b0cef07): nothing to mutate

## Still open

- A product PRD has no repair job yet: a build that failed, was held twice or spent its resumes waits for a person, where a repository PRD gets a repair (BR-PRODUCT-139).
