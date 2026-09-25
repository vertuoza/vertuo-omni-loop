---
name: yolo
description: Build a whole PRD with nothing asked along the way — plan it if needed, run /omni:wave until every slice is merged or nothing more can move, then finish the feature branch, run the outbox gate, and ship before ready. Green gate — omni ship, commit, push, then the feature PR is marked ready. Red gate — the feature PR stays draft with the outbox questions posted on it. Never merges into the default branch. Triggers on "yolo this PRD", "build it, I'll review the outbox after", "/omni:yolo".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-yolo/SKILL.md (and vertuo-deliver §1–3, with the ask-nothing policy) — changes in kit/porting/plugin--yolo.md -->

# Yolo: every wave, the gate, ship before ready

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**It asks nothing.** Every decision a slice meets becomes an outbox item (`/omni:do-work` records it
and carries on); a person reads them all once, at the end, on the feature PR. Only `stopped` and
`blocked` hold a slice, and only that one.

## Input

A PRD number. Re-running is safe: the board is rebuilt from GitHub every time, `/omni:wave` resumes
what a previous run left, and every step below checks before it acts.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` below is `repo.remote`, and `<feature branch>` is `branches.feature` with `{topic}`
filled by the PRD folder's topic (the folder `omni prd` names is `<n>-<topic>`).

## 1. Find the PRD, the plan and the feature PR

1. `git fetch <remote>`, then
   `gh pr list --head <feature branch> --base <repo.defaultBranch> --state open --json number,isDraft,labels`.
2. The plan and the PRD's outbox live on the feature branch, so read them there: when the branch
   exists, `git switch --detach <remote>/<feature branch>` (your checkout must be clean). **Do this
   again before every board read**: each wave moves the feature branch.
3. `node .omni-loop/bin/omni.mjs prd <n>`. It must be in state `inbox`. `shipped`, with the feature
   PR still a draft, means a previous run shipped and stopped before ready: go to step 5, green path,
   item 3. Anything else: stop and say where it is.
4. No feature branch, no feature PR, or no `plan.md` in the PRD's files: follow `/omni:plan` first.
   It may return `needs clarification`: stop, and say what the PRD must answer. Otherwise go back to
   item 1 with its feature PR.

## 2. Pick up the feature PR

Add `labels.inProgress` to it (subject to `/omni:pr`'s **Labels**), and rewrite its status comment
through `/omni:pr`'s marker recipe: state `merging slices`, `slices: <merged> / <total> merged`.

## 3. Loop the waves

```bash
node .omni-loop/bin/omni.mjs board <prd> --json
```

While the board shows something that can move — `frontier.takeable` is not empty, or a slice is
**awaiting merge** as `/omni:wave` defines it (an `in-flight`, non-draft sub-PR without
`labels.inProgress`) — follow `/omni:wave <prd>` for one wave, keep its report, refresh your
checkout (step 1, item 2) and read the board again.

Stop the loop on the first of:

| the board | the run is |
|---|---|
| every slice `merged` | **complete**: go to step 4 |
| nothing takeable, nothing awaiting merge, a slice not merged | **held**: say which slices hold it and why — `stuck` (`labels.needsFix`), `stopped` (the law or principles), `blocked` (the human-action item, or its unmerged blocker), `in-flight` (someone else is on it; re-run later) |
| a wave merged nothing and the board did not change | **held**, likewise: the wave's report names the red step |

**Held:** when a slice is stuck, or the wave's check stayed red, the feature PR gets
`labels.needsFix` in place of `labels.inProgress` and a status comment with state `stuck` naming the
sub-PR or the red step. Either way, post the outbox with the `omni comment` line step 5 opens with,
leave the feature PR in draft, and go to step 6.

## 4. Finish the feature branch

Work in a detached worktree: `git fetch <remote>`, then
`git worktree add --detach <path> <remote>/<feature branch>` (`<path>` under `worktrees`).

1. **Meet the default branch.** If `git merge-base --is-ancestor <remote>/<repo.defaultBranch> HEAD`
   fails, run `git merge <remote>/<repo.defaultBranch>`. A conflict you cannot resolve with
   confidence: `git merge --abort`, and take `/omni:pr`'s **Stuck** path for the feature PR, naming
   the conflicting files as what a person should look at. Remove the worktree; go to step 7.
2. **Check the whole feature.** The preflight (`commands.preflightFull`, or `commands.preflight` when
   null), every command in `commands.checks`, then `node .omni-loop/bin/omni.mjs check all`. Red: fix
   it here; each fix counts toward `limits.attempts`. Still red after that: the Stuck path, naming the
   red step. Remove the worktree; go to step 7.
3. **Acceptance,** only when `acceptance.enabled`: run `acceptance.run` twice.
4. `git push <remote> HEAD:<feature branch>`.
5. **The body.** Tick every slice, and every passing scenario, and fill **Summary**, **Verified** (the
   commands that ran and their result), **Risk and rollback** and **Reviewer focus**, in the shape
   `/omni:pr` owns (`gh pr edit <feature PR> --body-file <file>`).
6. **The gate:**

   ```bash
   node .omni-loop/bin/omni.mjs status <prd>     # exit 0 green, 1 red
   ```

## 5. Ship before ready

Whatever the gate reads, first put the outbox on the feature PR, in one comment rewritten in place:

```bash
node .omni-loop/bin/omni.mjs comment --prd <prd> --pr <feature PR>
```

**Gate green** (nothing open, no unreworked drift). In the worktree:

1. `node .omni-loop/bin/omni.mjs ship <prd>`. It stages the move and prints what moved; exit 1 names
   each reason it refused: the feature PR stays draft; name them in step 6 as `stuck`.
2. Commit the move as `chore(delivery): ship PRD <prd>`, with your session's co-author trailer, and
   `git push <remote> HEAD:<feature branch>`.
3. Only now, `gh pr ready <feature PR>`. **This is the only place a feature PR is ever marked
   ready.** CI runs on it once: follow `/omni:pr`'s lifecycle for the feature PR until its checks are
   green or it is stuck.

**Gate red.** Leave the feature PR in **draft**; do not ship. The comment above holds every open
question in plain words, each under a number. Report: "the outbox is open: a person answers on the
feature PR (`1: ok` / `2: B because …`), then runs `/omni:yolo-fix <prd>`."

Then `git worktree remove <path>`.

## 6. Release

Remove `labels.inProgress` from the feature PR (unless the Stuck path already swapped it for
`labels.needsFix`), and write its final status comment through `/omni:pr`'s marker recipe: state
`done` (shipped and ready), `waiting for the outbox` (gate red) or `stuck` (the reason), with
`slices: <merged> / <total> merged`.

## 7. Report

One block: the feature PR link and its state (ready, draft with the gate red, or held); slices merged
out of total, each held slice with its reason; the checks that ran and did not; every open outbox
item with its rank and file (`omni status <prd>` lists them); and, when the gate is red, the line
from step 5. A person merges the feature PR into `repo.defaultBranch`.

## Guardrails

- **Never ask.** A decision is an outbox item; nothing here waits on a person.
- **Never merge into `repo.defaultBranch`.** Sub-PRs merge into the feature branch through
  `/omni:wave`; a person merges the feature PR.
- **Never add `labels.outboxGo`.** It is a person's override, not this skill's way out.
- **Never mark the feature PR ready while the gate is red**, and never before `omni ship` is
  committed and pushed.
- One PRD per run, no issues filed; slices live in the plan.
