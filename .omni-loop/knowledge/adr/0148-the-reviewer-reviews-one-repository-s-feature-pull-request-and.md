# ADR-0148 — The Reviewer reviews one repository's feature pull request and stops on a feature that spans repositories

**Status:** adopted · **Date:** 2026-11-15 · **PRD:** #2871 · **Decided:** nobody — adopted when raised (medium), 2026-11-14 · **Merged:** @pierrederval, 2026-11-15, PR #2872

## Context

Spec section 2's table names `/omni:ultra-yolo-fix` as the fix for a multi-repository PRD, but section 1 describes reviewing one feature PR, and the plan's s2 done-when names no target repository. A multi-repository PRD's code is on its targets' feature PRs, not the plan repository's. `/omni:review` stops with `review: PRD <n> spans repositories: …` when `omni prd <n>` prints a `repos:` line; a mission reads that as stopped, sends it once more, then stops the PRD with why (BR-PRODUCT-139).

Decided by: Jev (hardToRevert 0.58) · agent said false

## Decision

For now /omni:review reviews only one repository's feature pull request. When the PRD names repositories, it stops in one line saying why, before reading GitHub or posting, and a mission holds that PRD for a person like any stopped job.

The option chosen: A. Review one repository's feature pull request, and stop on a feature that spans repositories (built).

## Consequences

A constant: option B adds a section to the skill (each target's PR through `omni review post --repo`, already there) and changes no stored data.

## Source

`.omni-loop/delivery/shipped/2871-reviewer/outbox/settled.md`, entry `s2-02-reviewer-one-repository`
