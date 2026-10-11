# ADR-0103 — Design review screenshots stay out of the repository and are attached to the sub-PR when the session can

**Status:** adopted · **Date:** 2026-10-11 · **PRD:** #1369 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-11, PR #1371

## Context

Whether the review's screenshots should be committed with the work, kept only as attachments, or not kept at all.

## Decision

The design review's screenshots are kept in a scratch folder outside the repository and attached to the sub-PR when the session can upload them; otherwise the Design review section names each screen and width it looked at.

The option chosen: A. Keep them out of the repository and attach them when the session can (built)

## Consequences

A constant in the skill's wording: committing them later is one sentence and a folder the outbox check accepts.

## Source

`.omni-loop/delivery/shipped/1369-design-craft/outbox/settled.md`, entry `s4-01-review-screenshots-stay-out-of-the-repo`
