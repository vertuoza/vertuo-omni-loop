# ADR-0017 — omni init writes the blank knowledge forms and ends by naming /omni:terraform

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

PRD 39's `omni init` merged after this spec was first written. The spec had left the installer out of scope, with `omni kb init` as a separate command. Now that `omni init` ships, a repository can be installed without any forms, so the spec has to say whether the install lays them down. This is spec decision 13, added while re-planning and never put to the PRD author.

## Decision

The one-line install runs the forms writer after writing the config and the bin, so no repository is installed without knowledge forms. Its closing steps point to /omni:terraform to fill them.

The option chosen: A. The install writes the blank forms after the config and the bin, and its closing steps name the terraform skill.

## Consequences

Before s4 merges: drop s4's forms step and the closing line from the plan, a few minutes. After it merges: revert s4's commit. Repositories installed in between keep their blank forms, which are harmless.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s4-01-init-lays-down-the-forms`
