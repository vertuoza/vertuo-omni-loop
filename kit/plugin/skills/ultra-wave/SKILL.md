---
name: ultra-wave
description: Build ONE wave of a multi-repository PRD from its plan repository — read the board across every repository, claim each takeable slice in its target (a draft sub-PR into that target's feature branch), dispatch one worktree subagent per slice following /omni:do-work --in-wave --target, merge each sub-PR in its target after the territory check, relay each slice's items into the plan repository's outbox, adopt the wave's medium decisions there, check each touched target and tick the slices on both feature PRs. Followed by /omni:ultra-yolo for each wave; a person may run it on a PRD. Never merges into any default branch. Triggers on "run the next ultra wave", "build this wave across the repositories", "/omni:ultra-wave".
---

# Ultra-wave: one wave, across repositories

One wave of a PRD whose plan names a repository for every slice (see `/omni:ultra-yolo`). Each
slice is built in its own target, by its own subagent, and ends in its own sub-PR into that
target's feature branch; its decisions come home to the plan repository's outbox.

It follows `/omni:wave` **step for step**, and never copies it: each step below either says "as
`/omni:wave` step N" and adds only what differs, or is new. Read `/omni:wave` alongside it; where
the two say the same thing, that skill's words are the rule.

`omni` below is `node .omni-loop/bin/omni.mjs`, always run in the plan repository. Never import the
kit, and never name a path, label, branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

**Code runs only from a target's own config,** as `/omni:ultra-yolo` says: in a target, beyond `git`
and `gh`, only its own committed preflight ever runs, and a target without one runs nothing.

## Input

A PRD number, in a plan repository, whose targets `/omni:ultra-yolo` step 2 has cloned, with a
feature branch and a draft target feature PR each. Re-running picks up where the last run stopped.

## Step 0

As `/omni:wave` step 0, with these differences:

- The config must have a `plan` section, and `node .omni-loop/bin/omni.mjs prd <prd>` must print a
  `repos:` line; otherwise stop in one line, `PRD <prd> is an ordinary PRD: /omni:wave <prd>`.
- Find the plan PR (the plan repository's feature PR) as `/omni:wave` finds the feature PR. For each
  target, its clone is `<worktrees>/targets/<name>`, its remote the one `git -C <clone> remote`
  prints, its default branch
  `gh repo view <slug> --json defaultBranchRef --jq .defaultBranchRef.name`, and its target feature
  PR `gh pr list --repo <slug> --head <feature branch> --state open --json number,body`. A target
  with no clone, no feature branch or no target PR is **held**: its slices are left out of the wave,
  naming `/omni:ultra-yolo <prd>` as what sets it up.
- **A plan of several landings.** The board JSON's `landings` holds one row per landing of each
  target's own chain, each with its `repo`, `branch`, `pr` and `current`. A slice's feature branch is
  the `branch` of the row of its `repo` whose `slices` hold it, and its target feature PR that row's
  PR; wherever this skill says "the target's feature branch", it means that branch.

## 1. The board

As `/omni:wave` step 1. Every row of `node .omni-loop/bin/omni.mjs board <prd> --json` carries
`repo` (the short name) and `slug` (`owner/name`); the frontier is already computed across
repositories. An `unreadable` row (its repository could not be read) is held, as a `blocked` one,
and so is every slice of a held target. With landings, the frontier holds, in each target, the
slices of that target's **current** landing only (`current: true`): a target's landing 2 is never
claimed before that target's landing 1 slices are all merged, and one target never waits on
another's. A row whose `repo` is the plan repository's own is built as
`/omni:wave` builds it, with none of the differences below.

## 2. Claim every slice first

As `/omni:wave` step 2, in each slice's target: `runnable` follows `/omni:pr --repo <slug>`'s
**Claim** mode (the claim commit in the clone, the draft sub-PR into the target's feature branch,
the `claimed` status comment there); `claimed-stale` is taken over with `--repo <slug>` on every
`gh` call. Once every claim is made, run `git -C <clone> switch --detach` in each clone, and
`git switch --detach` in the plan repository.

## 3. Dispatch, one subagent per slice, in a single message

As `/omni:wave` step 3, with this prompt for a target's slice:

> Build slice `<id>` of PRD <prd>, on feature branch `<feature branch>` of `<slug>`: follow
> `/omni:do-work --in-wave --target <repo>`. Its slice branch is already claimed in that target.
> Do not spawn subagents. Return only do-work's result JSON: no diffs, no logs.

Each result also carries `repo` and `out`, the scratch folder holding its items and its account.
Keep both: step 4 relays them.

## 4. Merge, one at a time

As `/omni:wave` step 4, with `--repo <slug>` on every `gh` call and git in the target's clone:

1. **Base.** The base must be the target's feature branch. **Never merge a PR whose base is the
   target's default branch.**
2. **Territory.** `gh pr diff <n> --repo <slug> --name-only`, against the row's `territory`: paths
   in the target. A breach is reported and never fatal, as there.
3. **Mergeable.** A conflict is resolved in a detached worktree of the clone, as there; the
   preflight it runs is the target's own, or none.
4. **Ready** through `/omni:pr --repo <slug>`'s sub-PR lifecycle; that skill owns `gh pr ready`.
5. **Merge:** `gh pr merge <n> --repo <slug> --squash --delete-branch`.
6. **Relay.** In one detached worktree of the plan feature branch, kept for the whole wave (step 5
   commits it), run from its root:

   ```bash
   node .omni-loop/bin/omni.mjs item relay <out> --prd <prd>
   ```

   It moves every valid item and account of that slice into the PRD's outbox. Exit `2` names each
   refused file and its reason, and leaves it in `<out>`: reword it in place to meet the reason and
   relay again, each rewording counting toward `limits.attempts`. Still refused: keep `<out>`, name
   it and the file in the report, and never drop the decision.

The "not merged" table and its status comments apply as written, with `--repo <slug>`. A slice not
merged relays nothing; its `<out>` stays, named in the report.

## 5. Check the wave together

1. **Adopt, then commit once.** In the plan repository's worktree of step 4, as `/omni:wave` step 5
   item 1: for every relayed item of rank `medium`, `node .omni-loop/bin/omni.mjs adopt <file>`,
   the file being its new path in the outbox. Commit the relayed items, the accounts and the ledger
   together, once for the wave:
   `chore(delivery): wave <n> of PRD <prd> — relay <r> items, adopt <k> medium decisions`, with your
   session's co-author trailer, then the `omni sign trailer` line.
2. **The plan repository's check:** its preflight, every command in `commands.checks`, then
   `node .omni-loop/bin/omni.mjs check all`, as there. Push `HEAD:<feature branch>` and remove the
   worktree.
3. **Each touched target,** in a detached worktree of its clone at its feature branch: its own
   preflight, when it has one. Red: fix it there, inside the PRD's slices only, each fix counting
   toward `limits.attempts`, and push to the target's feature branch. Still red: the wave is stuck,
   naming the target and the step. No preflight: nothing runs; say `none — CI is the check`.
4. **Both feature PRs.** Tick each merged slice in its target PR's **Slices** checklist
   (`#<sub-PR> <title>`, `gh pr edit <n> --repo <slug> --body-file <file>`), and in the plan PR's
   (`<slug>#<sub-PR> <title>`), each body keeping its `omni sign footer` line. Rewrite the plan PR's
   status comment as `/omni:wave` step 5 item 4 does. Never mark any feature PR ready.

## 6. Report

As `/omni:wave` step 6: the PRD's page first (run `node .omni-loop/bin/omni.mjs dossier link <n>`;
exit `0` gives `PRD <n>: <link>`, anything else
`PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>`), then its table with one more
column, `repo`, after `slice`, and the sub-PR written `<slug>#<n>`. Below it, as there, plus: the
items relayed and any left in a scratch folder, each touched target's check, and every held target
with its reason. This is what `/omni:ultra-yolo` reads.

## Guardrails

- Merge only into a target's feature branch, or its landing's branch (or, for the plan repository's
  own slices, its feature branch), never into any repository's default branch, and never a landing
  PR. Check the base before every merge.
- **Never add `labels.outboxGo`,** and **never create a label in a target**: a missing one is a human
  step.
- **Never run a command in a target other than its own committed preflight** (beyond `git` and
  `gh`).
- Every item ends up in the plan repository's outbox; a refused one is named, never dropped.
- Subagents never merge; one slice per worktree, branch and sub-PR; claim before you dispatch.
