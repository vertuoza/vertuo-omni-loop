---
id: s2-02-job-end-tokens-null
prd: 3001
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

When a job ends and its report says nothing about what it spent, should we forget the count it reported earlier, or keep it?

## The decision, in plain words

We keep the last count when a report says nothing, as today. A job's final report can say outright that its agent gave no count, and then the job keeps none.

## The intro, for fun

A job that forgets to mention its bill should not get its earlier bill torn up.

## The punchline, for fun

Silence keeps the last receipt; only a clear none clears it.

## The options, in plain words

A. Keep the last count when a report says nothing; clear it only when the ending report says null.
B. Clear the count on every ending report that carries none, as the plan's words read, losing the transcript count runners send today.

## What I had to decide

How runners.service.ts stores a job report's tokens. The plan's s2 done-when says the job end takes an optional tokens and the service stores it, and null when absent (AC-8). But runners already send the job's transcript counts on every report (PRD 2102), and a test holds that a report without tokens keeps the last counts. Built: JobUpdateSchema takes tokens: null on a done, failed or cancelled report only (a running report with null is still refused); null is stored as null, a count is stored, and an absent field keeps what was stored. supabase/migrations/20270125160000_qa_turn.sql adds no column: runner_jobs.tokens exists since 20261212090000_runner_tokens.sql, so the migration only adds runner_jobs_tokens_shape, checked by ask_tokens_valid() as ask_rounds.tokens is. s3's runner then sends the agent's Usage on the ending report, or null when the agent gave none.

## What I did meanwhile

An absent tokens field keeps the last counts; null on an ending report clears them.

## What it costs to change later

One schema refinement and one line of the service; changing it is a constant, not a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a job's last transcript count should still show when the agent's own count is missing (author)
