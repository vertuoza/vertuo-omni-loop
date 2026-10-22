# ADR-0120 — The stages sync backfills timelines with one full read per repository and asks GitHub when each merged feature PR was first marked ready

**Status:** adopted · **Date:** 2026-10-22 · **PRD:** #2370 · **Decided:** nobody — adopted when raised (medium), 2026-10-22 · **Merged:** @pierrederval, 2026-10-22, PR #2371

## Context

Answer A to keep the one full read and the extra question per merged feature pull request. Answer B to read only what changed, leaving shipped PRDs without a ready date or a full timeline.

## Decision

The sync reads a repository in full while it holds no milestone, then only what changed since its stages' and milestones' last sync. It reads a feature pull request's events once merged too, at background priority, so shipped PRDs get a ready date.

The option chosen: A. Keep the one full read and read when each merged feature pull request was first marked ready.

## Consequences

A: one full read per repository after the merge (about 220 PRDs here, so about 220 extra event reads), then one extra read per feature pull request that merges or changes after it merged; all at background priority, which steps back when the budget runs low. B: a constant to change in the sync; the shipped PRDs' timelines stay partial.

## Source

`.omni-loop/delivery/shipped/2370-prd-timeline/outbox/settled.md`, entry `s1-01-timeline-github-reads`
