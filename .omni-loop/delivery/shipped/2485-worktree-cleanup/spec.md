---
prd: 2485
title: The kit removes the worktrees it creates
blocked-by: none
spec: file
phase0: server
---

## Problem

Every slice agent of a wave works in its own worktree, under the `worktrees` folder (`.claude/worktrees`). The agent commits, so its worktree is never empty, and nothing ever removes it: each one keeps a full copy of the repository and its own `node_modules`. One developer laptop measured about 186 GB of them. The worktrees the kit adds itself without removing them, the feature worktree `/omni:brainstorm` cuts (`<worktrees>/<topic>`) and its phase-0 worktree, pile up the same way. A person finds out when the disk is full, and cleaning by hand risks deleting work that was never pushed.

## Solution

One engine, `omni worktrees`, and three moments that call it. The kit removes only what it knows it created, and only once that work is safe on the remote.

1. **What the kit recognises as its own.** A worktree under `worktrees` whose checked-out branch matches one of the `branches.*` shapes (`slice`, `feature`, `phase0`, filled with any topic and slice) is `kit`. Every other worktree is `other` and never touched: one outside `worktrees`, one on a branch no shape matches, and one in detached HEAD.
2. **What is safe to remove.** A `kit` worktree is `safe` only when all of these hold; otherwise it is `kept`, with the first reason that fails:

   | reason | rule |
   |---|---|
   | `uncommitted` | `git status --porcelain` in it is not empty |
   | `unpushed` | its HEAD is in no `<remote>/*` branch (`git branch -r --contains`), read after one `git fetch` per call |
   | `claimed` | its slice is claimed and not merged on `omni board <prd> --json` |
   | `red slice` | its slice is not merged (red, stopped, blocked, held) while its feature PR is open |
   | `in use` | a process has its working directory inside it (`lsof -a -d cwd` on macOS, `/proc/*/cwd` on Linux); a read that fails keeps it |

   Once the PRD's feature PR is merged or closed, a slice's board state no longer keeps its worktree: only `uncommitted`, `unpushed` and `in use` do.
3. **Removing.** `git worktree remove <path>`, then `git branch -d <branch>`, never `-D` and never `--force`. A removal git refuses is reported as `kept <path> · <git's reason>`, and the next worktree is tried.
4. **The command.** `omni worktrees`:
   - `list [--json]`: every worktree of the repository, `kit` or `other`, and each `kit` one's verdict, `safe` or `kept: <reason>`.
   - `prune [--prd <n>] [--dry-run]`: removes every `safe` worktree (of PRD `<n>` alone with `--prd`), printing `removed <path> · <size>` or `kept <path> · <reason>` per `kit` worktree, then `freed <total>`. The size is measured just before the removal, and only then. `--dry-run` removes nothing and prints `would remove` in place of `removed`.
   - `remove <path>`: the same rules on one worktree the caller names. It is the one way a detached worktree under `worktrees` is removed: the caller says it created it.
   - `hint`: one line, `<k> worktrees of the kit can be removed: omni worktrees prune`, or nothing when there are none. No network, no size, no board read: it counts `kit` worktrees that are clean and whose HEAD a remote-tracking ref already holds, and returns within one second.
   - Every verb exits 0 whatever it keeps. Exit 1 only when the repository cannot be read.
5. **The three moments.**
   - **`/omni:wave`**, step 4: once a sub-PR is merged, `omni worktrees remove <the slice's worktree>`, the path its agent call returned. **Inline wave**: the same after each `done` slice. The line it prints goes in the wave's report.
   - **`/omni:yolo`**, just before **7. Hand off**, gate green or red: `omni worktrees prune --prd <n>`. It removes the merged slices' worktrees and the PRD's feature and phase-0 worktrees once they are clean and pushed. A red, stopped or blocked slice keeps its worktree for the person who reads why it failed. The hand-off lists each kept worktree with its path and reason. **`/omni:yolo-fix`** runs the same at its end.
   - **When a session starts**: a fourth `SessionStart` hook, `omni worktrees hint || true`, prints the hint. It only suggests: a person may have a session open in one of these worktrees.
6. **Help and guide.** `omni help worktrees`, and the command's line in the guide's list of commands.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | kit | logic `kit/lib/worktrees/`, command `kit/bin/commands/worktrees.ts` | no written convention: follows `kit/lib/claim/check.ts` and `kit/bin/commands/claim.ts` |
| omni-loop | kit | verbs `list`, `prune`, `remove`, `hint` (a noun, then a verb) | ← `kit/bin/omni.ts:61` (`claim: ['check']`) |
| omni-loop | kit | verdicts `safe`, `kept: <reason>`, lines `removed` / `kept` / `would remove` / `freed` | No name chosen elsewhere: new words, plain English |
| omni-loop | plugin | `SessionStart` hook, `node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" <verb> \|\| true`, timeout 10 | ← `kit/plugin/hooks/hooks.json:7` |

## Decisions

- **Clean automatically in wave and yolo; only suggest at session start** (asked): a person may have a session open in one of the worktrees.
- **Remove the whole worktree, not only `node_modules`** (asked): its branch is on the remote, so nothing is lost.
- **Recognise the kit's worktrees by their branch shape** (asked), not by a manifest. A detached worktree is never swept; the wave removes its inline slices' detached worktrees by their path.
- **The voice's objection, accepted.** persona:B-E DEv: "When a slice ends red, its worktree is where I go to see what broke, with its logs and `node_modules` already installed." So `/omni:yolo` keeps the worktrees of red, stopped and blocked slices while the feature PR is open, and names them in its hand-off; a later `omni worktrees prune` removes them once the feature PR is merged or closed.
- **The feature and phase-0 worktrees are swept too** (asked, design section 1): they live under the same folder and pile up the same way.
- **Nothing becomes an outbox item**: removing or keeping a worktree decides nothing for a person; a kept one is reported.
- **No `--force`**: a worktree the rules keep is never removed by the kit.

## User stories

- As a developer, after `/omni:yolo` my disk holds no worktree of the PRD but the ones it names, each with why it stayed.
- As a developer, `omni worktrees prune --dry-run` tells me what would go and how much it frees, before anything is removed.
- As a developer who opened a session inside a worktree, the kit never removes it from under me.
- As a person debugging a red slice, its worktree is still there after the yolo.
- As a runner owner, the runner's disk no longer fills up wave after wave.

## Scope

In: `omni worktrees` (`list`, `prune`, `remove`, `hint`) and its help, the calls in `/omni:wave`, `/omni:yolo` and `/omni:yolo-fix`, the `SessionStart` hook, the guide's line, the rebuilt `kit/dist/`. Out: the target clones of `/omni:ultra-yolo` (`<worktrees>/targets/…`), the worktrees the other skills already remove, any worktree outside `worktrees`, pnpm's own store.

## Test seams

Following `omni kb show testing`: vitest unit tests over real temporary git repositories with a `file://` remote, no network and no GitHub. The board is read through an injected seam, and the process check through another, so no test calls `gh` or lists the machine's processes.

- One test per keep reason: `uncommitted`, `unpushed`, `claimed`, `red slice`, `in use`.
- `other` is never touched: a branch no shape matches, a worktree outside `worktrees`, a detached one under `prune`.
- `remove` of a detached worktree the caller names.
- `git branch -d` refused: the worktree is gone, the branch kept, and both reported.
- `--dry-run` removes nothing and prints the same lines with `would remove`.
- After the feature PR is merged, a red slice's clean, pushed worktree is `safe`.
- Every verb exits 0 when it keeps worktrees; `hint` reads no network and no board.
- The skills' text: the existing skill-text tests check that wave, yolo and yolo-fix name the command at their step.

## Risks

Merging publishes the kit: every repository that updates it starts removing worktrees. The harm a bug could do is deleting work; the rules keep anything uncommitted, unpushed, in use or not the kit's, and git itself refuses to remove a dirty worktree. Rollback: revert the PR and release; nothing stored changes, and a removed worktree is restored with `git worktree add <path> <remote>/<branch>`.

The Legal entries: none touched.

The locked laws the hook file falls under (`kit/plugin/hooks/hooks.json`, domain ask), none of them changed by this PRD:

- N-PRODUCT-7: a broken hook would block a person's message or question, locking them out of their own terminal. The new hook ends with `|| true` and returns within one second. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-8: the ask hooks would call an address the repository never set, sending a person's questions elsewhere. The new hook calls no address at all. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: an answer would change after it was given, and the terminal would act on words the person no longer stands behind. Untouched. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: ask mode would let in someone outside the workspace, who could read a team's questions. Untouched. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a session of no workspace would be read or deleted, leaking a question or losing it. Untouched. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-94: a terminal token would mark an answer as given, an agent answering in a person's name. Untouched. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-5: a feature would leave draft while a question is open, and a person could merge unanswered decisions. Untouched: cleaning never marks anything ready. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: an agent would merge into the main branch, shipping unreviewed work. Untouched: cleaning merges nothing. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

1. After `/omni:wave` merges a sub-PR, the slice's worktree is gone from `git worktree list`, and the wave's report says `removed <path>`.
2. After `/omni:yolo` ends, gate green or red, `git worktree list` shows no worktree of the PRD but the ones its hand-off names, each with its reason.
3. A worktree with an uncommitted change, a commit no remote branch holds, a process working inside it, or a branch no `branches.*` shape matches is never removed, and `prune` prints it as `kept <path> · <reason>`.
4. A red slice's worktree survives `/omni:yolo`, and `omni worktrees prune` removes it once the feature PR is merged or closed and the worktree is clean and pushed.
5. `omni worktrees prune --dry-run` removes nothing and prints what it would remove, with each size and the total.
6. When a session starts in a repository with removable worktrees, one line names how many and the command; with none, nothing is printed, and the hook never delays the session by more than a second.
7. Every `omni worktrees` verb exits 0 when it keeps worktrees.
