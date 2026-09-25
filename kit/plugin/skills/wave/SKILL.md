---
name: wave
description: Build ONE wave of a PRD in parallel — read the board, claim every takeable slice, dispatch one worktree subagent per slice following /omni:do-work --in-wave, then merge their sub-PRs into the feature branch one at a time, check the wave together, adopt its medium decisions and report. Followed by /omni:yolo for each wave; a person may run it on a PRD. Never merges into the default branch. Triggers on "run the next wave", "build wave 3", "/omni:wave".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-parallel-wave/SKILL.md (and the board and wave-loop parts of vertuo-deliver) — changes in kit/porting/plugin--wave.md -->

# Wave: the takeable slices, in parallel, merged one at a time

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

Each slice is built by its own subagent in its own worktree and ends in its own sub-PR into the
feature branch. You, the orchestrator, only ever hold each slice's short result; that is what keeps
this conversation small. You merge; subagents never do.

## Input

A PRD number. Re-running on the same PRD picks up where the last run stopped: the board is rebuilt
from GitHub every time, never remembered.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` below is `repo.remote`. The feature branch is `branches.feature` with `{topic}` filled by
the PRD folder's topic (`node .omni-loop/bin/omni.mjs board <prd> --json` prints it as `prd.topic`).

Find the feature PR: `gh pr list --head <feature branch> --base <repo.defaultBranch> --state open
--json number,body`. No feature branch or no feature PR: stop, and say to follow `/omni:plan` first.

## 1. The board

```bash
node .omni-loop/bin/omni.mjs board <prd>          # print it, once, before acting
node .omni-loop/bin/omni.mjs board <prd> --json   # what you act on
```

The wave is `frontier.takeable`: the lowest wave's `runnable` and `claimed-stale` slices, with any
same-wave territory collision already deferred by the kit (`frontier.excluded`). Take it as given;
do not re-derive blockers, staleness or collisions. `frontier.wave` null or `takeable` empty:
nothing is takeable; print the board and stop. Slices `in-flight` are someone else's; leave them.

## 2. Claim every slice first

Before any subagent starts, `git fetch <remote>`, then, for each takeable slice, in board order:

- **`runnable`:** follow `/omni:pr`'s **Claim** mode with the slice id and its board `title`. It cuts
  the slice branch from the feature branch, makes the claim commit, pushes, opens the draft sub-PR
  and posts the `claimed` status comment.
- **`claimed-stale`:** its branch and draft sub-PR (the row's `pr.number`) already exist. Take it
  over: add `labels.inProgress` (subject to `/omni:pr`'s **Labels**) and rewrite its status comment,
  through `/omni:pr`'s marker recipe, with state `claimed` and the line "taken over from a stale
  claim".

## 3. Dispatch, one subagent per slice, in a single message

Launch every claimed slice concurrently (one message, several Agent calls), each with
`isolation: "worktree"`. Keep the prompt this small:

> Build slice `<id>` of PRD <prd>, on feature branch `<feature branch>`: follow `/omni:do-work
> --in-wave`. Its slice branch is already claimed. Do not spawn subagents. Return only do-work's
> result JSON: no diffs, no logs.

Nesting is at most three levels (`/omni:yolo` → this skill → do-work), so a slice subagent never
dispatches its own. Wait for every result. Each is
`{ slice, status: done | red | stopped | blocked, branch, prUrl, preflight, summary, risks, items }`.
A subagent that returns nothing usable counts as `red`, with "no result" as its summary.

## 4. Merge, one at a time

Run `node .omni-loop/bin/omni.mjs plan check <prd>` once. Red means a slice broke the plan; say so in
the report, and carry on.

Then take each `done` slice in board order. Each merge moves the feature branch, so read every
sub-PR afresh; never trust an earlier look.

1. **Base.** `gh pr view <n> --json baseRefName,isDraft,mergeable,labels`. The base must be the
   feature branch. Anything else: `gh pr edit <n> --base <feature branch>` (add `labels.sub` if it
   is missing), then read it again. **Never merge a PR whose base is `repo.defaultBranch`.**
2. **Territory.** `gh pr diff <n> --name-only`, against the slice's `territory` in the board JSON.
   A path is inside when it starts with a territory entry, or sits under the PRD's outbox dir
   (`node .omni-loop/bin/omni.mjs prd <prd>` prints it). Any other path is a **breach**: name it in
   the report and merge anyway. It is never fatal; it says the plan was wrong about the ground,
   and it is the first thing to read when a later sub-PR conflicts.
3. **Mergeable.** `UNKNOWN`: look again in a minute. `CONFLICTING`: in a worktree on the slice
   branch, `git merge <remote>/<feature branch>`, resolve, run the preflight (`commands.preflightFull`,
   or `commands.preflight` when null), push, and count one attempt. A conflict you cannot resolve
   with confidence goes to one fresh subagent, given both slices' intent.
4. **Ready.** Still a draft: follow `/omni:pr`'s **sub-PR lifecycle** for it; that skill owns
   `gh pr ready` and runs it once the preflight is green. It never becomes ready: do not merge it.
5. **Merge.** `gh pr merge <n> --squash --delete-branch`.

**Not merged:**

| result | what you do |
|---|---|
| `red`, or `done` but never ready or still conflicting after `limits.attempts` attempts | stuck. Make sure it carries `labels.needsFix` in place of `labels.inProgress` and `/omni:pr`'s stuck comment. |
| `stopped` | leave the draft. Report the law or principles it named. Its siblings still merge. |
| `blocked` | leave the draft. Report its human-action item. |

A slice that is not merged holds only what depends on it; the rest of the wave goes on.

## 5. Check the wave together

Slices that each passed alone can fail together. In a worktree on the freshly fetched feature branch:

1. **Adopt.** Under `--in-wave`, do-work leaves medium items open so parallel slices do not race on
   the ledger. For every item a merged slice returned with rank `medium`, run
   `node .omni-loop/bin/omni.mjs adopt <file>`. Exit 1 (the ledger refused it): leave that item
   open and name the refusal in the report. Commit the ledger and the removed files together:
   `chore(delivery): wave <n> of PRD <prd> — adopt <k> medium decisions`, with your session's
   co-author trailer. High items stay open for a person.
2. **Check.** Run the preflight, every command in `commands.checks`, then
   `node .omni-loop/bin/omni.mjs check all`. Red: fix it on the feature branch itself; each fix
   counts toward `limits.attempts`. Still red after that: the wave is stuck; say which step.
3. Push the feature branch to `<remote>`.
4. **The feature PR.** Tick each merged slice in its **Slices** checklist (`#<sub-PR> <title>`), in
   the body shape `/omni:pr` owns (`gh pr edit <feature PR> --body-file <file>`). Rewrite its status
   comment through `/omni:pr`'s marker recipe: state `merging slices` (or `stuck`, naming the red
   step), `slices: <merged> / <total> merged`. Never mark the feature PR ready.

## 6. Report

One table, then the items still open. This is what `/omni:yolo` reads.

| slice | sub-PR | outcome | territory | items | summary | risks |
|---|---|---|---|---|---|---|
| s1 | #12 | merged | inside | — | … | … |
| s6 | #13 | merged | breach: `<path>` | `s6-01-…` (medium, adopted) | … | … |
| s7 | #14 | stopped: `<law>` | — | — | … | … |
| s8 | #15 | stuck (`labels.needsFix`) | — | — | … | … |

Below it: the wave's check (green, or the red step), the checks that ran and did not, the high items
left open, and the slices the board still holds (`blocked` or `in-flight`). A breach or an item
sits beside a merged slice, never instead of it.

## Guardrails

- Merge only into the feature branch, never into `repo.defaultBranch`. Check the base before every merge.
- Subagents never merge. One slice per worktree, branch and sub-PR.
- Claim before you dispatch; take the board's frontier as it is.
- A question never takes the wave down: only `stopped` and `blocked` hold a slice, and only that one.
- A territory breach is reported, never fatal.
- Never mark a sub-PR ready yourself (`/omni:pr` does), and never a feature PR at all.
