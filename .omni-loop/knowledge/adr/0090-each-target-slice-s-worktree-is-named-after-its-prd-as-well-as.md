# ADR-0090 — Each target slice's worktree is named after its PRD as well as its slice

**Status:** adopted · **Date:** 2026-10-08 · **PRD:** #1205 · **Decided:** nobody — adopted when raised (medium), 2026-10-08 · **Merged:** @pierrederval, 2026-10-08, PR #1206

## Context

do-work --target built each slice in <worktrees>/targets/<name>--<slice>. With a clone per PRD, two PRDs running at once can both reach slice s1 in one target, and the same folder would be asked for twice. The plan does not list it, but the spec's isolation rule (no two running steps share a HEAD) needs it, so the slice worktree is now <worktrees>/targets/<name>@<prd>--<slice>.

## Decision

Under do-work --target, a slice's worktree is <worktrees>/targets/<name>@<prd>--<slice>, beside that PRD's own clone, so two PRDs built at once never ask for the same folder.

The option chosen: A. The slice folder carries the PRD number beside the slice id (built).

## Consequences

A constant: the folder name in kit/plugin/skills/do-work/SKILL.md. Nothing is stored.

## Source

`.omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md`, entry `s2-03-slice-worktree-per-prd`
