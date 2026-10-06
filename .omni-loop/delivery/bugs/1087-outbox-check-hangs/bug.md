# Bug 1087: the outbox answer never makes it to Claude

## Triage

- **Domain:** the omni-loop App's outbox check (`apps/omni-app/src/outbox-check`, its snapshot in `apps/omni-app/src/snapshot`), which writes the numbered outbox comment the Omni page's Outbox tab needs
- **Risk:** medium — nobody can send an answer from the Outbox tab of a PRD whose check hangs, and its `outbox` check stays `in_progress`; workaround: answer on the pull request or in the terminal (Jev, 0.76)
- **Regression:** yes — the check succeeded on #874 (2026-10-01 12:03 UTC) and was left `in_progress` on #775, #801 and #860 as the delivery folder grew; #1084 hid it from 2026-10-02 to 2026-10-05 by stopping every webhook

## Reproduction

- **File:** `apps/omni-app/src/snapshot/snapshot.test.ts`
- **Red:** `AssertionError: expected 1 to be undefined // Object.is equality` — one blob in flight at a time over 515 files, before the bound on concurrent fetches existed

## Fix

On the Outbox tab every card was unnumbered, so no pick registered and Send stayed at `Send 0 answers`. The numbers come from the outbox comment the App writes, and the App's step "evaluate" never finished: it fetched the head's delivery folder one blob after another, 515 files on #860, and Vercel ended it at 300 seconds on every retry (`Vercel Runtime Timeout Error: Task timed out after 300 seconds`, 2026-10-06 05:05 and 05:11 UTC). The snapshot now fetches its blobs `BLOB_CONCURRENCY` (16) at a time: the same folder took 159.3 s before and 9.9 s after, read against GitHub from a laptop.

## Guard

The reproduction is the guard: it snapshots a 515-file delivery folder through a stub that counts the blob requests in flight, and fails when they are fetched one at a time or more than `BLOB_CONCURRENCY` at once.

## Mutation

not set here
