# ADR-0072 — A flow hook file carries an optional header, {name} inputs, and its step's verdict as its strict last line

**Status:** adopted · **Date:** 2026-10-06 · **PRD:** #1089 · **Decided:** nobody — adopted when raised (medium), 2026-10-06 · **Merged:** @pierrederval, 2026-10-06, PR #1090

## Context

Whether the hook file shape, the curly-brace inputs and the strict last-line verdict are the ones the team wants before the skills start following them in a later slice.

## Decision

A hook file may open with a fenced or first-lines header; slice details replace {name} placeholders; its last line must be the verdict for that exact step. Naming the usual merge or report setting is not shown as a change.

The option chosen: A. A. Keep it: a fenced or first-paragraph header, {name} inputs, the verdict as the strict last line for that step, squash and report not shown as changes.

## Consequences

A constant change in kit/lib/flow/show.ts or kit/lib/flow/verdict.ts and their snapshots: another placeholder syntax, a looser verdict search or counting squash as a change is a few lines; no stored data moves.

## Source

`.omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md`, entry `s4-01-flow-show-shapes`
