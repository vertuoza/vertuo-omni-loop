---
id: s1-02-old-claude-gate-test-deleted
prd: 1814
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The old commit check that only Claude ran is gone, and its test went with it. Do you agree the cases that still matter are now proven by the new checks' tests?

## The decision, in plain words

The old test is deleted, as the spec asks. Its cases that still apply, a check run inside a side copy of the repository and a missing tool named, are proven again by the new checks' tests.

## The intro, for fun

A guard retired today, and its replacement already took the oath.

## The punchline, for fun

The old badge goes in the drawer, not the bin: history keeps it.

## The options, in plain words

A. A. The old test is deleted, and its still-valid cases live in the new checks' tests.
B. B. The old Claude check and its test come back beside the new git checks.

## What I had to decide

Keep A unless a case the old test covered still matters to you. The old test also proved which typed commands counted as a commit or a push, which no longer applies: git itself now decides when its own checks run.
Decided by: Jev (hardToRevert 0.48) · agent said true

## What I did meanwhile

The new tests in scripts/check-changed-hooks.test.ts cover a worktree audited from its own root, a missing fallow and a missing pnpm named with run pnpm install, a fallow runtime error refusing, and git itself refusing a commit.

## What it costs to change later

Cheap: restoring the old test means restoring the old Claude hook it tested, one revert.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The old test's command-matching cases (git -C dir commit, git log commit-message.txt) have no successor, since git runs its own hooks; none was carried over (author)
