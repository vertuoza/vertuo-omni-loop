# Plan: the kit removes the worktrees it creates

PRD #2485. The spec is `spec.md`, beside this plan. The feature branch `feat/worktree-cleanup` merges into `main` with `Closes #2485`; each slice is a sub-PR from `feat/worktree-cleanup--<slice>` into the feature branch, with `Part of #2485`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni worktrees list`, `prune`, `remove` and `hint` tell the kit's worktrees from the others, keep each one that is uncommitted, unpushed, claimed, a red slice or in use, and remove the rest with `git worktree remove` and `git branch -d` | `kit/lib/worktrees/` `kit/bin/commands/worktrees.ts` `kit/bin/commands/index.ts` `kit/bin/omni.ts` `kit/bin/worktrees.test.ts` `kit/lib/help/entries.ts` | — | 1 | deep |
| s2 | when a session starts, a fourth `SessionStart` hook prints the hint line, or nothing | `kit/plugin/hooks/` `kit/test/hooks-json.test.ts` | s1 | 2 | light |
| s3 | `/omni:wave` removes a slice's worktree once its sub-PR merges (or its inline slice is done), `/omni:yolo` and `/omni:yolo-fix` prune the PRD's worktrees before their hand-off and name the kept ones, and the guide lists the command | `kit/plugin/skills/wave/` `kit/plugin/skills/yolo/` `kit/plugin/skills/yolo-fix/` `kit/test/worktree-cleanup-skills.test.ts` `docs/guide/any-agent.md` | s1 | 2 | build |

**Shared ground.** None between slices of one wave: s2 and s3 own disjoint paths. `kit/bin/omni.ts`, `kit/bin/commands/index.ts` and `kit/lib/help/entries.ts` are registries every command adds a line to; only s1 touches them. `kit/dist/` is generated: each slice rebuilds it to test and commits none, and the wave rebuilds it once after merging.

## Per slice: done when

### s1 (deep: the rules that decide what is deleted from a person's disk)

- In a temporary repository with a `file://` remote, `omni worktrees list --json` classes a worktree under `worktrees` on a `branches.slice`, `branches.feature` or `branches.phase0` branch as `kit`, and one on another branch, outside `worktrees`, or detached as `other`.
- Each keep reason has its test, and the worktree survives it: `uncommitted` (a modified file), `unpushed` (a commit no `<remote>/*` branch holds), `claimed` and `red slice` (through the injected board seam, while the feature PR is open), `in use` (through the injected process seam; a seam that fails keeps it).
- Once the board seam says the feature PR is merged or closed, a red slice's clean, pushed worktree is `safe`.
- `prune` removes every `safe` worktree, prints `removed <path> · <size>` or `kept <path> · <reason>` per `kit` worktree, then `freed <total>`; `--prd <n>` limits it to that PRD's; `--dry-run` removes nothing and prints `would remove`.
- `git branch -d` refused: the worktree is gone, the branch kept, and the line says so. No path ever runs `-D` or `--force`.
- `remove <path>` applies the same rules to one worktree, a detached one included.
- `hint` prints `<k> worktrees of the kit can be removed: omni worktrees prune`, or nothing, with no `git fetch`, no board read and no size, and returns within one second on a repository of 50 worktrees.
- Every verb exits 0 when it keeps worktrees; exit 1 only when the repository cannot be read.
- `omni help worktrees` prints the four verbs.

### s2 (light: one hook line and its test)

`kit/plugin/hooks/` is governed by N-PRODUCT-7 (a broken hook never blocks a person's message or question) and N-PRODUCT-8: the slice changes neither law, but a hook that hangs or fails loudly would lock a person out of their own terminal, so the line ends with `|| true` and calls no address.

- `kit/plugin/hooks/hooks.json` holds a fourth `SessionStart` entry, `node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" worktrees hint || true`, timeout 10, after the three that exist; its description names it.
- `kit/test/hooks-json.test.ts` checks the entry, its `|| true` and its place.

### s3

- `/omni:wave` step 4 runs `omni worktrees remove <the slice's worktree>` after each merged sub-PR, and **Inline wave** after each `done` slice; the line goes in the wave's report.
- `/omni:yolo` runs `omni worktrees prune --prd <n>` just before **7. Hand off**, gate green or red, and its hand-off lists each kept worktree with its path and reason; `/omni:yolo-fix` runs the same at its end.
- `kit/test/worktree-cleanup-skills.test.ts` reads the three SKILL.md files and finds each call at its step.
- `docs/guide/any-agent.md` lists `omni worktrees` with the other terminal commands.
