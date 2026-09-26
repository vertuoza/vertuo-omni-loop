# ADR-0022 — ADR-0017 — /omni:terraform continues its open pull request, and starts afresh from the default branch once that one is merged or closed

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

`branches.terraform` is one fixed name (default `docs/omni-terraform`, no placeholder), and `/omni:terraform --refresh` runs again later on the same repository. The spec says terraform opens one pull request on that branch, and does not say what happens when the branch, or its pull request, already exists.

## Decision

A re-run of /omni:terraform continues the open pull request on its fixed branch, so only one is ever open. Once that pull request is merged or closed, it restarts the branch from the default branch and force-pushes with lease, never forcing a branch whose pull request is open.

The option chosen: A. Continue the open request; after a merge or a close, start afresh from the main line, replacing what the earlier run left under that name.

## Consequences

A constant: a few lines of skill prose, before or after merge. A forced push over a merged branch loses nothing, and a closed pull request's commits stay readable on GitHub.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s5-02-terraform-continues-its-open-pull-request`
