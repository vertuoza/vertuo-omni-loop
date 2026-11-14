# ADR-0139 — Checkpoint upload links keep the storage's fixed two-hour life, limited to one upload of one path by the job's own runner

**Status:** adopted · **Date:** 2026-11-14 · **PRD:** #2809 · **Decided:** nobody — adopted when raised (medium), 2026-11-13 · **Merged:** @pierrederval, 2026-11-14, PR #2810

## Context

A keeps the storage's two hours as built. B shortens it: the app would refuse to record a save whose upload came more than a set number of minutes after its link (a constant in the service), which limits what a late upload can do but not the link itself.

## Decision

A job's saved-work upload link lives the storage service's fixed two hours, and the reply says when it expires. It allows one upload to one private path, cannot overwrite an existing save, and is issued only to the job's own runner.

The option chosen: A. A. Keep the storage's two-hour upload link, for one upload of one path, and say so in the reply

## Consequences

A constant in the service and one check before the record: no stored shape changes.

## Source

`.omni-loop/delivery/shipped/2809-unlosable-jobs/outbox/settled.md`, entry `s4-02-upload-link-two-hours`
