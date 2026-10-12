# ADR-0092 — The HUD band's folder is checked by Claude Code's own validate and test commands, not the repository's linter or dead-code audit

**Status:** adopted · **Date:** 2026-10-08 · **PRD:** #1208 · **Decided:** nobody — adopted when raised (medium), 2026-10-08 · **Merged:** @pierrederval, 2026-10-08, PR #1210

## Context

Whether skipping the band's folder in the linter and the dead-code audit is acceptable, with Claude Code's own checks standing in for them.

## Decision

The linter and the dead-code audit skip kit/plugin-hud, because its code depends on type definitions only Claude Code provides. Claude Code's validate and test commands check it instead, run from the plugin guard test whenever Claude Code is installed.

The option chosen: A. A. Skip the band's folder in the linter and the dead-code audit, and let Claude Code's validate and test commands check it.

## Consequences

Undoing it means removing those two lines and adding a pinned copy of Claude Code's type definitions to the repository so both tools can read the band; no stored data is involved.

## Source

`.omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md`, entry `s6-02-hud-outside-repo-checks`
