---
id: s2-01-vectors-forget-daily
prd: 2728
slice: s2
rank: medium
bears-on: none
raised: 2026-11-12
wave: 1
---

## The question, in plain words

The spec says knowledge vectors nobody used for 90 days are deleted, but not what triggers the deletion. Should the database run it by itself every day?

## The decision, in plain words

The database runs the clean-up by itself once a day, at night, the same way it already expires old ask sessions. Nobody has to remember to run it.

## The intro, for fun

Ninety days of silence and a vector packs its bags.

## The punchline, for fun

Someone has to hold the door open, so the database does it nightly.

## The options, in plain words

A. A. A pg_cron job runs knowledge_vectors_forget() every day, as ask_expire() is run today.
B. B. The App's job ledger runs it as a scheduled job, so a failure shows on the ledger's health check.
C. C. Nothing runs it on a schedule; a person runs it when needed.

## What I had to decide

Keep the nightly clean-up (A), or have the App's job ledger run it instead (B), or run it by hand only (C).

## What I did meanwhile

Every night at 03:43 UTC the database deletes the vectors unused for 90 days; a search or a job using a vector keeps it.

## What it costs to change later

Changing it is one follow-up migration that unschedules the job (and, for B, one job kind in the App).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A failed nightly run is seen only in cron.job_run_details, not on the job ledger's health check (author).
