---
id: s6-02-refresh-gives-up-after-a-minute
prd: 324
slice: s6
rank: medium
bears-on: none
raised: 2026-09-28
wave: 5
---

## The question, in plain words

The background check asks GitHub for a PRD's slices. If GitHub never answers, how long should the check wait before it gives up?

## The decision, in plain words

Each question it asks gives up after one minute, and the check then records a failure, so the next try comes a minute later. A check that hangs never piles up behind the ones that follow.

## The intro, for fun

GitHub sometimes picks up the phone and just breathes, and the check had to decide how long to hold the line.

## The punchline, for fun

It hangs up after a minute, writes down the silence, and calls back a minute later.

## The options, in plain words

A. Give up on each question after one minute and record the failure: the option built.
B. Set no limit, as the board command itself does, and let a stuck check run until it ends on its own.
C. Give up on the whole check after two minutes, when its lock reads as abandoned, however many questions it asked.

## What I had to decide

How long the refresh (`omni statusline --refresh <n>`) waits on one `gh` or `git` call. The spec abandons a lock after 2 minutes and writes any failure as the error entry, but sets no limit on the refresh itself: a `gh` stuck on a dead connection would keep its detached process alive for good, and every 2 minutes the status line would start another beside it.

## What I did meanwhile

`refresh` in `kit/bin/commands/statusline.mjs` hands `buildBoard` and `loadContext` an `exec` that adds a 60-second `timeout` to every call; a call cut off throws, and the refresh writes it as the error entry. The lock is removed only by the refresh that took it (`releaseLock` in `kit/lib/statusline/board-cache.mjs` compares its owner token), so one that ends after a takeover leaves the newer lock alone.

## What it costs to change later

One constant in `kit/bin/commands/statusline.mjs`, and the owner check in `kit/lib/statusline/board-cache.mjs` with its test. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a lock older than 2 minutes is abandoned, but not how long a refresh may run, nor what a refresh still running after its lock was taken over does with that lock.
