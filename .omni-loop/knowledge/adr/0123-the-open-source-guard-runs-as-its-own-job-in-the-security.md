# ADR-0123 — The open-source guard runs as its own job in the security workflow on every pull request, beside gitleaks

**Status:** adopted · **Date:** 2026-10-21 · **PRD:** #2305 · **Decided:** nobody — adopted when raised (medium), 2026-10-21 · **Merged:** @pierrederval, 2026-10-21, PR #2307

## Context

Keep A unless the team wants the guard listed under the main checks of a ready pull request; then B moves the job's one step into that workflow and its quick sibling.

## Decision

The open-source guard runs as its own job in the security workflow on every pull request, drafts and slices included, beside the secret scanner; the full test suite also runs it, so the main checks catch a finding too.

The option chosen: A. A. Its own job in the security workflow, on every pull request, beside gitleaks (built).

## Consequences

A constant: one job moved between two workflow files, and their shape tests updated.

## Source

`.omni-loop/delivery/shipped/2305-open-source-safe/outbox/settled.md`, entry `s1-02-guard-runs-in-security-workflow`
