# ADR-0005 — Knowledge ids resolve in every profile; only the knowledge profile raises seriousness

**Status:** accepted · **Date:** 2026-09-25 · **PRD:** #3 · **Decided:** @claude-code-session (delegated by pierre-derval) via PRD issue #3, 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #4

## Context

Whether `laws.resolve` accepts a knowledge id when `laws.source` is not `knowledge`.

## Decision

Knowledge entry ids resolve whenever the knowledge folder exists, whatever the rules source. The seriousness floor is raised only when the rules come from the knowledge folder, so Became: write-back works in every profile.

The option chosen: A. Find knowledge entries in every setup, and raise the seriousness only when the rules come from the knowledge folder, the option built.

## Consequences

One condition in `kit/lib/laws.mjs` and one in `kit/lib/inbox/check-inbox.mjs`; reverting refuses `Became:` ids outside the knowledge profile again.

## Source

`.omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md`, entry `s4-01-knowledge-ids-in-every-profile`
