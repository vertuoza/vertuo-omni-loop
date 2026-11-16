# ADR-0161 — A fleet's answer to a question is kept in the question's settled record and the mission's events, not the mission's decisions list

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2896 · **Decided:** nobody — adopted when raised (medium), 2026-11-16 · **Merged:** @pierrederval, 2026-11-16, PR #2897

## Context

Whether this slice writes the fleet's answers to the mission's decisions list, which needs a database change outside its ground, or keeps them in the question's record and the mission's events.

## Decision

The fleet's answer, its option and each member's verdict are written to the PRD's settled questions, and the mission records a decided or escalated event signed by the PM and agent. The mission's decisions list keeps approvals only, until a migration adds a writer for answers.

The option chosen: A. The answer lives in the question's settled record and the mission's events; the decisions list keeps approvals only (built).

## Consequences

Option B is one migration (a writer for answers, a key shape for a question's committee) and the App calling it; answers given before it would not be in the list unless read back from the ledger.

## Source

`.omni-loop/delivery/shipped/2896-fleet-alone/outbox/settled.md`, entry `s10-05-fleet-answer-recorded-in-ledger-and-room`
