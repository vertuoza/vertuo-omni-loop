# ADR-0016 — The kit reads its own repository address from the kit checkout's origin remote, recorded in the bundle at build time

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #39 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #40

## Context

Whether the kit's own repository address (used in the npx line the refusal prints, and later in the closing steps) is read from the kit checkout's origin remote — at build time for the bundle, at run time from source — or written as one constant in the kit.

## Decision

The kit's own address, used in the npx line and later closing steps, comes from the kit checkout's origin remote. The build records it in the bundle, and source reads the same remote at run time, so no address literal is written in the kit.

The option chosen: A. Read the kit address from the kit checkout's origin remote, recorded in the bundle at build time (built).

## Consequences

One function (kitHome) and the define in kit/build.mjs: swapping in a constant elsewhere is a few lines, no migration.

## Source

`.omni-loop/delivery/shipped/0039-omni-init/outbox/settled.md`, entry `s1-02-kit-home-from-git-remote`
