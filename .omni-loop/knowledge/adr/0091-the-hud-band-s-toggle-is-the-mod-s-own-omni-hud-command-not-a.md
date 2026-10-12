# ADR-0091 — The HUD band's toggle is the mod's own /omni-hud command, not a skill in the omni plugin

**Status:** adopted · **Date:** 2026-10-08 · **PRD:** #1208 · **Decided:** nobody — adopted when raised (medium), 2026-10-08 · **Merged:** @pierrederval, 2026-10-08, PR #1210

## Context

Whether /omni-hud is the name people type to hide or show the band, or whether the toggle should live somewhere else.

## Decision

The command that hides or shows the session band is /omni-hud, registered by the HUD mod itself, because Claude Code forbids a colon in a plugin's own command name. Hiding persists across later sessions until it is typed again.

The option chosen: A. A. Keep /omni-hud, the plugin's own name, registered by the mod itself.

## Consequences

A rename is one string in the mod, its reply line and its tests: no stored data changes, and the off switch kept in the person's settings stays as it is.

## Source

`.omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md`, entry `s6-01-hud-command-name`
