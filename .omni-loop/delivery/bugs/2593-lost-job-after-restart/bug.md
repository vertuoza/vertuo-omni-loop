# Bug 2593: a job sent right after a runner restarts is lost

## Triage

- **Domain:** runners app, the check-in that hands a runner its next job (`apps/galaxy/src/runners/runners.service.ts`, `next`)
- **Risk:** medium — a job sent in the 40 s after a runner restarts (every runner update) is lost and ends Runner lost; the person sends it again
- **Regression:** new bug — no evidence this ever worked (the held check-in came with PRD 1830)

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.service.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected { …(7) } to be null

## Fix

`GET /api/runners/next` holds a runner's check-in up to 40 s and claims any job that arrives. A runner
restarted mid check-in leaves that check-in held on the app, and a job sent before it ended was claimed
for the runner and answered to nobody. The first fix (#2594) stopped on the request's abort signal, which
Vercel never fires: live, the old check-in still claimed the job. Now each runner keeps `registered_at`,
set when it registers, and a check-in claims only for the registration it began under: `runner_claim()`
takes it and claims nothing once the runner has registered again. The signal code is gone.

## Guard

The reproduction, a unit test of the held check-in across a re-registration, and the case added to
`supabase/checks/runners.sql`: a claim made under an earlier registration takes nothing.

## Mutation

mutation: no changed core file against origin/main (61987cdc): nothing to mutate
