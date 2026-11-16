# ADR-0157 — The Reviewer names a red ready check in one signed pull request comment, not a second review round

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2898 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2902

## Context

A person decides whether a red ready check should instead open a new round of the review.

## Decision

When a red ready check blocks the Reviewer, the pull request stays a draft and the failing check is posted as one signed comment. A check still running or unreadable ends the run on a stop line instead of asking for changes.

The option chosen: A. A. One signed pull request comment naming the failing check; not finished or not judged ends on a stop line.

## Consequences

A reword of two skill paragraphs and one test.

## Source

`.omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md`, entry `s4-01-review-gate-finding-as-comment`
