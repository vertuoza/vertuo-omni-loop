# ADR-0121 — The sync finds a server-born PRD's feature pull request by the closing line in its description

**Status:** adopted · **Date:** 2026-10-22 · **PRD:** #2370 · **Decided:** nobody — adopted when raised (medium), 2026-10-22 · **Merged:** @pierrederval, 2026-10-22, PR #2371

## Context

Answer A to keep finding these PRDs' feature pull requests by their closing line. Answer B to date them only once they ship and their folder reaches the main branch, accepting that their earlier slices go unrecorded.

## Decision

For a PRD approved on the Omni page, whose folder stays off the main branch until it ships, the sync takes as its feature pull request the one on a feature branch whose description closes that PRD. It dates the PRD's slices, ready and merge from that pull request while it is built.

The option chosen: A. Find the feature pull request of a PRD approved on the Omni page by the line that closes it.

## Consequences

A: none beyond the description already in the list, and the events of that one pull request. B: a few lines to remove; those PRDs' first and last slice stay not recorded, since a later read only sees what changed recently.

## Source

`.omni-loop/delivery/shipped/2370-prd-timeline/outbox/settled.md`, entry `s1-02-server-born-feature-pr`
