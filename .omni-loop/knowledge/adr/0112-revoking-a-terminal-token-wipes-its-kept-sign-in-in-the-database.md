# ADR-0112 — Revoking a terminal token wipes its kept sign-in in the database and does not end it at the sign-in service

**Status:** adopted · **Date:** 2026-10-12 · **PRD:** #1628 · **Decided:** nobody — adopted when raised (medium), 2026-10-11 · **Merged:** @pierrederval, 2026-10-12, PR #1629 · **Layers:** auth, db · **Domain:** access

## Context

Accept that a revoked token's last access runs out within the hour, or ask for the sign-in to be ended at the sign-in service as well.

## Decision

Revoking a terminal token wipes its kept sign-in from the database at once, so it can never be renewed. The sign-in service is not told, so access already handed out runs out within the hour, as the spec allows.

The option chosen: A. A. Wipe the kept sign-in in the database; access already handed out lasts an hour at most (built)

## Consequences

Ending it at the sign-in service too means revoking through galaxy's server instead of the database alone: a change to the profile page's revoke and an admin call.

## Source

`.omni-loop/delivery/shipped/1628-cloud-sign-in/outbox/settled.md`, entry `s1-04-revoke-signout`
