# ADR-0148 — A runner raises a workflow step as a human-action item, with its exact lines

**Status:** accepted · **Date:** 2026-11-19 · **PRD:** #3065 · **Decided:** @pierrederval via feature pull request #3066, 2026-11-18

## Context

A new `supabase/checks/` file runs as its own step of the `supabase` workflow (conventions › A new
database check runs in CI). On a runner, the push of that step was refused: GitHub does not let a
GitHub App change a file under `.github/workflows/` without the `workflows` permission.

## Decision

On a runner, a slice that needs a workflow change keeps the rest of its work, drops the workflow
edit, and raises one human-action item giving the file, the place and the exact lines to add. A
person commits them with an account that may change workflows, then answers the item.

## Consequences

The check exists before CI runs it: until the person adds the step, the feature PR's outbox stays
red on that item, so the gap is never silent.

## Source

`.omni-loop/delivery/shipped/3065-mission-retros/outbox/settled.md`, entry `s2-03-mission-retros-check-in-ci`.
