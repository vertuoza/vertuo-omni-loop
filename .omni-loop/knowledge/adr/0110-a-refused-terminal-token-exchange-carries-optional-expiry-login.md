# ADR-0110 — A refused terminal token exchange carries optional expiry, login and workspace details that the terminal reads leniently

**Status:** adopted · **Date:** 2026-10-12 · **PRD:** #1628 · **Decided:** nobody — adopted when raised (medium), 2026-10-11 · **Merged:** @pierrederval, 2026-10-12, PR #1629

## Context

The names of the extra fields a 401 refusal of the token exchange carries, which the server slice (s1) must answer with: expires_at for an expired token (seconds, milliseconds or a date), login and workspace (an object with a name, or a name) for an ex-member; and the line printed for the reason unknown, which the spec does not give.

## Decision

A 401 refusal of the token exchange may carry expires_at for an expired token, and login and workspace for an ex-member. The terminal reads them leniently, leaves out any that are missing, and gives an unknown token its own line asking for a new one.

The option chosen: A. Read the date, the login and the workspace from the refusal, the option built.

## Consequences

Renaming a field is a one-line change on either side, before the feature merges.

## Source

`.omni-loop/delivery/shipped/1628-cloud-sign-in/outbox/settled.md`, entry `s2-01-refusal-details`
