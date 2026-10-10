# ADR-0100 — The outbox check finds a fix's folder from the issue number leading its branch name, and a target's fix PR defers to the plan PR

**Status:** adopted · **Date:** 2026-10-10 · **PRD:** #1342 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-10, PR #1343

## Context

How evaluate finds a fix PR's folder (bugs/<nnnn>-<slug> or visual/<nnnn>-<slug>), and what a target repository's fix PR with a 'Part of <plan repo>#<n>' body gets.

## Decision

Evaluate finds a fix PR's folder under bugs/ then visual/ by the number leading its branch topic; with no such folder, a change to a law fails naming that. A target repository's fix PR pointing to a plan PR passes and links it.

The option chosen: A. A. Find the folder from the branch's issue number; a target's fix PR defers to the plan PR (built).

## Consequences

A constant: one function in apps/omni-app/src/evaluate/evaluate.ts and one branch in checkTarget.

## Source

`.omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md`, entry `s7-03-fix-folder-from-branch-number`
