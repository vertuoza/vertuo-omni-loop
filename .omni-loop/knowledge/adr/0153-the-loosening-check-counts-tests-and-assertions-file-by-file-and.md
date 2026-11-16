# ADR-0153 — The loosening check counts tests and assertions file by file and reads the floors and baselines from a kit constant

**Status:** adopted · **Date:** 2026-11-16 · **PRD:** #2898 · **Decided:** nobody — adopted when raised (medium), 2026-11-15 · **Merged:** @pierrederval, 2026-11-16, PR #2902

## Context

The spec lists the weakenings but not how they are measured. The detector (`kit/lib/ready/loosening.ts`) counts declarations, `expect(` calls, skip markers, suppressions and timeouts in each file at both ends, so a renamed test and a stronger assertion are clean, but a test moved between files fails check 4 until an item excuses it. A timeout key or a trailing test timeout new in a file counts as raised. The floor and baseline ground is `READY_LOOSENING_GROUND` in `kit/lib/config.ts` (`mutation/floor.json`, `fallow/`, `layering/`), the one file allowed to carry repository literals, not a config key: the spec names no setting for it.

## Decision

The ready check's loosening detector compares each file at both ends, so a moved test reads as removed and a new timeout as raised, sending doubt to a person. Floors and baselines are read from READY_LOOSENING_GROUND, with no setting yet.

The option chosen: A. Count file by file and read the floors and baselines where the spec names them: what was built.

## Consequences

Comparing across files is a change inside the detector; a `ready.floors` and `ready.baselines` setting is one schema key each, the constant becoming their default.

## Source

`.omni-loop/delivery/shipped/2898-ready-five-checks/outbox/settled.md`, entry `s1-04-loosening-reads-per-file`
