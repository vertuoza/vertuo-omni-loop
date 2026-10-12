---
id: s7-01-stages-sync-line-counts
prd: 1723
slice: s7
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the quarter-hour sync writes its one summary line, which repositories count as read, and how is a run that cannot even list the workspaces marked?

## The decision, in plain words

Only the repositories the sync read and recorded count; the ones it skipped do not. A run that cannot list the workspaces, and so answers with a server error, is marked failed, like a run that crashes.

## The intro, for fun

Counting sheep is easy until one of them refuses to be read.

## The punchline, for fun

We counted the ones that answered and called the silent night a failure.

## The options, in plain words

A. Count the repositories read and recorded; a server error without a crash is failed (built).
B. Count every repository the sync tried, skipped ones included.
C. Keep the count, but mark a server error without a crash as refused instead of failed.

## What I had to decide

Keep A unless the team wants the summary to count every repository the sync tried, or wants a server error without a crash marked differently.

## What I did meanwhile

The summary line counts the repositories that landed and marks a server error as failed.

## What it costs to change later

Changing either is a one-line edit in the sync and its test; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the line carries how many repositories the run read, without saying whether a skipped one counts (author)
- The spec names a thrown run as failed, not a server error answered without a crash (author)
