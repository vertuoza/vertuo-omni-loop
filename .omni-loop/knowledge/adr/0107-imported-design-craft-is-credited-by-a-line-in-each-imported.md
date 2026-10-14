# ADR-0107 — Imported design craft is credited by a line in each imported file, with the full notice and licence text kept in kit/NOTICE.md

**Status:** adopted · **Date:** 2026-10-11 · **PRD:** #1369 · **Decided:** nobody — adopted when raised (medium), 2026-10-10 · **Merged:** @pierrederval, 2026-10-11, PR #1371

## Context

Whether the skill folder gets its own copy of the notice and licence text.

## Decision

The full notice and licence text for imported design craft live only in kit/NOTICE.md. Each imported file in the plugin opens with a line naming its source and licence and saying it was changed; the plugin carries no copy of the notice.

The option chosen: A. Keep the notice in the kit only, with a credit line in every imported file (built).

## Consequences

Adding the copy later is one file in the skill folder and one test line; nothing else moves.

## Source

`.omni-loop/delivery/shipped/1369-design-craft/outbox/settled.md`, entry `s3-01-notice-in-the-plugin`
