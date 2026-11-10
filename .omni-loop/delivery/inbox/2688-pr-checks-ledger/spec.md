---
prd: 2688
title: The pull-request checks run on our own job ledger
blocked-by: none
spec: file
phase0: server
areas: [gate, approvals]
---

## Problem

Every pull request into a default branch gets four checks from the Omni GitHub App: `outbox` (no feature PR merges while a
decision an agent took alone is unanswered), `inbox` (a phase-0 PR's gate, the business-laws verdict on its spec included),
`omni/approved` (a ◆ PRD is built only once it is approved on its page) and `budgets`. All four are Inngest functions triggered
by one event, `omni-loop/outbox.check.requested`, debounced 5 seconds per repository and pull request, with 3 retries and a
failure handler that completes the check as `failure`.

1. **No pull request has had a gate since the Inngest allowance ran out** (51,465 of 50,000 executions in the month). No check
   has been seen on a pull request into `main` since #2630: an agent's unanswered decision, an unapproved ◆ PRD or a spec that
   breaks a business law no longer stops a merge. A repository that requires a check is blocked instead.
2. **A vendor's allowance decides whether the gates exist.** PRD 2676 moved the knowledge pack onto the App's own job ledger for
   this reason, and left the checks out of scope.
3. **The ledger cannot run a check as it stands.** It keeps one job per key and ignores a second add (right for a pack of one
   commit), so a burst of pushes, labels and replies on one pull request cannot become one evaluation of its latest state.

## Solution

The four checks move onto the job ledger of PRD 2676, one kind of job each: `pr-outbox`, `pr-inbox`, `pr-approved` and
`pr-budgets`. A new event on a pull request **refreshes** its jobs, so the latest state wins, as Inngest's debounce does today. What
each check decides does not change: each handler is today's function body, moved over.

### Refresh: the latest state wins

One job per pull request and check, keyed `<owner/name>#<number>`, lower case. A new database function,
`background_job_refresh(kind, key, subject, payload, delay_seconds)`, written as the ledger's other functions are (the service role
only), and one new column, `again boolean not null default false`:

| the existing job | what a refresh does |
|---|---|
| none | adds it, due in `delay_seconds` (5) |
| `queued` | takes the new payload (its head commit) and moves `run_after` to now + 5 seconds |
| `running` | takes the new payload and sets `again`: when the try finishes, whatever its outcome, the job is `queued` once more, due at once, `again` cleared |
| `done`, `skipped` or `failed` | `queued` again with the new payload, `tries` at zero, `reason` and `finished_at` cleared; its attempts are kept |

A finish that the database records for a job holding `again` keeps its attempt line as usual, then queues the job. The forget of
PRD 2676 deletes a job finished over 90 days ago with its attempts, so a pull request untouched for 90 days leaves nothing.

### What refreshes the jobs

- **The webhook**, for the events and actions that send the shared event today (`toCheckRequests`): each pull request into the
  default branch refreshes its four jobs. A re-run asked from GitHub (`check_run.rerequested`) refreshes only that check's job, by
  the check run's `external_id`, as it picks the event today.
- **The server-event recheck** (`../server-event/recheck.ts`), which sends one event per kept pull request when an approval, a void,
  an item or a settlement changed a product PRD: it refreshes those pull requests' jobs.
- **The approval re-run** (`approved-rerun`, debounced per PRD today): when the webhook sees the approval label put on a PRD's
  issue, it refreshes the `pr-approved` job of each pull request of that PRD.

As for the knowledge pack, the jobs are written before anything else is called, then the jobs due run in `waitUntil` once the
delivery is answered. Inngest is no longer sent the shared event.

### The handlers

Each handler is the body of today's function, its steps run in order in one try: start the check run (`in progress`, or already
`skipped`, `success` or the product verdict where the function posts one today), evaluate, publish, and for `pr-outbox` the
escalation record. A job may run twice and must be harmless: a second run posts a newer check run on the same head commit and
rewrites the same comment, as an Inngest retry does today. A repository without the loop's config ends the job `skipped` and posts
nothing, as today. GitHub's budget low is `waiting` (15 minutes, the try given back), as the worker does for a pack.

### Failure, never stuck

- A try that throws is retried after 1, 5, 30 and 120 minutes, as every ledger job is.
- The 5th that throws ends the job `failed`, and the kind's **failure handler** runs: today's `onFailure` of that check, moved
  over. `outbox`, `inbox` and `approved` complete the check run as `failure` with the reason (`skipped` on a pull request that is not
  a loop PR, nothing on a repository without the loop's config); `budgets` posts it `neutral`, saying why. The worker gains a
  per-kind failure hook for it.
- **A stuck check shows on the pull request.** The sweep (every 15 minutes) posts a check that is due but has not started for over
  10 minutes as `queued`, its summary `Delayed: Omni is retrying this check`, on the job's head commit. `/api/health` turns `late` for
  a job due over an hour, as for any job, which opens a GitHub issue through the existing health check.

### Leaving Inngest

The functions `outbox-check`, `inbox-check`, `approved-check`, `approved-rerun` and `budgets-check` are removed from Inngest, and the
shared event is no longer sent. Every other Inngest function stays where it is.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | migration | `<timestamp>_pr_check_jobs.sql` | `node scripts/migration-order.ts` (briefing › Never: newest on `main`) |
| vertuo-omni-loop | db | `background_job_refresh()`, column `again` | no written convention: follows `supabase/migrations/20270113090000_background_jobs.sql` |
| vertuo-omni-loop | check | `supabase/checks/background_jobs.sql` (extended) | no written convention: follows itself |
| vertuo-omni-loop | code | `apps/omni-app/src/jobs/pr-checks.ts`, kinds `pr-outbox`, `pr-inbox`, `pr-approved`, `pr-budgets` | no written convention: follows `apps/omni-app/src/jobs/pack.ts` (`PACK_KIND = 'knowledge-pack'`) |

## Decisions

- **All four checks, not the outbox check alone** (the person, offered the outbox check alone, or outbox and inbox): they share one
  event and all four are off, so moving one would leave three gates on a dead path.
- **A refreshed job per pull request and check** (the person, offered one job per event with older ones skipped, or the checks run in
  the webhook with no ledger): one row per pull request and check, each check retried and failed on its own.
- **No recovery of a lost webhook** (the person, offered an hourly comparison of open pull requests with their checks): the next push,
  or GitHub's re-run button, refreshes the jobs. It costs no GitHub calls.
- **The verdicts do not change.** Each handler is the function body moved over; this PRD changes where a check runs, not what it decides.
- **Objection, `persona:B-E DEv`:** "So now my merges hang on your own queue too. If it jams, every PR in the company is blocked and
  nobody knows why." Settled `accepted`: the sweep shows a stuck check as delayed on the pull request itself, beside the health alert.
- **No proof video** (the person).

## User stories

- As a developer, when my feature PR still has an unanswered decision, the `outbox` check stops its merge again.
- As a PM, a phase-0 PR whose spec breaks a business law shows red again before anyone merges it.
- As a lead engineer, when a check cannot run, I see on the pull request that it is delayed, and it ends as a failure rather than
  hanging in progress.
- As a workspace owner, an exhausted vendor allowance no longer turns every merge gate off.

## Scope

**In:** `background_job_refresh()` and the `again` column; the four kinds and their handlers; the worker's per-kind failure hook; the
webhook, the server-event recheck and the approval re-run refreshing jobs; the sweep's delayed check; removing the five Inngest
functions and the shared event's sends; the App's README.

**Out:** what any check decides; recovering a lost webhook; the other Inngest functions (retro, main watch, escalation, pr-stats, the
fleet board and the rest); a page for the jobs; the usage cuts on what stays on Inngest.

## Test seams

Following `omni kb show testing`: tests sit beside the code, no test calls GitHub or Inngest, and every fixture is fictional.

- **`supabase/checks/background_jobs.sql`:** each row of the refresh table; a finish with `again` set queues the job once more; a
  refresh never touches another kind's job of the same key; only the service role calls `background_job_refresh()`.
- **The worker, on a fake ledger:** the failure hook runs once, on the 5th throw only, and a hook that throws is logged and does not
  stop the run.
- **Each handler, on the fake GitHub:** the verdicts of today's `outbox-check`, `inbox-check`, `approved-check` and `budgets-check`
  tests, moved, and its failure handler.
- **The webhook:** a pull-request event refreshes four jobs before anything else is called; a re-run refreshes one; a repository
  without the loop's config ends `skipped` and posts nothing; a database failure does not fail the delivery.
- **The sweep:** a check due over 10 minutes is posted `queued` with the delayed summary; one due less is not.
- **Inngest:** the five functions are no longer registered.

## Risks

**What merging publishes** (`omni kb show releasing`): one migration applied to production, then a deploy of `apps/omni-app`. The
checks come back on every pull request the App sees at once. Rollback: revert the pull request, which restores the five functions on
Inngest (still out of allowance until it resets), and drop `background_job_refresh()` and the column in a follow-up migration.

- **The gates come back all at once.** Pull requests opened while they were off get their checks on their next event, and some may turn
  red; that is the gate working, not a regression.
- **A repository that never asked for the loop** gets four ledger rows per pull request and no check, as it gets no check today.
- **`waitUntil` can be cut short.** The claim runs out and the sweep runs the job at most 15 minutes later; the check shows delayed meanwhile.
- **A check that keeps failing now waits up to two and a half hours** (1 + 5 + 30 + 120 minutes) before it ends as a failure, against a
  few seconds on Inngest. It shows delayed on the pull request meanwhile.

**The Legal entries:**

- `L-GDPR-2`, credentials are never logged in clear: an error is cut to its first line, as the worker keeps it, and the payload holds no token.
- `L-GDPR-4`, logs that record no decision have a retention period: finished jobs and attempts are deleted after 90 days.
- `L-GDPR-1`, members only read a workspace's personal data: the rows hold repository names, pull request numbers and commits, no
  person, and only the service role reads them.

**The locked laws** (`omni kb laws --paths` on the four checks, the webhook, the worker, the server-event recheck and the migration). This
design changes none of them; four are the gates it moves, and each keeps its behaviour because the handlers are the function bodies moved over:

- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering the open questions. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch, and the reviewer is never told. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-4: any change could switch its own gate off, and every reviewer would trust a green check that means nothing. The check still reads its rules from the base branch. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-3: a badly ranked question slips past, and the person who answers decides without the facts they need. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-14: a rule quietly loses its test, and the team only learns it when the server refuses the pull request. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-63, BR-PRODUCT-64, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, N-PRODUCT-16, BR-PRODUCT-59: printed for the
  webhook and the App, untouched. Changing any needs @pierrederval or @dervalp to approve the pull request on GitHub.

**The business laws** (`omni kb business-laws --spec`: the `gate` and `approvals` domains):

- BL-GATE-1, a check that could not decide says so, never a plain pass: kept. A delayed check is posted `queued` with why, and a check
  that keeps failing ends `failure` (`budgets`: `neutral`, saying why), never `success`.
- BL-APPROVALS-1, an approval covers exactly the files the approver read: kept. `pr-approved` runs today's verdict unchanged, voided
  approvals included.
- BL-ASK-1, an answer is never changed afterwards: kept. No handler writes or rewrites an answer.

## Acceptance criteria

Acceptance scenarios are off in this repository, so these become ordinary tests.

1. A pull-request event into the default branch refreshes one job of each of the four kinds, before anything else is called.
2. Three events on one pull request within 5 seconds run each check once, on the latest head commit.
3. An event while a check's job is running runs that check once more after it finishes, on the latest head commit.
4. An event on a pull request whose jobs are finished queues them again with fresh tries, and their past attempts are kept.
5. A re-run asked from GitHub refreshes only that check's job.
6. Each check's verdict on a pull request is the one its Inngest function gave, on the same fixtures.
7. A check's job that throws five times ends `failed` and completes the check run as `failure` (`budgets`: `neutral`), never left `in progress`.
8. A check due but not started for over 10 minutes shows on the pull request as `queued`, delayed, after the sweep.
9. A repository without the loop's config gets no check run and no comment.
10. The server-event recheck and the approval re-run refresh the jobs of the pull requests they reach.
11. The five functions no longer exist on Inngest, and the shared event is no longer sent.
