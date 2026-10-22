---
id: s1-01-queued-jobs-stay-app-jobs
prd: 2433
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

If a key's GitHub App is removed, or the key is revoked, while jobs it sent are still waiting, may any runner take those jobs?

## The decision, in plain words

No. A job sent while its key held a GitHub App is marked at that moment, and only a runner that can act as an App takes it, even after the App is gone.

## The intro, for fun

A queued job remembers which badge it was promised.

## The punchline, for fun

Taking the badge away later does not hand the job to a stranger.

## The options, in plain words

A. Mark each job when it is queued, in a small table of its own, so a job promised to an App only ever goes to a runner that can act as one.
B. Look only at whether the key holds an App when a runner asks, so a job queued before the App was removed could be taken by any runner and run as a person.
C. Fail every waiting job of a key the moment its App is removed or the key is revoked, and let no mark outlive the App.
D. Add a yes-or-no column to the job itself instead of a table of its own, which changes what every reader of a job sees.

## What I had to decide

The spec says a runner that cannot act as an App never takes a job of a key that holds one, and that the job never runs as a person (spec section 10). It does not say what happens to a job already queued when the App is removed or the key revoked: the key then holds no row, so the claim would hand the job to any runner, and it would run as the person whose machine took it. I had to choose how a queued job remembers that it needed an App.

## What I did meanwhile

Added one table, public.runner_job_needs_app, one row per job, filled by a trigger on runner_jobs at insert when the sending key holds an App at that moment. runner_claim() skips a job that has a row, or whose key holds an App, for a runner whose github_app is false. Only the job itself deletes a mark. supabase/checks/api_key_github_apps.sql proves a mark survives Remove and revoke, and that a job queued after Remove carries none.

## What it costs to change later

Small. A follow-up migration drops the table, the trigger and the clause in runner_claim(); the marks are only for jobs still waiting, so no history is lost. Moving to a column on runner_jobs later is one migration that copies the marks over.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a job marked for an App that is gone should be failed at once instead of waiting for a runner that can act as an App (author)
