# ADR-0088 — Under a roadmap, the tick's held list carries the roadmap's gated PRDs first, then the pool's kept-back steps

**Status:** adopted · **Date:** 2026-10-08 · **PRD:** #1205 · **Decided:** nobody — adopted when raised (medium), 2026-10-08 · **Merged:** @pierrederval, 2026-10-08, PR #1206

## Context

The spec names held for the pool's steps, each {step, prd, why}; under --roadmap, held already meant each PRD the roadmap holds or parks ({prd, gate, why, link}), and the drive skills park every entry of it. Renaming either would break a reader. Keeping the roadmap entries first and unchanged keeps today's readers working; the pool's entries carry no gate, so a reader tells them apart by it. The drive skills (slice s2) must park only the entries that carry a gate.

## Decision

Under --roadmap, held lists the roadmap's held or parked PRDs first, unchanged and each with its gate, then the steps the pool keeps back, which carry no gate. A PRD the roadmap already holds gets no second line, and drive skills park only the entries that carry a gate.

The option chosen: A. A. One held list: the roadmap's PRDs first with their gate, then the pool's steps (built).

## Consequences

A constant: split the pool's entries into their own field in tickJson (kit/bin/commands/next.ts). Nothing is stored.

## Source

`.omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md`, entry `s1-03-roadmap-held-merge`
