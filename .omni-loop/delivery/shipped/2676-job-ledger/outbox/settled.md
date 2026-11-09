# Settled outbox items — PRD 2676

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-claim-start-time -->

## s1-01-claim-start-time — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-claim-start-time
prd: 2676
slice: s1
rank: medium
bears-on: none
raised: 2026-11-09
wave: 1
---

## The question, in plain words

The design lists what each job keeps, but not when its current try began, so a try lost to a worker that died could not say when it started. Should each job keep that time?

## The decision, in plain words

Each job keeps when its current claim was taken, beside when the claim runs out. A lost try is then written with its real start, like any other try.

## The intro, for fun

Every try has a story, and every story needs a first line.

## The punchline, for fun

So the ledger now writes down when the clock started, not only when it ran out.

## The options, in plain words

A. A. Keep when the claim was taken on the job, and write each try's start from it.
B. B. Drop it and derive the start from when the claim runs out minus the lease, which breaks if the lease ever changes.
C. C. Write the try's line when it starts and fill in its end later, giving up the rule that a try's line is never changed.

## What I had to decide

Whether background_jobs keeps a claimed_at column (when the current claim was taken), set and cleared with the claim. It is the started_at of the attempt line the try writes, for a lost try as for any other: attempts are written once, when the try ends, and never changed.

## What I did meanwhile

Built A: background_jobs.claimed_at, held exactly while the job is running (a check constraint ties it to the claim), written by background_job_claim() and cleared by every finish and by a lost claim. supabase/checks/background_jobs.sql reads it through the claim's answer.

## What it costs to change later

Low before production: dropping the column is one migration and two lines in the claim and finish functions. B would write the attempt at claim time and change it at the end, which breaks the rule that an attempt line never changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's column table does not name it; whether a reader (s3, s4, a person reading a job) wants it shown is not settled. (author)

```

<!-- /omni-outbox-settled: s1-01-claim-start-time -->

<!-- omni-outbox-settled: s1-02-claim-lease -->

## s1-02-claim-lease — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-claim-lease
prd: 2676
slice: s1
rank: medium
bears-on: none
raised: 2026-11-09
wave: 1
---

## The question, in plain words

The design says a worker holds a job under a claim that runs out, and that the sweep picks a dropped job up within 15 minutes, but not how long a claim lasts. How long should a worker hold a job before another may take it?

## The decision, in plain words

A worker holds one job at a time, for five minutes: a little longer than the four minutes a run may spend claiming, and well inside the quarter hour between two sweeps.

## The intro, for fun

Every borrowed job comes with a due date stamped inside the cover.

## The punchline, for fun

Five minutes, then the library sends someone round to collect it.

## The options, in plain words

A. A. Hold one job at a time for five minutes.
B. B. Hold one job at a time for fifteen minutes, the gap between two sweeps.
C. C. Claim several jobs at once under one longer claim, fewer database calls but jobs held while others run.

## What I had to decide

The worker's lease (LEASE_SECONDS, 300) and its batch (one job per background_job_claim() call). A shorter lease reclaims a dropped job sooner but risks a slow job being run twice; a longer one, past 15 minutes, would let a dropped job wait for a second sweep.

## What I did meanwhile

Built A: runDue claims with a limit of 1 and a lease of 300 seconds, so it never holds a job it has no time left to run. A job that runs past its lease is claimed again by the next worker and run twice, which the knowledge pack makes harmless; the first worker's finish is then refused as stale.

## What it costs to change later

A constant in the worker; the database takes any lease from 10 seconds to an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long a knowledge pack takes on a large repository is not measured; a job that often runs past five minutes would run twice each time. (author)
- The webhook's function may run for 60 seconds today, shorter than the 240-second budget; the slices that call the worker from the webhook and the sweep set their own budget and duration. (author)

```

<!-- /omni-outbox-settled: s1-02-claim-lease -->

<!-- omni-outbox-settled: s4-01-sweep-forget-hour -->

## s4-01-sweep-forget-hour — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-09
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-sweep-forget-hour
prd: 2676
slice: s4
rank: medium
bears-on: none
raised: 2026-11-09
wave: 3
---

## The question, in plain words

The spec says the sweep forgets old finished jobs once a day, but not when. Which hour should it be, and should it ride on the hourly call?

## The decision, in plain words

The old rows are forgotten in the hourly call that runs at 03:00 UTC, and the hourly cron runs at minute 7 of each hour. A different hour is a one-number change.

## The intro, for fun

Even a tidy-up robot needs a time to sweep the floor.

## The punchline, for fun

It picked three in the morning, when nobody is looking.

## The options, in plain words

A. A. Forget inside the hourly call at 03:00 UTC (what was built).
B. B. Give the daily forgetting its own cron entry, once a day, calling the sweep with a forget flag.
C. C. Forget on every hourly call; the delete is cheap and idempotent.

## What I had to decide

Forget in the ?gaps=1 call whose UTC hour is 3, so no third cron is needed; the hourly cron runs at minute 7 and the 15-minute one at minutes 0, 15, 30 and 45.

## What I did meanwhile

Built as described: the constant FORGET_HOUR_UTC in apps/omni-app/src/jobs/sweep.ts is the only place the hour lives.

## What it costs to change later

Changing the hour is one constant and its test; moving it to its own cron adds one entry to vercel.json.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says once a day and names no hour; 03:00 UTC is my choice, not the PRD's.

```

<!-- /omni-outbox-settled: s4-01-sweep-forget-hour -->

<!-- omni-outbox-settled: s1-03-ledger-check-in-ci -->

## s1-03-ledger-check-in-ci — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-09T14:31:51Z
- Channel: feature pull request #2677
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2677#issuecomment-6742611857
- Basis: affirmation — the answer opens with "ok" and carries no contradiction marker
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-11-09
- Slice: s1
- Wave: 1
- Stays here: the answer confirms a one-time CI step was added; it states nothing lasting about the product

### The answer, as it was given

```text
ok
```

### The item, as it was raised

````text
---
id: s1-03-ledger-check-in-ci
prd: 2676
slice: s1
rank: human-action
bears-on: none
raised: 2026-11-09
wave: 1
---

## The question, in plain words

The ledger's database check is written and passes, but the build robot is not allowed to change the files that tell CI what to run, so CI does not run it yet. Can a person add that one step?

## The decision, in plain words

The check was left out of CI and everything else was pushed. Until a person adds the step, nothing in CI proves the ledger keeps its promises.

## The intro, for fun

The test is written, signed and sealed, but the robot holds no key to the exam hall.

## The punchline, for fun

So it waits outside, politely, until a person opens the door.

## What a person must do

1. Check out the branch feat/job-ledger--s1 (or the feature branch feat/job-ledger once s1 is merged into it).
2. In .github/workflows/supabase.yml, in the check job, right after the step named "A repository's knowledge packs" (the one running supabase/checks/knowledge_packs.sql), add this step:

```yaml
      - name: The job ledger holds jobs and survives failure
        # One job per key; a claim that ran out is due again and writes `lost`, the 5th lost claim is
        # `failed`; a stale claim cannot finish; `waiting` gives its try back and a 5th `retry` fails; a
        # replay keeps the attempts; the health is `late` for a job due over an hour or a failure with no
        # later done job, with counts and no name; forgetting keeps what is under 90 days; two workers at
        # once, through dblink, never hold one job; nobody but the service role reads or calls any of it
        # (PRD 2676).
        run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/background_jobs.sql
```

3. Commit it as `ci(supabase): run the job ledger's check (#2676)` with your own login, and push.
4. Or, instead: grant the Omni App `workflows: write` in its GitHub App settings, accept the new permission on the installation, and ask for the slice to be pushed again.

## What I had to decide

Pushing a change to .github/workflows/supabase.yml from this session is refused: the GitHub App that pushes has no `workflows` permission (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`). The repository's rule is that a database check CI does not run proves nothing (conventions: a new database check runs in CI), and the plan's done-when for s1 asks for supabase/checks/background_jobs.sql run by the supabase workflow.

## What I did meanwhile

The migration, supabase/checks/background_jobs.sql, the regenerated types, the ledger's client and the worker are pushed on feat/job-ledger--s1. The check was run green here against a fresh local database, and red against two broken versions of the functions (a stale claim accepted; a claim without skip locked, which now fails on its lock timeout instead of hanging). The workflow step below is the only part not pushed.

## What it costs to change later

One step a person adds by hand; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether to grant the Omni App the workflows permission for good, or add such steps by hand each time, is a person's choice; PRD 2573 named the same grant as a manual step. (author)

````

<!-- /omni-outbox-settled: s1-03-ledger-check-in-ci -->
