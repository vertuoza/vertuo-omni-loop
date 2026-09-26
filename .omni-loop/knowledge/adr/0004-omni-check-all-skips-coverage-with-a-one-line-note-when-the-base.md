# ADR-0004 — omni check all skips coverage, with a one-line note, when the base branch is missing

**Status:** accepted · **Date:** 2026-09-25 · **PRD:** #3 · **Decided:** @claude-code-session (delegated by pierre-derval) via PRD issue #3, 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #4

## Context

What `omni check all` does when `<repo.remote>/<repo.defaultBranch>` does not resolve: skip `coverage` or exit non-zero.

## Decision

When <repo.remote>/<repo.defaultBranch> does not resolve, `check all` runs inbox, outbox and knowledge and skips coverage with a one-line note. `check coverage` alone exits 2, and an unresolved explicit --base is always an error.

The option chosen: A. Skip the coverage part with a one-line note when the main branch is missing, the option built.

## Consequences

One branch in `kit/bin/commands/check.mjs`. The phase-2 outbox workflow must fetch the base (fetch-depth 0 or an explicit fetch) or coverage is skipped in CI; making it fatal later is a one-line change plus the fixture tests that rely on a remote-less repo.

## Source

`.omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md`, entry `s15-01-check-all-skips-coverage`
