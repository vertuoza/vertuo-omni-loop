# ADR-0014 — The brainstorm skill always writes a before/after page, even when nothing is visible

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

Upstream brainstorming wrote no before/after page for a change with nothing to show, and said so. The kit's phase-0 command (omni phase0) grades a phase-0 pull request with phase0Verdict at its default needsBeforeAfter: true and offers no flag to turn it off, so a page-less phase-0 PR prints not ok. The skill cannot both follow upstream and leave the check green.

## Decision

Step 5 of the brainstorm skill always writes before-after.html. When a change has nothing visible, it is a short today-beside-after text page, and the Handoff always gives its path.

The option chosen: A. Always write the page; a short text one when nothing is visible (built).

## Consequences

A constant: if the answer is B, omni phase0 gains a --no-before-after flag passing needsBeforeAfter: false, and step 5 goes back to writing no page and the Handoff saying none.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s11-01-before-after-always-written`
