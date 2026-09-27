# ADR-0030 — Ask sessions expire through an hourly pg_cron job, and idle sessions are read as closed, never rewritten

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #71 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #73

## Context

The spec: "A session with no call for 12 h reads as closed, and rounds go 7 days after their session closes, both through one scheduled SQL function". Unsettled: the scheduler, how often it runs, whether an idle session is rewritten to closed, whether the session row goes with its rounds, and from when the 7 days count for a session that closed by idling.

## Decision

public.ask_expire() runs hourly via pg_cron and deletes a session with its rounds a week after it closes; a session idle for 12 hours counts as closed from then. Idle sessions are never rewritten; sessionClosed() in the ask store works it out for the API and page.

The option chosen: A. Clean up once an hour inside the database, and delete a session a week after it ends, counting an idle one as ended after 12 hours, the option built.

## Consequences

The schedule or the windows change with one new migration (`cron.schedule` under the same job name replaces the job). Rewriting idle sessions to closed is one more statement in the function. Data already deleted is gone, which is what the spec asks.

## Source

`.omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md`, entry `s2-03-expiry-hourly`

## Amended by PRD 144

Sessions and rounds are kept for good. `public.ask_sweep()` replaces `ask_expire()`: it runs hourly, rewrites a session idle for 12 hours to closed, and deletes nothing. Only the owner deletes a session, with its rounds. The rest of this record (pg_cron, the hourly schedule, the 12-hour idle window) stands (item s2-01, agreed on #147).
