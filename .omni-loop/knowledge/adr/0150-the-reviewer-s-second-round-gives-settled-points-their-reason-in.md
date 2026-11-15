# ADR-0150 — The Reviewer's second round gives settled points their reason in its summary and raises kept points again on their line

**Status:** adopted · **Date:** 2026-11-15 · **PRD:** #2871 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-15, PR #2872

## Context

`omni care state` reads any comment after a care reply as a person's and lists the thread for the PM (`mark-asked`), even a resolved one (`kit/lib/care/state.ts`, `repliedThread`). So a Reviewer reply on a thread it accepts would send a settled thread to the PM. The verdict schema of s1 gives round 2 one `summary` line (500 characters at most) and 1 to 5 findings: resolved reasons go in the summary, and a kept finding is a round-2 finding on its round-1 line, its problem opening `Kept from round 1:`. A still-open thread the Reviewer accepts is resolved through GraphQL; it is the Reviewer's own thread, never a person's.

Decided by: Jev (hardToRevert 0.58) · agent said false

## Decision

In round two the Reviewer writes the reason for each point it accepts as settled in the review's summary, never as a thread reply. A kept point is raised again as a round-two finding on its round-one line, opening 'Kept from round 1:'.

The option chosen: A. Settled points get their reason in the second review's summary, and kept points are raised again in the second review (built).

## Consequences

A constant: replying on threads instead is a change to step 4 of the skill and to how care state reads a reply, with no stored data to move.

## Source

`.omni-loop/delivery/shipped/2871-reviewer/outbox/settled.md`, entry `s2-04-round-two-reasons-in-the-review`
