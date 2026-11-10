---
prd: 2686
title: Long-running jobs on the job ledger
blocked-by: [2685]
spec: file
---

## Problem

Three Inngest functions of the Omni GitHub App live for days:

- the **retro** runs when a feature PR merges, then again 14 days later, carrying on from what the first run
  found;
- the **knowledge harvest** runs when a pull request merges, and pays a model for what it drafts;
- the **main watch** looks at main for seven days after a PRD merged, wakes early when a check goes red, and
  queues `/omni:rewind` on the first break.

They are the last functions on Inngest, and they lean on it the most: a run is cut into steps whose results are
saved, so a retry never pays for a step twice, and a run can wait a day at a time. Inngest's plan caps a wait at
seven days, which is why the retro wakes itself with a daily tick. When the account runs out of its allowance,
retros are not written, lessons are not harvested, and a broken main is not noticed.

The ledger, after PRD 2685, lets a job run again later with a small `progress`. It does not yet save steps, and
nothing can wake a waiting job early.

## Solution

The three functions become jobs of the ledger, and leave Inngest in the same change. After it, no function is
left on Inngest.

### What the ledger gains

One migration, written only as database functions the App's service role may call.

- **Saved steps.** `background_job_save(id, claim, step, value)` writes one finished step's value into the
  job's `progress`, under the job's claim (a stale claim is refused, as for `finish`). The App's `savedStep`
  (`apps/omni-app/src/saved-step.ts`) keeps its contract: a step that has a saved value is not run again, and
  the value is parsed through its schema each time it is read. A retry, or a run after a wait, carries on
  from the last saved step.
- **Waits of any length.** `later` (PRD 2685) takes any date. The cap of 20 does not apply to a kind that
  declares its own; a long kind declares the number its longest life needs.
- **Waking a job.** `background_job_wake(kind, key)` makes a `queued` job due now. It does nothing to a job
  that is running or finished, and says whether it woke one.
- **A longer lease for a long run.** A kind may ask for a claim of up to 15 minutes, since one retro step can
  be a long model call. The worker saves after every step, so a run cut by the function's time limit loses one
  step at most.

### The kinds

| kind | was | added by | key | lane |
|---|---|---|---|---|
| `retro` | `retro`, its daily tick and its failure handler | `/api/github`: a pull request merged | `<owner/name>#<pr>` | `<owner/name>` |
| `knowledge-harvest` | `knowledgeHarvest` and its failure handler | `/api/github`: a pull request merged | `<owner/name>#<pr>` | `<owner/name>` |
| `main-watch` | `mainWatch` | `/api/github`: a pull request merged | `<owner/name>#<pr>` | – |

- The lane keeps one retro, and one harvest, at a time per repository, as today, so two runs never number the
  same ids.
- **The retro** runs its merge steps, then ends `later`, due 14 days after the merge. Its second run reads the
  merge run's fact sheet from its saved steps and does the day-14 steps. The daily tick and the waits a day at
  a time are gone: they existed only for the seven-day cap.
- **The harvest** is one run, cut into saved steps, so a retry never calls the model twice for the same step.
- **The main watch** opens its lanes, then ends `later`, a day on. Each run is one look; after the last lane's
  seven days it ends `done`. When `/api/github` receives a red check suite on a watched merge commit, it calls
  `background_job_wake`, in place of the event it sends today.
- A job that becomes `failed` runs its kind's failure handler once (PRD 2684): the retro's and the harvest's
  post their one comment, "could not run", as today.
- Each stays safe to run twice, by the rules they already keep: a comment is rewritten in place under its
  marker, the store adds a break once, a runner job is queued once.

### What is owed at the switch

Nothing is read from Inngest. The hourly comparison (`apps/omni-app/src/jobs/gaps.ts`) gains three rules, each
spending GitHub's budget with the same floor as today's:

- a feature PR merged in the last 14 days, in a repository the App is installed on, with no `retro` job: one is
  added. A retro whose pull request or verdict comment already exists carries on to its day-14 wait without
  publishing again.
- a `prd_main_watch` lane still `watching` inside its seven days, with no live `main-watch` job: one is added,
  and it carries on from the store.
- nothing for the harvest: a harvest lost at the switch is asked for again by a person, from the merged pull
  request, as today.

### Knowing it jammed

Unchanged: `late` when a job has been due for over an hour, or a `failed` job has no later `done` job for the
same repository. A waiting job is not due, so a retro waiting for its day 14 never reads late.

### Leaving Inngest

The three functions and their failure handlers are removed from `apps/omni-app/src/functions.ts`, which then
serves none, and `/api/github` sends no event to Inngest. The route `/api/inngest`, the package and the client
are removed by PRD 2687.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | migration | `<timestamp>_background_job_steps.sql` | `node scripts/migration-order.ts` (conventions › A migration stays the newest) |
| vertuo-omni-loop | db | `background_job_save()`, `background_job_wake()` | no written convention: follows `supabase/migrations/20270113090000_background_jobs.sql` |
| vertuo-omni-loop | code | one handler beside each function (`retro/job.ts`, `knowledge-harvest/job.ts`, `main-watch/job.ts`) | no written convention: follows `apps/omni-app/src/jobs/pack.ts` |
| vertuo-omni-loop | job kind | `retro`, `knowledge-harvest`, `main-watch` | `apps/omni-app/src/jobs/pack.ts` (`PACK_KIND`: lower case, dashes) |

## Decisions

- Q4 — recommended default, accepted when the phase-0 PR merges: a job keeps its finished steps in its row and
  goes back to `queued` with a later date; a CI result makes it due now.
- Q5 — recommended default, accepted when the phase-0 PR merges: nothing is read from Inngest at the switch;
  the comparison rebuilds what is owed from our tables and GitHub.
- **The step ids stay as they are** (`qualify`, `publish`, `clock-day-14`…), so the tests that name them keep
  their meaning. The steps that only served the daily tick are removed.
- **One wait of 14 days** rather than a day at a time: the ledger has no cap on a wait.
- **A saved step's value lives in the job's row.** A fact sheet is JSON of a few hundred kilobytes at most; a
  value over 1 MB is refused by the database function, naming the step.
- **No comparison for the harvest:** it drafts with a model, so it runs only when asked.

## User stories

- As a person who merged a feature PR, I get its retro, and its day-14 section 14 days later, whatever a
  vendor's allowance is.
- As a law's owner, a merged pull request is still harvested for knowledge, once.
- As the person who merged a PRD, I am told within the day when main breaks in its seven days, at once when a
  check goes red, and `/omni:rewind` is queued once.
- As the person who runs the App, a retro that failed is a `failed` job I can replay, with every try listed.

## Scope

In: the migration and its checks; `saved-step.ts` on the ledger; the three handlers; the route's adds and its
wake; the comparison's three rules; `functions.ts`; the App's README, `docs/observability.md` and the playbook's
architecture page where they describe these functions' waits (among them the seven-day cap); the rebuilt
`apps/omni-app/api/`.

Out: the `inngest` package, client and route (PRD 2687); any change to what a retro, a harvest or a watch
writes; the retro's thresholds.

## Test seams

- **The database functions:** `supabase/checks/background_jobs.sql`: a step saved under a stale claim is
  refused; a value over the limit is refused by name; `wake` moves a queued job and leaves a running or
  finished one; only the service role may call them.
- **`savedStep`:** a unit test on a stubbed ledger: a saved step is not run again; a saved value out of shape
  fails by the name of its step, as today.
- **Each handler:** today's scenario tests (`apps/omni-app/test/retro-scenario.ts`,
  `test/harvest-scenario.ts`, the main watch's) moved from a stubbed Inngest run to runs of a claimed job, with
  a stubbed clock between runs: the merge run, 14 days, the day-14 run; a look a day for seven days; a red
  check waking a look. Their expected comments, files and pull requests stay unchanged.
- **A run cut in the middle:** a handler stopped after a step carries on from the next one, and the model is
  called once.
- **The comparison:** unit tests with a stubbed GitHub and store, for each rule and its budget floor.
- No test calls GitHub, Supabase or a model.

## Risks

- **What merging publishes:** a migration (applied by the `supabase` workflow) and a new deploy of the App.
- **Rollback:** revert the feature PR; the functions return to Inngest. Jobs waiting in the ledger stay
  `queued` with no handler and are failed by the worker, by name; a replay after a new deploy runs them.
- **A retro published twice at the switch.** A retro Inngest already published would be added again by the
  comparison. The rule above (an existing pull request or verdict comment) is what prevents it, and it is an
  acceptance criterion.
- **A model paid twice.** A step saved after the call but before the save is paid again on retry. The window is
  one database write.
- **The size of a job's progress.** A large fact sheet in a row slows the claim; the claim returns it only for
  the kinds that save steps.
- The locked laws: none touched.
- The business laws: none touched.
- The Legal entries: L-GDPR-1 (who may read personal data): a saved step may hold GitHub logins, and the ledger stays the service role's alone. L-GDPR-2 (no credential in clear): no step saves a token; a job's reason is the error's first line. L-GDPR-4 (logs have a retention): a finished job and its saved steps are forgotten after 90 days. L-GDPR-7 (data sent outside the EU): pull request facts no longer go to Inngest for these functions.

## Acceptance criteria

- A merged feature PR gets its retro (the pull request, or the verdict comment) as before, and its day-14
  section 14 days after the merge, from one job that waited once.
- A merged pull request is harvested as before, with one harvest at a time per repository.
- A merged PRD is watched for seven days, a look a day; a red check suite on a watched merge commit gives a look
  at once; the first break queues `/omni:rewind` once; the lanes close as before.
- A run stopped after any step carries on from the next step on its retry, and no finished step runs again.
- A retro or a harvest that fails on its last try posts its one "could not run" comment.
- After the switch, a feature PR merged in the last 14 days with no retro job gets one, and a retro that was
  already published is not published again. A lane still watching gets its job back.
- `apps/omni-app/src/functions.ts` serves no function, and `/api/github` sends no event to Inngest.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass, and `apps/omni-app/api/` is rebuilt.
