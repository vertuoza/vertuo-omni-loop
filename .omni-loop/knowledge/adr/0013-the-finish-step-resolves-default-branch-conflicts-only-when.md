# ADR-0013 — The finish step resolves default-branch conflicts only when confident, otherwise hands them to a person

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

Upstream yolo always merged the default branch into the feature branch at the finish and resolved any conflict inline. The pr skill resolves a conflicting PR itself, but leaves a merely behind PR into the default branch to a person. The dispatch for this slice said conflicts go to a person.

## Decision

At the finish, the default branch is merged only when the feature branch is behind; conflicts resolved with confidence are fixed, any other is aborted and the PR goes stuck as a draft naming the conflicting files.

The option chosen: A. Resolve when confident, otherwise abort and hand to a person (built).

## Consequences

Low: one step of prose; nothing is stored.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s9-02-default-branch-conflict-to-a-person`
