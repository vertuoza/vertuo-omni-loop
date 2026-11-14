# ADR-0137 — Only the terminal's business read sends the old stance word excited, and only to a kit that does not ask for enthusiastic

**Status:** adopted · **Date:** 2026-11-13 · **PRD:** #2779 · **Decided:** nobody — adopted when raised (medium), 2026-11-13 · **Merged:** @pierrederval, 2026-11-13, PR #2781

## Context

Keep A when agents on the link and the review check may read enthusiastic. Pick B when they too must read excited unless they ask, which adds the same switch to the agent link.

## Decision

Agents on the agent link and the review check read the stance word enthusiastic. The terminal's business read alone sends back the old word excited, and only to an older kit that does not ask for the new word.

The option chosen: A. A. The agent link and the review check read enthusiastic; only the terminal's business read sends excited to an older kit.

## Consequences

B is a small change to the agent link's read, a few lines and a test; nothing is stored differently either way.

## Source

`.omni-loop/delivery/shipped/2779-open-personas/outbox/settled.md`, entry `s1-01-agent-link-reads-enthusiastic`
