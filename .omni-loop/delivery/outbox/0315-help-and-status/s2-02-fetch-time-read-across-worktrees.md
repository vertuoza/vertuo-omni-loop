---
id: s2-02-fetch-time-read-across-worktrees
prd: 315
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When the overview runs from a second working copy of the repository, whose last fetch should its header report?

## The decision, in plain words

It reports the newer of two fetches: the one run from this working copy, and the one run from the main one. A fetch run from a third working copy is not seen, even though it refreshed the same data.

## The intro, for fun

Git remembers the last fetch per working copy, yet shares what was fetched between them all.

## The punchline, for fun

So the header now asks the main copy too before it says never.

## The options, in plain words

A. The newer of this working copy's last fetch and the main one's: the option built.
B. The newest fetch of any working copy of the repository, reading every linked worktree's record too.
C. Only this working copy's own fetch, as before: a linked worktree says never fetched until it fetches itself.

## What I had to decide

Where the header's fetch time comes from in a linked worktree. The spec takes it from the checkout's `FETCH_HEAD`, but git keeps one per worktree while the remote-tracking branches the overview reads are shared: wave 1's check found that `omni status`, run in a linked worktree, printed `never fetched` right after a fetch in the main checkout.

## What I did meanwhile

`fetchedAt` in `kit/lib/status/facts.mjs` takes the newer non-empty time of this checkout's `FETCH_HEAD` (`git rev-parse --git-path FETCH_HEAD`) and of the one in the common git folder (`git rev-parse --git-common-dir`); in a plain clone both are the same file. `fetchRemote` still saves and puts back only this checkout's own. Pinned by two cases in `kit/bin/status.test.mjs`.

## What it costs to change later

One function in `kit/lib/status/facts.mjs` and two tests. No stored data: it only reads the times of files git writes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the checkout's `FETCH_HEAD` and does not consider linked worktrees, where git keeps a `FETCH_HEAD` of their own.
- (author) Any fetch writes `FETCH_HEAD`, even one of a single branch, so the time it gives is the last fetch of anything, not of the default branch alone; this was true before this change too.
