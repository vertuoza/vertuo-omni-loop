---
prd: 2684
title: PR checks on the job ledger
blocked-by: none
spec: file
areas: [gate]
---

## Problem

The Omni GitHub App publishes four checks on a pull request (outbox, inbox, approved, budgets), and three
helpers keep them current: the approved rerun, the server event and the canon buttons. All seven are Inngest
functions (`apps/omni-app/src/functions.ts`).

1. **A vendor's allowance decides whether a pull request can merge.** When the Inngest account reaches its
   monthly limit it runs nothing (PRD 2676), so no check is published and every pull request waits.
2. **The checks are most of the executions.** Each push and each label change sends an event that four
   functions listen to. They are what fills the allowance.
3. **The ledger cannot carry them yet.** PRD 2676's job ledger runs one job per key, once. A check must run
   again for each burst of events on the same pull request, only once per burst, and never twice at the same
   time.

## Solution

The seven functions become jobs of the ledger, and leave Inngest in the same change. This is the first PRD of
the roadmap "Leave Inngest".

### What the ledger gains

One migration, after `20270113090000_background_jobs.sql`, written only as database functions the App's
service role may call.

- **Debounce.** `background_job_debounce(kind, key, subject, payload, wait_seconds, max_seconds, lane)` keeps
  **one row per kind and key**:
  - no row, or a finished one: the row is (re)opened as `queued`, due `wait_seconds` from now, its tries at
    zero, its attempts kept;
  - a `queued` row: its payload becomes the latest and it is due `wait_seconds` from now, never later than
    `max_seconds` after the burst began;
  - a `running` row: the latest payload is kept aside, and when the run finishes the row goes back to `queued`
    for one more run.
- **One run at a time per lane.** A nullable `lane` column. `background_job_claim` never hands out a job while
  another job of the same kind and lane is `running`.
- **Tries per kind.** A `max_tries` column, set when the job is added (5 by default, as today). The claim that
  finds a job out of tries makes it `failed`, as today.

### The kinds

| kind | was | key | lane | debounce |
|---|---|---|---|---|
| `outbox-check` | `outboxCheck` | `<owner/name>#<pr>` | – | 5 s, at most 1 min |
| `inbox-check` | `inboxCheck` | `<owner/name>#<pr>` | – | 5 s, at most 1 min |
| `approved-check` | `approvedCheck` | `<owner/name>#<pr>` | – | 5 s, at most 1 min |
| `budgets-check` | `budgetsCheck` | `<owner/name>#<pr>` | – | 5 s, at most 1 min |
| `approved-rerun` | `approvedRerun` | `<owner/name>#prd-<n>` | – | today's window |
| `server-event` | `serverEvent` | the dossier's id | – | today's window |
| `canon-action` | `canonAction` | the delivery's id | `<owner/name>#<pr>` | none |

The windows are today's constants, moved as they are. Each handler is today's function body without its
`step.run` wrappers: it reads the pull request fresh, evaluates, and publishes the check run. A check re-runs
whole on a retry, which is harmless: publishing the same verdict for the same head twice changes nothing.

`approved-rerun` and `server-event` send no event any more: they add one debounced check job per pull request
they find.

### Retries and failure

- A check kind has 4 tries, waiting 10 seconds, 1 minute, then 5 minutes: close to today's 3 retries.
- GitHub's budget low: `waiting`, 15 minutes later, the try given back, as the ledger does today.
- **A job that becomes `failed` runs its kind's failure handler once.** For a check it completes the check run
  as a failure with the reason, as today's failure handlers do, so a pull request never stays "in progress".

### What adds a job

- **`/api/github`.** For a handled pull request event it calls the debounce for the four check kinds, in one
  database call, in place of the event it sends to Inngest. A re-run of one check adds that kind alone. A change
  of the approved label adds an `approved-rerun`. A canon button adds a `canon-action`.
- **`/api/server-event`.** A server event adds a `server-event` job in place of its Inngest event.

If the database refuses the add, the route answers 500, so GitHub shows the delivery as failed and a person can
redeliver it. A check that is never asked for is worse than a red delivery.

### Running within seconds

- After it answers GitHub, the route waits the debounce window out in `waitUntil` (5 seconds), then runs the
  jobs due. In a burst, each delivery pushes the job later, and the last delivery's run finds it due.
- `api/github.mjs` and `api/server-event.mjs` get `maxDuration: 300`, the worker's time budget plus the wait.
- The sweep's cron moves from every 15 minutes to **every minute**, as the safety net for a run that was cut.

### Knowing it jammed

`background_jobs_health()` answers `late` when a check job has been due for over 10 minutes (other kinds keep
their hour). `/api/health` and the hourly health workflow are unchanged.

### Leaving Inngest

The seven functions and their failure handlers are removed from `apps/omni-app/src/functions.ts`, and the routes
stop sending their events. The retro, harvest, main watch, fix stamp and fleet board events still go to Inngest
until PRDs 2685 and 2686.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | migration | `<timestamp>_background_job_debounce.sql` | `node scripts/migration-order.ts` (conventions › A migration stays the newest) |
| vertuo-omni-loop | db | `background_job_debounce()`, columns `lane`, `max_tries` | no written convention: follows `supabase/migrations/20270113090000_background_jobs.sql` |
| vertuo-omni-loop | check | lines added to `supabase/checks/background_jobs.sql` | no written convention: follows that file |
| vertuo-omni-loop | code | `apps/omni-app/src/jobs/kinds.ts`, one handler beside each check (`<check>/job.ts`) | no written convention: follows `apps/omni-app/src/jobs/pack.ts` |
| vertuo-omni-loop | job kind | `outbox-check`, `inbox-check`, `approved-check`, `budgets-check`, `approved-rerun`, `server-event`, `canon-action` | `apps/omni-app/src/jobs/pack.ts` (`PACK_KIND`: lower case, dashes) |

## Decisions

- Q1 — recommended default, accepted when the phase-0 PR merges: one queued job per check and pull request; a
  new event pushes it 5 seconds later, at most 1 minute after the first; an event that arrives while it runs
  adds one more run.
- Q2 — recommended default, accepted when the phase-0 PR merges: the webhook waits the window out in
  `waitUntil` and runs the jobs due; the sweep moves to every minute as the safety net.
- Q3 — recommended default, accepted when the phase-0 PR merges: a check's steps are not saved between tries;
  it re-runs whole.
- **One row per kind and key, reopened by each burst,** rather than a new row per burst: the unique key of PRD
  2676 stays as it is, and a pull request's history of tries sits under one job.
- **A failed add answers 500.** PRD 2676 logs it and goes on, because its hourly comparison repairs a missing
  pack. No comparison exists for checks, so the delivery must show red.
- **No comparison for checks.** A webhook GitHub never delivered is lost today too; the check's Re-run button
  asks for it again.
- **Left out on purpose:** priorities between kinds, and saved steps (PRD 2686 adds them for the jobs that need
  them).

## User stories

- As a person with a pull request, I get the same four checks, with the same names and words, within seconds of
  a push, whatever a vendor's allowance is.
- As a person who re-runs a check or presses a canon button, it answers as it does today.
- As the person who runs the App, I see in `/api/health` that checks are late, and every try of a check in the
  ledger.

## Scope

In: the migration and its checks; the seven handlers; the two routes; `vercel.json` (durations, the sweep's
cron); the health threshold; `functions.ts`; the App's README and `docs/observability.md` where they name
these functions; the rebuilt `apps/omni-app/api/`.

Out: the other seven Inngest functions; the `inngest` package and `/api/inngest` (PRD 2687); any change to what
a check decides or says.

## Test seams

- **The database functions:** `supabase/checks/background_jobs.sql`, with realistic rows: a burst is one run;
  the cap holds; an event during a run gives one more run; two jobs of one lane never run together; a finished
  row reopens with its attempts kept; only the service role may call them.
- **The worker:** unit tests with a stubbed ledger: tries and waits per kind, the failure handler runs once.
- **Each handler:** today's function tests, moved from a stubbed Inngest step to a claimed job, against the
  stubbed GitHub. `outbox-check/end-to-end.test.ts` and `product-end-to-end.test.ts` keep their fixtures and
  their expected check runs unchanged: they are the proof that nothing changes for people.
- **The routes:** a handled delivery adds the four jobs and sends nothing to Inngest for them; a refused add is
  a 500.
- No test calls GitHub or Supabase.

## Risks

- **What merging publishes:** a migration (applied by the `supabase` workflow) and a new deploy of the App. The
  migration only adds; if the App deploys before the migration is applied, deliveries answer 500 until it is,
  and a person redelivers them or re-runs the checks.
- **Rollback:** revert the feature PR. The functions return to Inngest; the added columns and function stay
  and are unused.
- **Runs Inngest holds at the switch** are dropped: at most the last minute of debounced events. A push or a
  Re-run asks again.
- **Cost:** a cron every minute is about 43,000 short invocations a month on Vercel.
- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering the open questions. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch, and the reviewer is never told. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it: the handler reads the changed files as today.
- N-PRODUCT-3: a badly ranked question slips past, and the person who answers decides without the facts they need. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it.
- N-PRODUCT-4: any change could switch its own gate off, and every reviewer would trust a green check that means nothing. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it: the rules are still read from the base branch.
- N-PRODUCT-14: a rule quietly loses its test, and the team only learns it when the server refuses the pull request. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it.
- N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it.
- BL-APPROVALS-1: An approval covers exactly the files the approver read. Any later change to one of them voids the approval, and the build waits for a new one. The design keeps it: the approved check's reading is unchanged.
- BL-ASK-1: An answer a person gave is never changed or reworded afterwards, by an agent or by the product. A new answer is added beside it. The design keeps it: no job writes or changes an answer.
- BL-GATE-1: A check that could not decide says so in its result, as "not judged" with the reason. It never shows a plain pass. The design keeps it: a failed job completes its check as a failure with the reason.
- The Legal entries: L-GDPR-1 (who may read personal data): the ledger stays the service role's alone. L-GDPR-2 (no credential in clear): a payload never holds a token, and a job's reason is the error's first line. L-GDPR-4 (logs have a retention): finished jobs and their attempts are forgotten after 90 days, as PRD 2676 set.

## Acceptance criteria

- A push to a pull request the App handles publishes the outbox, inbox, approved and budgets checks with the
  same names, conclusions and summaries as before, and no Inngest run exists for them.
- Five events on one pull request within 5 seconds give one run of each check; events that keep coming give a
  run at most 1 minute after the first.
- An event that arrives while a check runs gives exactly one more run, and two runs of one check for one pull
  request never overlap.
- Re-running one check runs that check alone. A change of the approved label re-runs the approved check on the
  PRD's open pull requests. A server event re-checks the product PRD's open target pull requests. A canon
  button answers with its comment, one click at a time per pull request.
- A check that throws on its last try is completed as a failure with the reason; it never stays in progress.
- `/api/health` answers `late` when a check job has been due for over 10 minutes.
- `apps/omni-app/src/functions.ts` no longer holds the seven functions or their failure handlers.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass, and `apps/omni-app/api/` is rebuilt.
