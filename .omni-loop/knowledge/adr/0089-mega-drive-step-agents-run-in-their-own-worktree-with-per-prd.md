# ADR-0089 — Mega-drive step agents run in their own worktree, with per-PRD target clones under the plan repository's main checkout

**Status:** adopted · **Date:** 2026-10-08 · **PRD:** #1205 · **Decided:** nobody — adopted when raised (medium), 2026-10-08 · **Merged:** @pierrederval, 2026-10-08, PR #1206

## Context

The spec gives mega-drive a target clone per PRD and gives the worktree isolation to drive only. But the ultra skills also commit in the plan repository (the plan PR's branch, the outbox relays), so two running in the loop's checkout would fight over its HEAD just as two waves would. So mega-drive's step agents run with isolation worktree too. A worktree would then read omni config worktrees relative to itself and clone the targets afresh each step, so the clone path is taken from the plan repository's main checkout (the folder holding git rev-parse --git-common-dir), and the exclude line goes to info/exclude under that common git folder.

## Decision

When several cross-repository PRDs are built at once, each step agent runs in its own worktree of the plan repository, and each PRD's target clones live at <worktrees>/targets/<name>@<prd> resolved from the main checkout, so every step finds them again.

The option chosen: A. Step agents run in a worktree too, and the per-PRD clones sit under the main checkout (built).

## Consequences

A constant: wording in kit/plugin/skills/mega-drive/SKILL.md and kit/plugin/skills/ultra-yolo/SKILL.md. Old clones at <worktrees>/targets/<name> are left on disk, unused.

## Source

`.omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md`, entry `s2-02-mega-step-worktree`
