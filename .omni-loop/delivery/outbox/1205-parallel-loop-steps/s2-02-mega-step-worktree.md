---
id: s2-02-mega-step-worktree
prd: 1205
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the loop builds several cross-repository PRDs at once, does each one also get its own copy of the planning repository, or only its own copies of the code repositories?

## The decision, in plain words

Each one gets both: its own working copy of the planning repository, and its own copies of the code repositories, kept in one shared place so every step of that PRD finds them again.

## The intro, for fun

Three builders, one notebook, and everyone wants to write on the same page.

## The punchline, for fun

Everyone gets a notebook; the shared shelf keeps the copies.

## The options, in plain words

A. Step agents run in a worktree too, and the per-PRD clones sit under the main checkout (built).
B. Step agents run in the loop's checkout, as the spec words it, with per-PRD clones only.
C. Step agents run in a worktree, and each keeps its clones inside that worktree.

## What I had to decide

The spec gives mega-drive a target clone per PRD and gives the worktree isolation to drive only. But the ultra skills also commit in the plan repository (the plan PR's branch, the outbox relays), so two running in the loop's checkout would fight over its HEAD just as two waves would. So mega-drive's step agents run with isolation worktree too. A worktree would then read omni config worktrees relative to itself and clone the targets afresh each step, so the clone path is taken from the plan repository's main checkout (the folder holding git rev-parse --git-common-dir), and the exclude line goes to info/exclude under that common git folder.

## What I did meanwhile

mega-drive step 3 and ultra-yolo step 2 item 1 say so; the other ultra skills, mega-pr-care, do-work --target and pr --repo read the clone at <worktrees>/targets/<name>@<prd>.

## What it costs to change later

A constant: wording in kit/plugin/skills/mega-drive/SKILL.md and kit/plugin/skills/ultra-yolo/SKILL.md. Old clones at <worktrees>/targets/<name> are left on disk, unused.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Clones made before this change at <worktrees>/targets/<name> are not moved or removed; the next run clones each PRD's afresh.
