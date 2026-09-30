# ADR-0057 — The stage clock is counted down by the scoring rules from a once-a-second report sent by the game engine

**Status:** adopted · **Date:** 2026-09-30 · **PRD:** #817 · **Decided:** nobody — adopted when raised (medium), 2026-09-30 · **Merged:** @pierrederval, 2026-09-30, PR #818

## Context

How the clock reaches the rules, beside the five things the spec says the engine reports.

## Decision

The game engine reports each second of play, and the rules count the stage's 300-second clock down, cost a life at zero and pay the time bonus. A paused game sends no report, so the clock stops with it.

The option chosen: A. The engine reports each second and the rules count down, as built.

## Consequences

A small change to the engine's side and the rules; nothing stored.

## Source

`.omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md`, entry `s2-02-stage-clock-told-by-the-game`
