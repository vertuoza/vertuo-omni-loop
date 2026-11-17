---
id: s4-02-verdict-not-read-is-read-as-failed
prd: 3001
slice: s4
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

When QA's job finishes without a result the mission can read, the plan says the job ends failed. Should the mission rewrite the job's own record, or only treat it as failed when it decides what comes next?

## The decision, in plain words

The mission only treats such a job as failed when it decides what comes next: it writes 'failed: verdict not read' in its history and sends a repair, and the job's own record keeps the ending its runner gave it.

## The intro, for fun

QA came back from its round with a note nobody could read.

## The punchline, for fun

The mission files it under failed, and leaves QA's own diary alone.

## The options, in plain words

A. Treat the job as failed only in the mission's reading and history; leave the job's own record as its runner gave it.
B. Also rewrite the job's own record to failed, with the reason, so every page shows it failed.

## What I had to decide

Spec section 4 and AC-6 say a QA job whose verdict line cannot be read, or names more than five bugs, ends `failed · verdict not read`. Taken in apps/omni-app/src/missions/qa.ts (withVerdicts), called by job.ts right after the store reads the runs: a QA job the runner reported done whose log tail reads no verdict of its own round is read, for that run, as failed with the reason `verdict not read`. The supervisor then sends a repair within PRD 2980's budget as for any failed step, and records `PRD <n>'s job failed: verdict not read.` signed qa. The runner_jobs row itself is not updated: it stays done as its runner reported it.

## What I did meanwhile

Built and tested this way (qa.test.ts AC-6, qa.e2e.test.ts AC-6). The repair job is sent with the QA job's id, and /omni:repair reads that job's log, which ends on no `omni qa:` line.

## What it costs to change later

Writing the failure on the job's own row later is one update in the store, as the service role, and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the Runners page and the Operation room should show such a job as failed rather than done; s5 draws the room's rows
- (author) whether /omni:repair reads a job its runner reported done as well as a failed one
