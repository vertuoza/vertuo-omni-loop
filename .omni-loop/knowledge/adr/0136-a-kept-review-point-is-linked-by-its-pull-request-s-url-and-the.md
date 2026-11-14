# ADR-0136 — A kept review point is linked by its pull request's url and the thread's id, and ship matches on that link

**Status:** adopted · **Date:** 2026-11-13 · **PRD:** #2739 · **Decided:** nobody — adopted when raised (medium), 2026-11-12 · **Merged:** @pierrederval, 2026-11-13, PR #2740

## Context

The spec names the source `PRD #<n> · <thread url>`, read in `omni ship` "through the reader `omni care` already uses". That reader, the loop's reads (`LoopThreadSchema`, PRD 1665), carries a thread's id and its comments but no comment url, and `kit/test/no-gh-reads.test.ts` forbids a `gh` GraphQL query in `kit/bin/commands/care.ts`. So the thread url is the pull request's url, `#`, then the thread id (`threadUrl` in `kit/lib/care/later.ts`, e.g. `https://github.com/acme/widgets/pull/9#PRRT_x`): `omni care reply --verdict later` finds the thread among the PRD's feature PR and sub-PRs through the loop's reads and writes that url into the follow-up's source and the item; `omni ship` builds the same url for each `later` thread and matches the source exactly and the item by naming it whole. A link opens the pull request, not the comment. An item settled `drifted` (the person chose to fix it in this PRD) needs no follow-up file, since the rework deletes it; without that the PRD could never ship after a fix-it-now answer.

## Decision

A kept point's source is its pull request's url, then # and the review thread's id, since the loop's reads carry no comment url. omni ship builds the same link for each later thread to find its follow-up and item. A point chosen to fix now needs no follow-up file.

The option chosen: A. Link to the pull request followed by the thread's name, and match on that.

## Consequences

Low: one function names the url; if the Omni page's contract later carries comment urls, `threadUrl` changes and the follow-up files already written keep the old form, which `omni ship` would then not match.

## Source

`.omni-loop/delivery/shipped/2739-follow-ups/outbox/settled.md`, entry `s3-02-thread-url-is-pr-and-id`
