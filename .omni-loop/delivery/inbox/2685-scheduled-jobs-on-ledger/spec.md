---
prd: 2685
title: Scheduled and short jobs on the job ledger
blocked-by: [2684]
spec: file
---

## Problem

Four Inngest functions of the Omni GitHub App are small and regular:

- **pr-stats** collects the Engineering board's numbers every 15 minutes;
- the **escalation sweep** looks every hour for outbox questions that waited too long;
- the **fix row stamp** stamps a bug record's Fixes rows when their pull request merges, closes or reopens;
- the **fleet board** adds a loop pull request to its author's fleet's GitHub project board, looking up to 10
  times, one minute apart, until the pull request is there to add.

They stop whenever the Inngest account runs out of its allowance, and nobody is told. The ledger of PRD 2676,
with what PRD 2684 added, still has no schedule and no way for a job to say "look again in a minute".

## Solution

The four functions become jobs of the ledger, and leave Inngest in the same change.

### What the ledger gains

One migration, written only as database functions the App's service role may call.

- **A job can ask to run again later.** A handler may end a run with `later`, a date and a small `progress`.
  `background_job_finish` takes the outcome `later`: the job goes back to `queued`, due at that date, its try
  given back, and its `progress` (a new JSON column) kept for the next run. A job may ask at most 20 times; one
  more is a failure.
- **A schedule,** with no new table. A schedule is a line in the App's code: a kind and a period. Each run of
  the sweep adds, for each schedule, the job of the current slot, with the key `<kind>@<slot's start>`. The
  unique key makes this safe however often the sweep runs. A slot the sweep missed is not added later: the
  next slot does the work.

### The kinds

| kind | was | added by | key | lane | tries |
|---|---|---|---|---|---|
| `pr-stats` | `prStats` | the schedule, every 15 minutes | `pr-stats@<slot>` | `pr-stats` | 3 |
| `escalation` | `escalation` | the schedule, every hour | `escalation@<slot>` | `escalation` | 3 |
| `fix-row-stamp` | `fixRowStamp` | `/api/github`: a pull request merged, closed or reopened | `<owner/name>#<pr>@<what>@<when>` | – | 4 |
| `fleet-board` | `fleetBoard` | `/api/github`: a loop pull request into the default branch | `<owner/name>#<pr>` | – | 4 |

- The lane (PRD 2684) keeps one `pr-stats` and one `escalation` running at a time, as their concurrency limit
  of 1 does today.
- `fleet-board` ends a look that found nothing with `later`, one minute on, its look count in `progress`; after
  the 10th look it ends `skipped`, with why, as today.
- Each handler is today's function body without its `step.run` wrappers. Each is safe to run twice: pr-stats
  and the stamp write the same rows, the escalation records what it already raised, and the board holds a pull
  request once.

### What adds a job

`/api/github` adds the `fix-row-stamp` and `fleet-board` jobs in place of the events it sends to Inngest, on
the path PRD 2684 made, and runs the jobs due in `waitUntil`. The sweep, every minute since PRD 2684, adds the
scheduled jobs before it runs the jobs due.

### Knowing it jammed

`background_jobs_health()` also answers `late` when a scheduled kind has had no `done` job for three of its
periods (45 minutes for pr-stats, 3 hours for the escalation).

### Leaving Inngest

The four functions are removed from `apps/omni-app/src/functions.ts`, and the route stops sending their events.
The retro, the knowledge harvest and the main watch stay on Inngest until PRD 2686.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | migration | `<timestamp>_background_job_later.sql` | `node scripts/migration-order.ts` (conventions › A migration stays the newest) |
| vertuo-omni-loop | db | column `progress`, outcome `later` | no written convention: follows `supabase/migrations/20270113090000_background_jobs.sql` |
| vertuo-omni-loop | code | `apps/omni-app/src/jobs/schedule.ts`, one handler beside each function (`<area>/job.ts`) | no written convention: follows `apps/omni-app/src/jobs/pack.ts` |
| vertuo-omni-loop | job kind | `pr-stats`, `escalation`, `fix-row-stamp`, `fleet-board` | `apps/omni-app/src/jobs/pack.ts` (`PACK_KIND`: lower case, dashes) |

## Decisions

- Q3 — recommended default, accepted when the phase-0 PR merges: these jobs re-run whole; no step is saved.
- Q5 — recommended default, accepted when the phase-0 PR merges: nothing is read from Inngest at the switch. A
  schedule's next slot does the work, and a fleet board look that was waiting is lost for that pull request.
- **A schedule in code, added by the sweep,** rather than one Vercel cron per job or a table of schedules: one
  cron already runs every minute, and two schedules do not need a table.
- **A missed slot is not caught up.** Both scheduled jobs read "everything since last time", so the next run
  covers it.
- **`later` gives the try back,** because waiting is not failing; the cap of 20 stops a job that would ask
  for ever.

## User stories

- As a member reading the Engineering board, the numbers are at most 15 minutes old, whatever a vendor's
  allowance is.
- As an owner, I am still told when an outbox question has waited too long.
- As a member reading a bug record, its Fixes rows are stamped when their pull request merges, closes or
  reopens.
- As a fleet's member, a loop pull request still lands on the fleet's project board.

## Scope

In: the migration and its checks; the schedule; the four handlers; the route's two adds; the health rule;
`functions.ts`; the READMEs and `docs/observability.md` where they name these functions (among them
`apps/galaxy/README.md`'s line on `prStats`); the rebuilt `apps/omni-app/api/`.

Out: the retro, the harvest and the main watch (PRD 2686); waits of days and saved steps (PRD 2686); the
`inngest` package (PRD 2687); any change to what these jobs write.

## Test seams

- **The database functions:** `supabase/checks/background_jobs.sql`: `later` re-queues with its progress and its
  try given back; the 21st `later` fails the job; a stale claim is still refused.
- **The schedule:** a unit test with a fixed clock: one job per slot however often it is asked; nothing for a
  missed slot.
- **Each handler:** today's function tests, moved from a stubbed Inngest step to a claimed job, against the
  stubbed GitHub and a stubbed store. The fleet board's ten looks are driven by the stubbed clock.
- **The route:** a merged pull request adds a `fix-row-stamp`, a loop pull request a `fleet-board`, and neither
  event goes to Inngest.
- No test calls GitHub or Supabase.

## Risks

- **What merging publishes:** a migration (applied by the `supabase` workflow) and a new deploy of the App. It
  only adds a column and an outcome.
- **Rollback:** revert the feature PR; the functions return to Inngest.
- **A gap at the switch:** between the App's deploy and the migration, a stamp or a board add may fail its add
  and answer 500; a person redelivers it. The scheduled jobs simply start at the next slot.
- **GitHub's budget:** pr-stats and the escalation spend an installation's budget; they keep their own floors,
  and a low budget is `waiting`, as the ledger does today.
- The locked laws: none touched.
- The business laws: none touched.
- The Legal entries: L-GDPR-1 (who may read personal data): the ledger stays the service role's alone. L-GDPR-2 (no credential in clear): a payload and a job's progress never hold a token. L-GDPR-4 (logs have a retention): finished jobs are forgotten after 90 days.

## Acceptance criteria

- The Engineering board's collector runs every 15 minutes and the escalation sweep every hour, each as one job
  per slot, never two at once, and no Inngest run exists for them.
- A pull request that merges, closes or reopens stamps its bug record's Fixes rows as before.
- A loop pull request into the default branch is added to its author's fleet's project board; when it is not
  there to add yet, the job looks again a minute later, up to 10 times, then ends `skipped` with why.
- `/api/health` answers `late` when pr-stats has had no finished run for 45 minutes, or the escalation for 3
  hours.
- `apps/omni-app/src/functions.ts` no longer holds the four functions.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass, and `apps/omni-app/api/` is rebuilt.
