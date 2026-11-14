# ADR-0131 — An approved knowledge finding's runner job names the PRD first, then the finding

**Status:** adopted · **Date:** 2026-10-28 · **PRD:** #2498 · **Decided:** nobody — adopted when raised (medium), 2026-10-23 · **Merged:** @pierrederval, 2026-10-28, PR #2499

## Context

Whether the runner's line for an approved knowledge finding names the PRD as well as the finding.

## Decision

Approving a lesson nobody wrote down queues /omni:rewind-apply <prd> <finding id>. The agent reads a finding only through its PRD, and the Runners page files a job under the PRD its line names first.

The option chosen: A. The PRD's number, then the finding's id, the option built.

## Consequences

One line in the approve plan, the skill's input section, one help entry and two lines of the guide; no stored data changes, and a job already queued runs as it was sent.

## Source

`.omni-loop/delivery/shipped/2498-rewind-apply/outbox/settled.md`, entry `s3-01-line-names-the-prd`
