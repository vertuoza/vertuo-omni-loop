# ADR-0012 — The parallel wave never asks a person; it records decisions and reports serious ones for the pull request

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #9

## Context

Upstream vertuo-parallel-wave carried a consultation policy: under vertuo-deliver it asked about high and human-action items in the prompt and settled the answers on the spot. PRD 7 ships only /omni:yolo, which asks nothing; /omni:deliver is out of scope (spec §4).

## Decision

The wave never stops to consult a person. It records every decision, accepts minor ones, and lists high and human-action items in its report so they are answered at the feature pull request's gate.

The option chosen: A. Never ask; record and report (built).

## Consequences

Low: a later /omni:deliver can ask after the wave returns, from the report's items, without changing this skill.

## Source

`.omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md`, entry `s8-02-wave-asks-nothing`
