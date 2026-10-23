# ADR-0122 — The PRD timeline shows lanes only for repositories the stages sync already reads

**Status:** adopted · **Date:** 2026-10-22 · **PRD:** #2370 · **Decided:** nobody — adopted when raised (medium), 2026-10-22 · **Merged:** @pierrederval, 2026-10-22, PR #2371

## Context

Whether a target repository that carries no `.omni-loop/config.yml` should still give its PRD a lane. Today the stages sync only lists the repositories the App reaches that carry the config (`knowledgeReader.repos`), and the reader returns an empty snapshot for any other, so a config-less target is never read.

## Decision

A PRD's timeline gets a lane only for a target repository that carries the loop's config and is read by the quarter-hourly stages sync. A config-less target shows no lane, so the sync makes no extra GitHub list calls.

The option chosen: A. Keep it: a lane only for a repository the loop already reads, with its settings.

## Consequences

Low. Lanes are dated by GitHub's own times, so reading more repositories later (B) only means listing the plan's targets and reading their pull requests: the first sync of a repository reads it in full and fills every lane it shows, shipped PRDs included. No stored shape changes.

## Source

`.omni-loop/delivery/shipped/2370-prd-timeline/outbox/settled.md`, entry `s4-01-target-lanes-from-synced-repositories`
