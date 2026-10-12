# ADR-0108 — Terminal tokens are locked with their own server secret key, never the key that locks the workspaces' Jev keys

**Status:** adopted · **Date:** 2026-10-12 · **PRD:** #1628 · **Decided:** nobody — adopted when raised (medium), 2026-10-11 · **Merged:** @pierrederval, 2026-10-12, PR #1629

## Context

Keep a separate key for terminal tokens, or share the existing secrets key.

## Decision

Each terminal token's stored sign-in is locked with a separate server secret key, set beside the others and listed in the setup guide. Without it, the deployment makes and accepts no terminal token and says so.

The option chosen: A. A. A separate key for terminal tokens, listed in the setup guide (built)

## Consequences

Switching to the shared key is one line in galaxy; every token made under the other key would have to be made again.

## Source

`.omni-loop/delivery/shipped/1628-cloud-sign-in/outbox/settled.md`, entry `s1-05-token-key-variable`
