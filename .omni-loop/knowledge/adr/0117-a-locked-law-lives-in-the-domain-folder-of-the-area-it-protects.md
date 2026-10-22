# ADR-0117 — A locked law lives in the domain folder of the area it protects, with its id kept

**Status:** accepted · **Date:** 2026-10-22 · **PRD:** #2346 · **Decided:** @pierrederval via feature pull request #2348, 2026-10-22

## Context

Until PRD 2346 every rule and invariant of this repository sat in `knowledge/product/`, and each law
reached the files it protects only through a hand-written `Governs:` pattern. `omni kb laws --paths`
printed all 20 locked laws for any file, so the one that mattered read like the rest. PRD 2346 gave
each file a domain (the `knowledge:` folder of the first flow area that matches it) and layers.

## Decision

A locked law, and every rule of the same area, lives in `knowledge/domains/<domain>/`, the folder of
the area it protects. Moving it keeps its id, its text byte for byte and its lock, with a
`Kept id: moved from product, PRD 2346` line. A law with no area stays in `product/` and is global.

## Consequences

- An agent working in an area sees that area's laws first, and no longer sees the laws of other
  areas; `omni kb laws` with no flag still prints every law.
- CODEOWNERS follows the files that hold laws: `omni kb owners` is rerun whenever a law moves.
- The base-branch law comparison keys laws by id, so a move is never read as a law losing its test.

## Source

`.omni-loop/delivery/outbox/2346-knowledge-by-domain-and-layer/settled.md`, entry
`s7-01-laws-move-into-domain-folders`.
