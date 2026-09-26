# ADR-0010 — The planner leaves the draft feature PR as claimed and hands it to /omni:yolo instead of watching it

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

Whether /omni:plan leaves the feature PR with status claimed and stops, or enters /omni:pr's watch loop.

## Decision

After /omni:plan opens the draft feature PR, it sets the status to claimed with 0 of N slices merged, applies /omni:pr's feature labels and stops. It does not enter the watch loop or mark the PR ready; /omni:yolo carries it on.

The option chosen: A. Status claimed, stop, hand to /omni:yolo

## Consequences

A word in the status comment and one sentence in the skill.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s7-03-feature-pr-opened-claimed-not-watched`
