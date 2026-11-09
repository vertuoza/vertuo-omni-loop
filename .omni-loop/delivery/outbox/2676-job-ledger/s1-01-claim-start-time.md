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
