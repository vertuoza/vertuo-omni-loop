# ADR-0149 — The Reviewer writes no code: a red check after ready goes to /omni:pr-care, and a pass it cannot mark ready ends as a stop

**Status:** adopted · **Date:** 2026-11-15 · **PRD:** #2871 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-15, PR #2872

## Context

Spec section 1, On pass: "then `/omni:pr`'s lifecycle until CI is green or stuck"; acceptance: "it never approves or requests changes, and writes no code". `/omni:pr`'s lifecycle fixes a red check. The skill watches the checks as that lifecycle does and fixes none; green or red it ends on `/omni:pr-care <n>` (the runner reads `ready`), checks that never finish end `review: CI never settled on PR #<pr>` (stopped). A pass with the PRD not shipped or the gate red posts the review, marks nothing and ends `review: passed PR #<pr>, not marked ready: …`, which a mission reads as stopped.

Decided by: Jev (hardToRevert 0.42) · agent said false

## Decision

The review skill marks a passing pull request ready, waits for its checks and hands a red check to /omni:pr-care rather than fixing it. A pass it cannot take to ready, because nothing shipped or questions remain open, is posted and ends as a stop naming why.

The option chosen: A. The Reviewer fixes nothing: a red check after ready goes to the care skill, and a pass it cannot mark ready ends as a stop (built).

## Consequences

A constant: option B is a few lines of the skill and changes no stored data.

## Source

`.omni-loop/delivery/shipped/2871-reviewer/outbox/settled.md`, entry `s2-03-pass-red-ci-goes-to-care`
