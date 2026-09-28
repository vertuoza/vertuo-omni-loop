---
name: wave
description: Build ONE wave of a PRD in parallel — read the board, claim every takeable slice, dispatch one worktree subagent per slice following /omni:do-work --in-wave, then merge their sub-PRs into the feature branch one at a time, check the wave together, adopt its medium decisions and report. Followed by /omni:yolo for each wave; a person may run it on a PRD. Never merges into the default branch. Triggers on "run the next wave", "build wave 3", "/omni:wave".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-parallel-wave/SKILL.md (and the board and wave-loop parts of vertuo-deliver) — changes in kit/porting/plugin--wave.md -->

# Wave: the takeable slices, in parallel, merged one at a time

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

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

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

Find the feature PR: `gh pr list --head <feature branch> --base <repo.defaultBranch> --state open
--json number,body`. No feature branch or no feature PR: stop, and say to follow `/omni:plan` first.

## 1. The board

```bash
node .omni-loop/bin/omni.mjs board <prd>          # print it, once, before acting
node .omni-loop/bin/omni.mjs board <prd> --json   # what you act on
```

The wave is `frontier.takeable`: the ids of the lowest wave's `runnable` and `claimed-stale`
slices, with any same-wave territory collision already deferred by the kit (`frontier.excluded`).
Read each id's state, `title`, `territory` and `pr` from its row in `slices[]`. Take it as given;
do not re-derive blockers, staleness or collisions.

**Awaiting merge.** An `in-flight` row whose `pr` is not a draft (`pr.isDraft` false) and no longer
carries `labels.inProgress` is finished work a previous run never merged. Nobody is on it: it skips
steps 2 and 3 and joins step 4 as `done`. Every other `in-flight` slice is someone else's; leave it.

`takeable` empty and nothing awaiting merge: print the board and stop.

## 2. Claim every slice first

Before any subagent starts, `git fetch <remote>`, then, for each takeable slice, in board order:

- **`runnable`:** follow `/omni:pr`'s **Claim** mode with the slice id and its board `title`. It cuts
  the slice branch from the feature branch, makes the claim commit, pushes, opens the draft sub-PR
  and posts the `claimed` status comment.
- **`claimed-stale`:** its branch and draft sub-PR (the row's `pr.number`) already exist. Take it
  over: add `labels.inProgress` (subject to `/omni:pr`'s **Labels**) and rewrite its status comment,
  through `/omni:pr`'s marker recipe, with state `claimed` and the line "taken over from a stale
  claim".

Claim mode leaves your checkout on the last slice branch it cut, and git refuses to check a branch
out in a second worktree. Once every claim is made, run `git switch --detach`, so each subagent's
worktree can take its own slice branch.

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

Then take each `done` slice, and each slice awaiting merge, in board order. Each merge moves the feature branch, so read every
sub-PR afresh; never trust an earlier look.

1. **Base.** `gh pr view <n> --json baseRefName,isDraft,mergeable,labels`. The base must be the
   feature branch. Anything else: `gh pr edit <n> --base <feature branch>` (add `labels.sub` if it
   is missing), then read it again. **Never merge a PR whose base is `repo.defaultBranch`.**
2. **Territory.** `gh pr diff <n> --name-only`, against the slice's `territory` in the board JSON.
   A path is inside when it starts with a territory entry, or sits under the PRD's outbox dir
   (`node .omni-loop/bin/omni.mjs prd <prd>` prints it). Any other path is a **breach**: name it in
   the report and merge anyway. It is never fatal; it says the plan was wrong about the ground,
   and it is the first thing to read when a later sub-PR conflicts.
3. **Mergeable.** `UNKNOWN`: look again in a minute. `CONFLICTING`: work in a detached worktree,
   never on the slice branch itself. Run `git fetch <remote>`, then `git worktree add --detach <path>
   <remote>/<slice branch>` (`<path>` under `worktrees`). In it, `git merge <remote>/<feature branch>`,
   resolve, run the preflight (`commands.preflightFull`, or `commands.preflight` when null),
   `git push <remote> HEAD:<slice branch>`, then `git worktree remove <path>`. Count one attempt. A conflict you cannot resolve
   with confidence goes to one fresh subagent, given both slices' intent.
4. **Ready.** Still a draft: follow `/omni:pr`'s **sub-PR lifecycle** for it; that skill owns
   `gh pr ready` and runs it once the preflight is green. It never becomes ready: do not merge it.
5. **Merge.** `gh pr merge <n> --squash --delete-branch`.

**A red slice** gets one look first. Read `omni kb show ci` once: which checks exist and gate, the
known reds, and when a re-run is allowed. When a `red` slice's failing step matches a known red
there, its diff changes nothing that red names, and the form allows a re-run, take it through
steps 1 to 5 like a `done` slice: the preflight in step 4 is its one re-run, counted as an attempt.
Any other `red` slice is not merged.

**Not merged:**

| result | what you do |
|---|---|
| `red`, or `done` but never ready or still conflicting after `limits.attempts` attempts | stuck. Make sure it carries `labels.needsFix` in place of `labels.inProgress` and `/omni:pr`'s stuck comment. |
| `stopped` | leave the draft. Report the law or principles it named. Its siblings still merge. |
| `blocked` | leave the draft. Report its human-action item. |

For every slice not merged, you do this, not the subagent, which has already returned: remove
`labels.inProgress` and rewrite its status comment through `/omni:pr`'s marker recipe with state
`stuck` and the reason (the red step, the law or principles, or the human-action item). A stuck
slice keeps `labels.needsFix`. A stopped or blocked one waits for a person and gets no label.

A slice that is not merged holds only what depends on it; the rest of the wave goes on.

## 5. Check the wave together

Slices that each passed alone can fail together. Work in a detached worktree of the feature branch:
run `git fetch <remote>`, then `git worktree add --detach <path> <remote>/<feature branch>`.

1. **Adopt.** Under `--in-wave`, do-work leaves medium items open so parallel slices do not race on
   the ledger. For every item a merged slice returned with rank `medium`, run the command below. A slice that was
   awaiting merge returned nothing this run, so use the open medium item files for that slice
   listed by `node .omni-loop/bin/omni.mjs prd <prd>`. The command is
   `node .omni-loop/bin/omni.mjs adopt <file>`. Exit 1 (the ledger refused it): leave that item
   open and name the refusal in the report. Commit the ledger and the removed files together:
   `chore(delivery): wave <n> of PRD <prd> — adopt <k> medium decisions`, with your session's
   co-author trailer, then the `omni sign trailer` line. High items stay open for a person.
2. **Check.** Run the preflight, every command in `commands.checks`, then
   `node .omni-loop/bin/omni.mjs check all`. Red: fix it on the feature branch itself; each fix
   counts toward `limits.attempts`. Still red after that: the wave is stuck; say which step.
3. `git push <remote> HEAD:<feature branch>`, then `git worktree remove <path>`.
4. **The feature PR.** Tick each merged slice in its **Slices** checklist (`#<sub-PR> <title>`), in
   the body shape `/omni:pr` owns (`gh pr edit <feature PR> --body-file <file>`), which keeps its
   `omni sign footer` line. Rewrite its status
   comment through `/omni:pr`'s marker recipe: state `merging slices` (or `stuck`, naming the red
   step), `slices: <merged> / <total> merged`. Never mark the feature PR ready.

## 6. Report

The PRD's page beside its number, then one table, then the items still open. This is what
`/omni:yolo` reads.

The first line is the PRD's page. Run `node .omni-loop/bin/omni.mjs dossier link <n>`: exit `0`
prints the page's link on one line, so the line is `PRD <n>: <link>`. Anything else (`none`, `off`,
`no sign-in (omni signin)`, `unreachable`, `refused (<status>)`, or exit `2` from a kit without the
verb) means it has no page to show: the line is
`PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>`. It never stops the report.

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
