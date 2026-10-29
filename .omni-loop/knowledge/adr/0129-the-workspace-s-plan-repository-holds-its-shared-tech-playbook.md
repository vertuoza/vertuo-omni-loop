# ADR-0129 — The workspace's plan repository holds its shared tech playbook, and a workspace naming none gets an empty playbook with a reason

**Status:** adopted · **Date:** 2026-10-23 · **PRD:** #2417 · **Decided:** nobody — adopted when raised (medium), 2026-10-23 · **Merged:** @pierrederval, 2026-10-23, PR #2479

## Context

Pick the repository to read when the workspace names no plan repository: a repository the workspace names for it, or the first repository it lists. Changing the choice is one function (settingsRepositoryOf) in the settings service.

## Decision

The playbook page reads the workspace's plan repository as its settings repository. A workspace that names no plan repository gets an empty playbook and a line saying why, never an error.

The option chosen: A. A. Read the plan repository; none named means an empty playbook with a reason (built)

## Consequences

Changing the choice later costs one small function and its test; no stored data depends on it.

## Source

`.omni-loop/delivery/shipped/2417-tech-defaults/outbox/settled.md`, entry `s3-01-settings-repo-when-none-named`
