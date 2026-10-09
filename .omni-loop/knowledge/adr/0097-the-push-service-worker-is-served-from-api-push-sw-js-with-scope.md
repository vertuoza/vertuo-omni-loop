# ADR-0097 — The push service worker is served from /api/push/sw.js with scope '/', not as a static /sw.js

**Status:** adopted · **Date:** 2026-10-09 · **PRD:** #1322 · **Decided:** nobody — adopted when raised (medium), 2026-10-09 · **Merged:** @pierrederval, 2026-10-09, PR #1324

## Context

Whether the service worker is served at /api/push/sw.js with scope '/' instead of a static /sw.js.

## Decision

The app serves the phone-alert service worker from its alert routes at /api/push/sw.js, built from src/push/worker.ts, with Service-Worker-Allowed: / so it is registered for the whole site. No hand-written script sits in the public folder.

The option chosen: A. Serve the worker from the alert routes, allowed the whole site (what was built).

## Consequences

A constant: moving it to /sw.js later is a route or a rewrite, and the path the switch registers; browsers keep the old worker until it is unregistered or replaced.

## Source

`.omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md`, entry `s9-03-service-worker-address`
