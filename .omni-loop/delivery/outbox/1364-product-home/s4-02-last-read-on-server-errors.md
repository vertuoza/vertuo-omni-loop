---
id: s4-02-last-read-on-server-errors
prd: 1364
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

When should the targets command fall back on the last copy it read: only when the Omni page does not answer at all, or also when it answers with an error of its own?

## The decision, in plain words

The last copy is used when the Omni page does not answer in time or fails on its side. When it refuses (no sign-in, not a member, no such product), the command stops with its reason instead of hiding it behind an old copy.

## The intro, for fun

The page is down, the page is grumpy, or the page says no: only two of those deserve yesterday's list.

## The punchline, for fun

A firm no is still an answer.

## The options, in plain words

A. The copy on a timeout, a network failure or a 5xx; a refusal and a missing sign-in stop with their reason.
B. The copy only on a timeout or a network failure, as the spec words it; a 5xx stops too.
C. The copy on any failure, a refusal and a missing sign-in included, always saying why.

## What I had to decide

Whether a 5xx from the Omni page reads the last copy like a timeout does, and whether a missing sign-in should read it too.

## What I did meanwhile

kit/lib/product/targets.ts reads the copy on a timeout, a network failure or a 5xx; a 4xx stops with the server's reason; no ask.url or no sign-in stops with one line naming what to set.

## What it costs to change later

One condition in kit/lib/product/targets.ts (unanswered) and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names only the 5-second case. (author)
