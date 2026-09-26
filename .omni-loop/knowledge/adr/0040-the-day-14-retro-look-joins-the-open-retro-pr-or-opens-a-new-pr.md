# ADR-0040 — The day-14 retro look joins the open retro PR, or opens a new PR from the default branch once that one is merged or closed

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #72 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #75

## Context

The spec says the day-14 run commits to the same branch while its PR is open and opens `<branch>-day-14` once it is merged. It does not say where that branch starts, nor what a first PR closed without merging leads to.

## Decision

While the first retro PR is open, the day-14 look is committed to it. Once merged or closed, <branch>-day-14 is cut from the default branch head and carries the whole retro again with the new section.

The option chosen: A. Open a new pull request from the main line whenever the first is no longer open, merged or closed, the option built.

## Consequences

A constant in `publish.mjs`: which PR states count as gone, and the ref the new branch is cut from.

## Source

`.omni-loop/delivery/shipped/0072-retro/outbox/settled.md`, entry `s8-02-day-14-after-the-first-retro-pr`
