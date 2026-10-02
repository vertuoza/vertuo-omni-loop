# ADR-0059 — Jev reads the kit default's wording of the four bug risk levels, the same for every repository

**Status:** adopted · **Date:** 2026-09-30 · **PRD:** #812 · **Decided:** nobody — adopted when raised (medium), 2026-09-30 · **Merged:** @pierrederval, 2026-09-30, PR #814

## Context

The plan says each level is worded from the repository's bug-fixing form, but the question lives in Galaxy's registry, which is one per decision and not per repository, and the form's own text is read on the laptop. I kept one fixed wording in Galaxy: the kit default's Triage wording of each level.

## Decision

When Jev is asked how risky a bug is, it reads the kit default's description of critical, high, medium and low, even for a repository that rewrote them. The question lives in Galaxy's per-decision registry, not per repository.

The option chosen: A. Keep one fixed wording, the kit default's, for every repository.

## Consequences

A constant: sending the repository's own wording would mean the skill adds the form's four lines to the state it sends, and the entry reads them instead of its own; no stored data changes.

## Source

`.omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md`, entry `s5-01-bug-risk-level-wording`
