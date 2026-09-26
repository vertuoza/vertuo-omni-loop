# ADR-0035 — The retro page lists each finding once, worst first, and retro.json keeps one record per run

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #72 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #75

## Context

The layout of `retro.md` and the shape of `retro.json`. The spec's sketch has Findings, Proposed lessons, Timeline, Decisions, Rules and After merge; the plan asks `render` to place "each kind's findings under the section that kind names", so no later slice edits it. The spec says only that `retro.json` "holds the fact sheet of every run", yet a later reader may compare it across PRDs.

## Decision

retro.md ranks every finding once, then gives each kind a section referring back to its findings, then the rules. retro.json holds one record per run: fact sheet, narration and issue links, replaced on replay.

The option chosen: A. Problems once, worst first, then a section per kind referring back, and one data record per run, the option built.

## Consequences

Before any retro is merged into a repository, a change is `render` and its golden files. After, the retro files already merged keep the old layout, and anything reading `retro.json` across PRDs reads both shapes, told apart by each record's rules version.

## Source

`.omni-loop/delivery/shipped/0072-retro/outbox/settled.md`, entry `s2-06-retro-file-layout`
