# ADR-0156 — The acceptance check run carries the full report as its text, and CI posts none while a runner still owes the screen tests

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2898 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2902

## Context

s1's `kit/lib/ready/report.ts` fixes the report's format and the check run's name, `acceptance`, but not where in the check run the report sits; s3 (`omni ready`'s `gh` reader) and s8 (the App's runner fallback) read it, in the same wave or later. A check run can only be completed by the app that created it, and the ready rule's check 1 counts every check run of the head commit: a run CI left going for a runner would stay `in_progress` there forever, and a second `acceptance` from the App would sit beside it.

Decided by: Jev (hardToRevert 0.46) · agent said false

## Decision

The acceptance check run's detailed text is the full acceptance report, with a one-row-per-criterion table as its summary. When a screen-test criterion waits on a runner, CI writes no check and keeps the report as an artifact, so the App writes the single check once the runner is done.

The option chosen: A. The check's detailed text is the proof; while a runner still has to run the screen tests, no check is written and the proof is kept as a file for the App: what was built.

## Consequences

The few lines of `postCheckRun` and `verdictOf` in `scripts/acceptance-report.ts`, and the readers s3 and s8 write against them.

## Source

`.omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md`, entry `s5-01-acceptance-check-carries-the-report`
