---
prd: 2676
title: Knowledge packs on our own job ledger
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge]
---

## Problem

A knowledge pack is the copy of a repository's knowledge the server keeps at one commit. The business laws
judge reads laws only from it (PRD 2632), and agents read a product's knowledge through it (PRD 2011).

1. **No pack is being made.** The pack is made by an Inngest function
   (`apps/omni-app/src/knowledge-pack/knowledge-pack.ts`). The account's free plan reached its limit
   (51,465 of 50,000 executions in the month), so Inngest runs nothing. A spec on a product PRD's page reads
   `Business laws not judged: the law home has no knowledge pack yet`, and no law can go red.
2. **A vendor's allowance decides whether a law holds.** Nothing in the product notices when the job stops.
3. **Moving the job needs more than a call in the webhook.** GitHub does not send a failed webhook again, a
   Vercel function can be killed in the middle of its work, and a deploy can land between two tries. A job
   that is only tried once loses work for good, and nobody is told.

## Solution

A small **job ledger** in the product's database, and the knowledge pack as its first and only job. It is the
first step out of Inngest: every other function stays where it is.

### The ledger

Two tables, written only through database functions the App's service role may call.

`background_jobs`, one row per piece of work:

| column | meaning |
|---|---|
| `id` | the job |
| `kind` | what it is: `knowledge-pack` |
| `key` | unique per kind: `<owner/name>@<commit>` |
| `subject` | the repository, lower case |
| `payload` | what the job needs, JSON |
| `state` | `queued`, `running`, `done`, `skipped` or `failed` |
| `tries` | how many tries were started |
| `run_after` | when it may run next |
| `claim` | a fresh id for each claim, null when nobody holds it |
| `claimed_until` | when the claim runs out |
| `reason` | why it is `skipped` or `failed`, in plain words |
| `created_at`, `finished_at` | when |

`background_job_attempts`, one line per try, never changed: the job, the try's number, when it started and
ended, its outcome (`done`, `skipped`, `retry`, `waiting`, `failed` or `lost`) and its error.

The functions:

- **`background_job_add(kind, key, subject, payload)`** adds a job, and does nothing for a key it holds. It says
  whether it added one.
- **`background_job_claim(limit, lease_seconds)`** hands out the jobs due, oldest first, in one statement using
  `FOR UPDATE SKIP LOCKED`: two workers never hold the same job. A job whose claim ran out is due again, and its
  lost try is written as `lost`. A claim adds one to `tries`. A job that has used its 5 tries, and lost its claim
  on the last, becomes `failed`.
- **`background_job_finish(id, claim, outcome, reason, retry_at)`** records the try and moves the job. It refuses
  a claim that is no longer the job's, so a worker that was presumed dead cannot overwrite the worker that
  replaced it.
- **`background_job_replay(id)`** puts a `failed` job back to `queued` with its tries at zero; its attempts stay.
- **`background_jobs_health()`** answers `ok` or `late`, with counts and no names.
- **`background_jobs_forget()`** deletes the jobs finished more than 90 days ago, with their attempts.

### The worker

`runDue` claims jobs for a time budget of 240 seconds, runs each and records its outcome:

| the job | the outcome |
|---|---|
| finished | `done` |
| nothing to do | `skipped`, with why |
| threw, tries left | `retry`, waiting 1, then 5, then 30 minutes, then 2 hours |
| threw on its 5th try | `failed`, with the error |
| GitHub's budget for the installation is low | `waiting`, 15 minutes later, its try given back |

A job may run twice and must be harmless if it does: `knowledge_pack_put()` already changes nothing for a commit
it holds.

### What adds a job

- **The webhook.** A pull request merged into the default branch of a repository a product holds adds a job, before
  anything is sent to Inngest. Then the App answers GitHub and runs the jobs due in `waitUntil`. A database failure
  here is logged and the delivery goes on: the comparison below repairs it.
- **The comparison, once an hour.** For each repository a product holds and the App is installed on, it reads the
  repository's config and the latest commit on the default branch that touched the knowledge folder or the config,
  and compares that commit with the newest pack. A repository with no pack, or an older one, gets a job. It stops
  when GitHub's budget is low, and carries on at the next hour. This also makes the first pack of a repository
  that never had one, with no new merge.

The job is today's pack logic moved over: qualify the merge, read the paths at the commit, hash, `knowledge_pack_put()`.
A job from the comparison has no pull request, and goes straight to reading the paths.

### The sweep

`GET /api/jobs-sweep`, on a Vercel cron every 15 minutes, runs the jobs due: retries, claims that ran out and anything the
webhook did not finish. With `?gaps=1`, hourly, it runs the comparison first; once a day it also forgets old rows.
It answers only `Authorization: Bearer <CRON_SECRET>`. `POST` with `{"replay": "<job id>"}`, under the same secret, is the
call by hand that replays a `failed` job.

### Knowing it jammed

`/api/health` gains `checks.jobs`: `ok`, `late`, `unknown` (the database cannot be read) or `off` (no database here).

`late` means a job has been due for over an hour, or a `failed` job has no later `done` job for the same repository.
`late` turns the body's `ok` to `false`, so the hourly health check (`.github/workflows/health.yml`) opens its
`Health: omni-app is down` issue, as it does for any failure. `unknown` leaves `ok` as it is: a database that blinked
is not a jam. The body stays public, so it holds the state only: no repository, no error.

### Leaving Inngest

The `knowledge-pack` function is removed from `apps/omni-app/src/functions.ts`, so a job can never run on both.
The merge event still goes to Inngest for the harvest and the retro.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | migration | `<timestamp>_background_jobs.sql` | `node scripts/migration-order.ts` (briefing › Never: newest on `main`) |
| vertuo-omni-loop | db | `background_jobs`, `background_job_attempts`, `background_job_*()` | no written convention: follows `supabase/migrations/20261212100000_knowledge_packs.sql` |
| vertuo-omni-loop | check | `supabase/checks/background_jobs.sql` | no written convention: follows `supabase/checks/knowledge_packs.sql` |
| vertuo-omni-loop | code | `apps/omni-app/src/jobs/` | no written convention: follows `apps/omni-app/src/knowledge-pack/` |
| vertuo-omni-loop | api | `/api/jobs-sweep`, entry `jobs-sweep` | `apps/omni-app/build.ts:14` (`FUNCTIONS`: one flat name per file) |
| vertuo-omni-loop | env | `CRON_SECRET` | `apps/galaxy/app/api/stages/sync/route.ts:7` |

## Decisions

- **A ledger, not a call in the webhook** (the person: "We need a ledger", which must support restart and failure and
  not skip jobs, without being over-built). A simple job list was offered, and a call in the webhook, and a comparison alone.
- **The knowledge base first and alone** (the person: "move OUT inngest what we need for this KB for now - that's a good
  first check for us"). Offered and not taken for this PRD: the outbox check, and the other PR checks.
- **Leaving Inngest rather than paying for it** (the person, offered an upgrade, usage cuts or a managed product).
- **A comparison beside the webhook,** because GitHub does not send a failed webhook again. Hourly, not every 15 minutes, to
  spend fewer GitHub calls: a lost webhook is repaired within the hour.
- **Left out on purpose:** debounce, priorities, multi-step resume and long waits. One short job needs none of them; the PRD
  that moves a job needing one adds it.
- **The worker runs in `waitUntil`** through `@vercel/functions`, because GitHub gives a webhook 10 seconds.
- **Objection, `persona:B-E DEv`:** "I already see this tool as a gimmick, and now you're writing your own queue. When it
  jams at 3am, how would I even know?" Settled `accepted`: a jam turns `/api/health` to `ok: false`, which opens a GitHub
  issue through the existing health check.
- **Finished rows are deleted after 90 days** (the person), under `L-GDPR-4`.

## User stories

- As a PM, when my knowledge merges, my next spec is judged against the laws that merged.
- As a workspace owner, a stopped vendor allowance no longer turns my laws off without anyone knowing.
- As a lead engineer, when a job fails I find which one, why and how many tries it took, and I can replay it.
- As a developer on a repository no product holds, my merges add nothing to the ledger.

## Scope

**In:** the two tables and their functions; the worker, the sweep, the comparison and the replay; the knowledge pack as a job;
the webhook's add; `checks.jobs` on `/api/health`; removing the Inngest function; `CRON_SECRET` in the App's environment; the
App's README.

**Out:** the outbox check and every other Inngest function; a page for the jobs; changing what a pack holds; the page's
words that a product PRD reads as a draft; cutting the usage of the functions that stay on Inngest.

## Test seams

Following `omni kb show testing`: tests sit beside the code, no test calls GitHub or Inngest, and every fixture is fictional.

- **`supabase/checks/background_jobs.sql`:** one job per key; two claims never hold one job; a claim that ran out is due again and
  writes `lost`; the 5th lost claim is `failed`; a stale claim cannot finish; a replay keeps the attempts; `background_jobs_health()`
  in each case; forgetting keeps what is under 90 days; nobody but the service role reads or calls any of it.
- **`apps/omni-app/src/jobs/`, on a fake ledger:** each row of the worker's table, the waits between tries, the budget's wait giving
  the try back, the time budget.
- **The comparison, on a stubbed GitHub:** no pack, an older pack, the same pack, a repository the App is not on, a low budget.
- **The pack job:** the behaviour of today's `knowledge-pack.test.ts`, moved, plus a job with no pull request.
- **The webhook:** a merge in a held repository adds a job before Inngest is called; a repository no product holds adds none; a database
  failure does not fail the delivery; Inngest refusing does not lose the job.
- **The route:** no secret, a wrong secret, a run, `?gaps=1`, a replay.
- **`/api/health`:** each `checks.jobs`, and only `late` turning `ok` to `false`.

## Risks

**What merging publishes** (`omni kb show releasing`): one migration applied to production, then a deploy of `apps/omni-app` and two
Vercel crons. Rollback: revert the pull request, which restores the Inngest function and removes the crons, and drop the two tables and
their functions in a follow-up migration. `CRON_SECRET` must be set on the App's Vercel project before the sweep answers.

- **A bug in the ledger stops packs.** It is the job it replaces that is already stopped, and a jam opens an issue. The outbox check does not
  depend on it in this PRD.
- **The outbox check stays off.** It is still on Inngest, so it does not come back with this PRD, and a repository requiring it stays blocked until
  the allowance resets or its own PRD ships. This PRD does not fix that.
- **The comparison spends GitHub calls:** about three per held repository each hour, at `background` priority, stopping when the budget is low.
- **`waitUntil` can be cut short** by the platform. The claim runs out and the sweep picks the job up, at most 15 minutes after its claim.
- **A health issue titled "down" for a jam** reads stronger than it is; its body names the check that failed.

**The Legal entries:**

- `L-GDPR-2`, credentials are never logged in clear: a job's error is cut to its first line, as today's `knowledge-pack` logs, and the payload holds no token.
- `L-GDPR-4`, logs that record no decision have a retention period: finished jobs and attempts are deleted after 90 days.
- `L-GDPR-1`, members only read a workspace's personal data: the rows hold repository names and commits, no person, and only the service role reads them.

**The locked laws** (`omni kb laws --paths` on the webhook, the health route, the pack job and the migration; this design changes none of them):

- BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. The pack is still written per workspace by `knowledge_pack_put()`. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind, and nobody can tell what was decided. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact, and players could no longer trust what they earned. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid key and run up the workspace's bill. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

The business laws: none touched.

## Acceptance criteria

Acceptance scenarios are off in this repository, so these become ordinary tests.

1. A pull request merged into the default branch of a repository a product holds adds one job, and a pack of that commit exists once it has run.
2. The same delivery sent twice adds one job.
3. A merge in a repository no product holds adds no job and calls no GitHub read.
4. A job whose worker dies is claimed again once its claim has run out, ends `done`, and its attempts show the `lost` try.
5. Two workers running at once never hold the same job.
6. A worker whose claim was taken over cannot finish the job.
7. A job that throws is retried after 1, 5, 30 and 120 minutes, then is `failed` with its error and five attempts.
8. A job waiting on GitHub's budget uses no try.
9. A repository a product holds whose knowledge folder has a commit newer than its newest pack, or that has no pack, gets a job from the hourly comparison.
10. Inngest refusing an event does not lose the job.
11. `/api/health` says `late` and `ok: false` for a job due over an hour ago and for a `failed` job with no later `done` job of its repository, and holds no repository name.
12. `/api/health` says `unknown` and keeps `ok` when the jobs cannot be read.
13. `/api/jobs-sweep` refuses a call without the secret, and `POST {"replay": id}` runs a `failed` job again and keeps its attempts.
14. Jobs finished over 90 days ago are deleted with their attempts, and younger ones are kept.
15. The `knowledge-pack` function no longer exists on Inngest.
