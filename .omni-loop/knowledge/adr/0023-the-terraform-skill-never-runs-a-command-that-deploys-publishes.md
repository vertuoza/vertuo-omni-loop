# ADR-0023 — The terraform skill never runs a command that deploys, publishes, releases or changes shared data

**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #45 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-25, PR #46

## Context

Decision 6 and step 4 of the spec say every command is run once, green, before it is written, and its slot carries `verified: <date>`. The releasing form's `how` and `rollback` slots, and some CI steps, name commands that deploy, publish or migrate: running them to verify them would publish. The spec does not say which commands terraform may run.

## Decision

Terraform runs only commands that check or build. Commands that deploy, publish, release, migrate a shared database or write a shared environment are never run and never marked verified; their slot points at the defining file or asks a person.

The option chosen: A. Never run a command that deploys, publishes, releases or changes shared data; point at where it is defined, or ask a person.

## Consequences

A constant: a few lines of skill prose, before or after merge. Forms written meanwhile hold pointers to where those commands live, which stay true under any later rule.

## Source

`.omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md`, entry `s5-04-terraform-never-runs-a-command-that-publishes`
