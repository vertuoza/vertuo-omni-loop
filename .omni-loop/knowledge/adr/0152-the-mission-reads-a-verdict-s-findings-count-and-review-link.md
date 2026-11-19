# ADR-0152 — The mission reads a verdict's findings count and review link from the Reviewer job's posted log line

**Status:** adopted · **Date:** 2026-11-15 · **PRD:** #2871 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-15, PR #2872

## Context

Keep reading the posted line from the job's log (A), or have the runner store the count and the review's link on the job itself (B).

## Decision

The mission reads the count of findings and the review's link from the last `omni review post` line at the end of the Reviewer job's log, keeping nothing else of the log. Without that line, the verdict says changes were asked with no count and links the pull request.

The option chosen: A. A. Read the count and the review's link from the Reviewer job's posted line, nothing else of the log (built).

## Consequences

Moving to a stored count is a column on runner jobs, a runner change and a two-line change in the store; nothing stored depends on the log reading.

## Source

`.omni-loop/delivery/shipped/2871-reviewer/outbox/settled.md`, entry `s5-02-findings-count-from-job-log`
