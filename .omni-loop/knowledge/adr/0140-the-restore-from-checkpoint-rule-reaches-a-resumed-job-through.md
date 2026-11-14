# ADR-0140 — The restore-from-checkpoint rule reaches a resumed job through its resume note, not the skills' runner guidance

**Status:** adopted · **Date:** 2026-11-14 · **PRD:** #2809 · **Decided:** nobody — adopted when raised (medium), 2026-11-13 · **Merged:** @pierrederval, 2026-11-14, PR #2810

## Context

Keep A, or choose B: also write the rule once in the kit's runner guidance the resumable skills read, as the spec's section on restoring says, in a follow-up outside this slice.

## Decision

A resumed job is told to take back a branch's saved work from omni-checkpoint/<branch> before touching it only by the resume note it reads first. The building skills' guidance does not carry the rule, so a job with no note is never told it.

The option chosen: A. The rule is in the resume note alone (built)

## Consequences

A paragraph in one guidance file, in a follow-up: no stored shape changes.

## Source

`.omni-loop/delivery/shipped/2809-unlosable-jobs/outbox/settled.md`, entry `s5-04-checkpoint-rule-in-the-note`
