---
name: ultra-yolo-fix
description: Bring a multi-repository PRD back in line with what a person answered on its plan PR — settle the replies in the plan repository, rework every drifted decision in the repository it was taken in (one sub-PR each into that target's feature branch, through /omni:do-work --target, inside the bound the item stated), relay what the reworks write, check each touched target and follow its target PR's CI, then run /omni:ultra-yolo's gate and ship before ready. Raises no question of its own and never merges into any default branch. Triggers on "ultra-yolo-fix this PRD", "rework what I answered across the repositories", "/omni:ultra-yolo-fix".
---

# Ultra-yolo fix: replies in one place, reworks where they belong

After a person answered the outbox of a PRD `/omni:ultra-yolo` built. Every answer is read on the
plan PR, in the plan repository; each rework lands in the repository its decision was taken in.

It follows `/omni:yolo-fix` **step for step**, and never copies it: each step below either says "as
`/omni:yolo-fix` step N" and adds only what differs, or is new. Read `/omni:yolo-fix` alongside it;
where the two say the same thing, that skill's words are the rule. It **reworks; it does not
re-decide**, exactly as there.

`omni` below is `node .omni-loop/bin/omni.mjs`, always run in the plan repository. Never import the
kit, and never name a path, label, branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

**Code runs only from a target's own config,** as `/omni:ultra-yolo` says.

## Input

A PRD number, in a plan repository, whose plan PR carries replies to its outbox comment, or whose
ledger holds drifted entries. Re-running is safe, as for `/omni:yolo-fix`.

## Step 0

As `/omni:yolo-fix` step 0. The config must have a `plan` section and
`node .omni-loop/bin/omni.mjs prd <prd>` must print a `repos:` line; otherwise stop in one line,
`PRD <prd> is an ordinary PRD: /omni:yolo-fix <prd>`.

## 1. Find the plan PR

As `/omni:yolo-fix` step 1, on the plan repository's feature PR (the plan PR). Fetch each target's
clone (`<worktrees>/targets/<name>`) too; a missing clone is made as `/omni:ultra-yolo` step 2 makes
it. After the plan PR has merged, its after-merge path applies in the plan repository; a target
whose target PR has merged gets a fresh feature branch and draft target PR, as `/omni:ultra-yolo`
step 2 opens them.

## 2. Adopt what's left, first

As `/omni:yolo-fix` step 2, in the plan repository.

## 3. Read the replies and settle them

As `/omni:yolo-fix` step 3, on the plan PR, in the plan repository: `omni replies`, the write-back,
and the one settle sub-PR into the plan feature branch, merged before step 4. Nothing of this step
touches a target.

## 4. Derive the reworks

As `/omni:yolo-fix` step 4, with `node .omni-loop/bin/omni.mjs rework plan <prd> --json`. In a plan
repository each rework also carries `repo`, the repository of the slice its item was raised on:
that is where the rework is built. Its `territory` is paths in that repository.

## 5. Run each wave of reworks

As `/omni:yolo-fix` step 5, with `/omni:ultra-wave`'s differences for every rework whose `repo` is
a target (one whose `repo` is the plan repository's own runs exactly as there):

1. **Claim** through `/omni:pr --repo <slug>`'s **Claim** mode, in the target's clone, the sub-PR
   into that target's feature branch.
2. **Dispatch** with `/omni:yolo-fix` step 5's rework prompt, the command being
   `/omni:do-work --in-wave --target <repo>` and the feature branch named with its `<slug>`.
3. **Merge** as `/omni:ultra-wave` step 4, `--repo <slug>` on every call, grading territory against
   the rework's `territory`; then **relay** its scratch folder with
   `node .omni-loop/bin/omni.mjs item relay <out> --prd <prd>` into the plan feature branch. A
   rework raises no item, so only its account moves.
4. **Check** as `/omni:ultra-wave` step 5, without its adopt step: the plan repository's check, then
   each touched target's own preflight, when it has one.

## 6. Close each reworked item

As `/omni:yolo-fix` step 6, in the plan repository:
`node .omni-loop/bin/omni.mjs rework close <itemId> --prd <prd> --pr <sub-PR>`, with the sub-PR's
number in its target; the commit message names each as `<slug>#<sub-PR>`.

## 7. Finish, gate, ship before ready

`/omni:ultra-yolo` steps 4 and 5, as written: finish each touched target (meet its default branch,
its preflight, push, the body, its target PR ready and its CI followed until green or stuck), then
the one gate in the plan repository. The release note is rewritten as `/omni:yolo-fix` step 7 says
when a merged rework changed what the PRD does. The plan PR is marked ready only on a green gate,
after `omni ship` is committed and pushed, and after every target PR is ready with green CI.

## 8. Hand off

As `/omni:yolo-fix` step 8, the PRD's page first (run `node .omni-loop/bin/omni.mjs dossier link
<n>`; exit `0` gives `PRD <n>: <link>`, anything else
`PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>`), every rework named with its
repository and `<slug>#<sub-PR>`. Then end with `/omni:ultra-yolo` step 6's hand-off, as written,
with one difference: the held ending's command is `/omni:ultra-yolo-fix <n>`.

## Guardrails

- **Never merge into any repository's default branch.** The settle sub-PR merges into the plan
  feature branch; each rework into its target's feature branch; a person merges every feature PR.
- **Never add `labels.outboxGo`,** and **never create a label in a target**.
- **Never run a command in a target other than its own committed preflight** (beyond `git` and
  `gh`), and never one from an imported copy's playbook.
- **A rework lands in its `repo`,** never in another repository, and never wider than its bound.
- `/omni:yolo-fix`'s guardrails hold as written: raise no item, one rework per drifted item, the
  ledger grows only, and the plan PR is never marked ready while the gate is red.
