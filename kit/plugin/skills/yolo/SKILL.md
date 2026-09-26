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

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

Then run `node .omni-loop/bin/omni.mjs kb status` once, and print the open questions it lists. They
are for a person, and none of them holds delivery: every slice carries on with the kit default
where a form has a hole. Beside them, print once the proposed register entries, summed over its
`Registers` lines: `<n> proposed knowledge entries — not laws until confirmed`. A proposed entry
floors nothing and stops no slice; delivery carries on. Do not run it again this run.

## 1. Find the PRD, the plan and the feature PR

1. `git fetch <remote>`, then
   `gh pr list --head <feature branch> --base <repo.defaultBranch> --state open --json number,isDraft,labels`.
2. The plan and the PRD's outbox live on the feature branch, so read them there: when the branch
   exists, `git switch --detach <remote>/<feature branch>`. First the checkout must be clean: no
   tracked changes (`git status --porcelain --untracked-files=no` prints nothing). Otherwise stop in
   one line naming it; never stash, clean or reset. **Do this again before every board read**: each
   wave moves the feature branch. The run leaves the checkout detached; say so in the report.
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
checkout (step 1, items 1–2) and read the board again.

Stop the loop on the first of:

| the wave's report, then the board | the run is |
|---|---|
| the wave's report says its check stayed red | **held** (stuck): the feature branch is red, so no next wave is built on it |
| every slice `merged` | **complete**: go to step 4 |
| nothing takeable, nothing awaiting merge, a slice not merged | **held**: say which slices hold it and why — `stuck` (`labels.needsFix`), `stopped` (the law or principles), `blocked` (the human-action item, or its unmerged blocker), `in-flight` (someone else is on it; re-run later) |
| a wave merged nothing and the board did not change | **held**, likewise: the wave's report names the red step |

**Held:** when a slice is stuck, or the wave's check stayed red, the feature PR gets
`labels.needsFix` in place of `labels.inProgress` and a status comment with state `stuck` naming the
sub-PR or the red step. Held only by `stopped`, `blocked` or `in-flight` slices, the state is `stuck`
too, with the reason, and no `labels.needsFix`. Either way, post the outbox with the `omni comment`
line step 5 opens with, leave the feature PR in draft, and go to step 6.

## 4. Finish the feature branch

Work in a detached worktree: `git fetch <remote>`, then
`git worktree add --detach <path> <remote>/<feature branch>` (`<path>` under `worktrees`).

1. **Meet the default branch.** If `git merge-base --is-ancestor <remote>/<repo.defaultBranch> HEAD`
   fails, run `git merge <remote>/<repo.defaultBranch>`. A conflict you cannot resolve with
   confidence: `git merge --abort`, and take `/omni:pr`'s **Stuck** path for the feature PR, naming
   the conflicting files as what a person should look at. Post the outbox (the `omni comment` line
   step 5 opens with), remove the worktree, and go to step 7.
2. **Install when the ground moved.** If the merge changed the lockfile or any package manifest,
   install the dependencies in the worktree with the repository's package manager before checking.
   It is not an attempt.
3. **Check the whole feature.** The preflight (`commands.preflightFull`, or `commands.preflight` when
   null), every command in `commands.checks`, then `node .omni-loop/bin/omni.mjs check all`. Red
   because of the environment (a missing install, a tool, the network): fix the environment and rerun;
   that is not code to fix. Red in the PRD's own slices: fix it here; each fix counts toward
   `limits.attempts`. **Never edit code outside the PRD's slices to turn the finish green.** Still red:
   the Stuck path, naming the red step; post the outbox (as above), remove the worktree, and go to
   step 7.
4. **Acceptance,** only when `acceptance.enabled`: run `acceptance.run` twice.
5. `git push <remote> HEAD:<feature branch>`.
6. **The body.** Tick every slice, and every passing scenario, and fill **Summary**, **Verified** (the
   commands that ran and their result), **Risk and rollback** and **Reviewer focus**, in the shape
   `/omni:pr` owns (`gh pr edit <feature PR> --body-file <file>`).
7. **The gate:**

   ```bash
   node .omni-loop/bin/omni.mjs status <prd>     # exit 0 green, 1 red
   ```

## 5. Ship before ready

Whatever the gate reads, first put the outbox on the feature PR, in one comment rewritten in place:

```bash
node .omni-loop/bin/omni.mjs comment --prd <prd> --pr <feature PR>
```

**Gate green** (nothing open, no unreworked drift). In the worktree:

1. `node .omni-loop/bin/omni.mjs ship <prd>`. It stages the move and prints what moved.
   - Exit 1 names each reason it refused: the feature PR stays draft; name them in step 6 as `stuck`.
   - Exit 2 means the delivery folder holds uncommitted changes. Commit them if they are this run's
     own (the body file never lives there), then rerun once; otherwise stop, as for exit 1.
2. Commit the move as `chore(delivery): ship PRD <prd>`, with your session's co-author trailer, and
   `git push <remote> HEAD:<feature branch>`.
3. Only now, `gh pr ready <feature PR>`. **This is the only place in this skill a feature PR is
   marked ready**; `/omni:yolo-fix` follows this same green path after its own ship. CI runs on it
   once: follow `/omni:pr`'s lifecycle for the feature PR until its checks are green or it is stuck.

The **omni-loop** GitHub App, when installed on the repository, posts this same gate on the feature
PR as the check named `ci.outboxContext`; this skill never posts it and never waits on it.

**Gate red.** Leave the feature PR in **draft**; do not ship. The comment above holds every open
question in plain words, each under a number. Report: "the outbox is open: a person answers on the
feature PR, as the posted comment explains, then runs `/omni:yolo-fix <prd>`."

Then `git worktree remove <path>`.

## 6. Release

Remove `labels.inProgress` from the feature PR (unless the Stuck path already swapped it for
`labels.needsFix`), and write its final status comment through `/omni:pr`'s marker recipe, with
`slices: <merged> / <total> merged` and one of `/omni:pr`'s states:

- `done`: shipped and ready, or every slice merged with the gate red. For the red gate, the
  `human steps` line says "answer the outbox questions on this PR, then `/omni:yolo-fix <prd>`".
- `stuck`: held (a stuck, stopped, blocked or in-flight slice, a red wave check) or a stuck finish,
  with the reason; `human steps` names what a person must do.

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
