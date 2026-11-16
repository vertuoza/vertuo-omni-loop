# ADR-0155 — The App reads the acceptance proof from the acceptance check run's text, then its summary

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2898 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2902

## Context

The `acceptance` check run is written by s5 (CI) and by s8 (the runner fallback), in the same wave or a later one, so its shape was not settled when s7 was built. `apps/omni-app/src/ready-check/facts.ts` (`reportText`) reads `output.text` first, then `output.summary`, and takes the whole text when it starts with `{`, else the first fenced json block. The parse is the kit's `parseAcceptanceReport`, so a malformed report is `not judged · <why>`. s5 and s8 should write the report as the run's `output.text`, JSON alone, so `omni ready` (s3) and the App read it the same way.

## Decision

The App reads each success criterion's proof from the acceptance check run's detailed text, then its summary, as JSON alone or in a JSON block. Writers should put it in the detailed text as JSON alone; with no proof, the check reads not finished or not judged, never passed.

The option chosen: A. A. Read the proof from the check's detailed text, then its summary, alone or in a JSON block: what was built.

## Consequences

One small function in one file, and its test: a constant's worth of change if s5 writes it elsewhere.

## Source

`.omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md`, entry `s7-01-report-read-from-acceptance-run-text`
