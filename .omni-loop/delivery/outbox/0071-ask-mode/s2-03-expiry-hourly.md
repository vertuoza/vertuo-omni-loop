---
id: s2-03-expiry-hourly
prd: 71
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Old ask sessions must be cleaned up, but nothing said how often the clean-up runs, or from when a week is counted for a session that was simply left idle. How should it work?

## The decision, in plain words

A clean-up runs once an hour inside the database, and a session is deleted with its questions and answers a week after it ends. A session left for 12 hours without activity counts as ended from that moment, without being rewritten.

## The intro, for fun

Every good party needs someone who stacks the chairs at the end.

## The punchline, for fun

Ours shows up every hour and never asks who stayed late.

## The options, in plain words

A. Clean up once an hour inside the database, and delete a session a week after it ends, counting an idle one as ended after 12 hours, the option built.
B. Clean up once a day, which keeps old sessions around a little longer.
C. Also mark idle sessions as ended in the database, so whatever reads them sees it without working it out.

## What I had to decide

The spec: "A session with no call for 12 h reads as closed, and rounds go 7 days after their session closes, both through one scheduled SQL function". Unsettled: the scheduler, how often it runs, whether an idle session is rewritten to closed, whether the session row goes with its rounds, and from when the 7 days count for a session that closed by idling.

## What I did meanwhile

`public.ask_expire()` deletes a session (its rounds cascade) closed more than 7 days ago (closing stamps `last_seen_at`), or still open with no call for 12 hours plus 7 days, and returns the count. It never rewrites an idle session: `sessionClosed()` in `apps/galaxy/src/ask/store.ts` reads one as closed, for the API and for the page. The migration enables `pg_cron` and schedules the function hourly at minute 17 as job `ask-expire`. It touches only the ask tables, and the API roles cannot run it.

## What it costs to change later

The schedule or the windows change with one new migration (`cron.schedule` under the same job name replaces the job). Rewriting idle sessions to closed is one more statement in the function. Data already deleted is gone, which is what the spec asks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether `pg_cron` is allowed on the production Supabase project: the pull request check proves the migration on a fresh local stack only.
