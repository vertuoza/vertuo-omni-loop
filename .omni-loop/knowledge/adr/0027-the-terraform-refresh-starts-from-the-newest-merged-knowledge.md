# ADR-0027 — The terraform refresh starts from the newest merged knowledge-folder change whose title names the setup

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #68 · **Decided:** nobody — adopted when raised (medium), 2026-09-26 · **Merged:** @pierrederval, 2026-09-26, PR #69

## Context

Whether the refresh finds its starting point from the title of the last merged change, or from something written down on purpose, such as a date kept in the knowledge folder.

## Decision

A refresh finds its starting point from the newest merged change to the knowledge folder whose title mentions the setup by name, and re-reads only sources changed after it. If none is found, it asks for a full run.

The option chosen: A. A: the newest merged change to the knowledge folder whose subject says invade (built)

## Consequences

A constant in one skill's prose: switching to a recorded date is a paragraph rewrite, no data to migrate.

## Source

`.omni-loop/delivery/shipped/0068-omni-invade/outbox/settled.md`, entry `s3-01-refresh-finds-the-last-run-by-its-title`
