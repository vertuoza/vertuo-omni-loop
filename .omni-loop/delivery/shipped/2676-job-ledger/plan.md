# Plan: Knowledge packs on our own job ledger

PRD #2676, its spec beside this plan (`spec.md`). Built on the feature branch `feat/job-ledger` into `main` (`Closes #{prd}`), with one sub-PR per slice from `feat/job-ledger--<slice>` into the feature branch (`Part of #{prd}`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The ledger holds jobs and survives failure: one job per key, one worker per job, a claim that runs out, retries, a final failed state | `supabase/migrations/` `supabase/checks/background_jobs.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/omni-app/src/jobs/ledger` `apps/omni-app/src/jobs/worker` | — | 1 | deep |
| s2 | A merge in a repository a product holds makes a pack through the ledger, and the pack no longer runs on Inngest | `apps/omni-app/src/jobs/pack` `apps/omni-app/src/knowledge-pack/` `apps/omni-app/src/webhook/` `apps/omni-app/entries/github.ts` `apps/omni-app/src/functions` `apps/omni-app/src/outbox-check/inngest-route.test.ts` `apps/omni-app/package.json` `pnpm-lock.yaml` | s1 | 2 | build |
| s3 | A jam turns /api/health to ok false, with the state only | `apps/omni-app/src/health/` `apps/omni-app/entries/health.ts` | s1 | 2 | build |
| s4 | A sweep finishes what was left: retries, claims that ran out, lost webhooks, a replay by hand and forgetting old rows | `apps/omni-app/src/jobs/sweep` `apps/omni-app/src/jobs/gaps` `apps/omni-app/entries/jobs-sweep.ts` `apps/omni-app/build.ts` `apps/omni-app/src/vercel-functions.test.ts` `apps/omni-app/vercel.json` `apps/omni-app/src/env` `apps/omni-app/.env.example` `apps/omni-app/README.md` | s2 | 3 | build |

**Shared ground:** no prefix is declared by more than one slice. `apps/omni-app/src/jobs/` is split by file prefix: s1 owns `ledger` and `worker`, s2 `pack`, s4 `sweep` and `gaps`. s1's migration is the only one, so nothing else touches `supabase/migrations/`. `apps/omni-app/api/` is built and is in no territory.

## Per slice: done when

### s1 (deep: claims, leases and retries under concurrency)

- `supabase/checks/background_jobs.sql`, run by the supabase workflow, proves: one job per key; two claims never hold one job; a claim that ran out is due again and writes `lost`; the 5th lost claim is `failed`; a stale claim cannot finish; a replay keeps the attempts; `background_jobs_health()` in each case; forgetting keeps what is under 90 days; nobody but the service role reads or calls any of it.
- On a fake ledger, the worker turns each outcome of the spec's table into the right state: `done`, `skipped`, `retry` after 1, 5, 30 and 120 minutes, `failed` with its error and five attempts, and `waiting` on a low budget with the try given back.
- The worker stops claiming when its time budget of 240 seconds is spent.
- The migration is the newest on `main` (`node scripts/migration-order.ts`).

### s2

- A pull request merged into the default branch of a repository a product holds adds one job, and a pack of that commit exists once it has run.
- The same delivery sent twice adds one job.
- A merge in a repository no product holds adds no job and calls no GitHub read.
- The job is added before Inngest is called: Inngest refusing an event does not lose the job, and a database failure does not fail the delivery.
- A job with no pull request reads the paths at its commit and makes the pack.
- The behaviour `knowledge-pack.test.ts` proves today still holds on the job.
- `knowledge-pack` is no longer among the functions served to Inngest.

### s3

- `/api/health` says `checks.jobs` `ok`, `late`, `unknown` or `off`.
- `late`, for a job due over an hour ago and for a `failed` job with no later `done` job of its repository, turns `ok` to `false`, and the body holds no repository name and no error.
- `unknown` keeps `ok` as it was.

### s4

- `GET /api/jobs-sweep` refuses a call without `CRON_SECRET` or with a wrong one, and with the secret runs the jobs due.
- `?gaps=1` adds a job for a held repository with no pack or an older one, adds none for one with the same pack or one the App is not installed on, and stops on a low budget.
- Once a day the sweep forgets what finished over 90 days ago.
- `POST {"replay": id}` runs a `failed` job again and keeps its attempts.
- `apps/omni-app/vercel.json` holds both crons, and the README says how to set `CRON_SECRET`, read a job and replay one.
