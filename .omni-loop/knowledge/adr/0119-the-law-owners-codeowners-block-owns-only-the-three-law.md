# ADR-0119 — The law owners' CODEOWNERS block owns only the three law registers, never contracts.md

**Status:** adopted · **Date:** 2026-10-17 · **PRD:** #1796 · **Decided:** nobody — adopted when raised (medium), 2026-10-15 · **Merged:** @pierrederval, 2026-10-17, PR #1982

## Context

Whether omni kb owners' CODEOWNERS block owns each contracts.md beside principles.md, rules.md and invariants.md.

## Decision

omni kb owners puts principles.md, rules.md and invariants.md under the law owners in CODEOWNERS, but never contracts.md. A contract is never a law, so any person may answer a change to one through the usual question.

The option chosen: A. Leave the contracts file out of the owners list, as built.

## Consequences

One list in kit/lib/codeowners-laws.ts; adding the file later means switching that list and re-running omni kb owners once.

## Source

`.omni-loop/delivery/shipped/1796-domain-contracts/outbox/settled.md`, entry `s1-03-contracts-left-out-of-codeowners`
