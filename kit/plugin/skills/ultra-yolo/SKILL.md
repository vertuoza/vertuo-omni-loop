---
name: ultra-yolo
description: Build a multi-repository PRD from its plan repository with nothing asked along the way — plan it first when it has no plan yet, as /omni:mega-brainstorm plans one, graded by omni plan check, then record each target that moved since the plan was read, clone every target and open its draft target feature PR, run /omni:ultra-wave until every slice is merged into its target's feature branch or nothing more can move, finish each target to ready with green CI, then run one outbox gate in the plan repository. Green gate — omni ship, commit, push, and the plan PR is marked ready last. Red gate — the plan PR stays draft with the questions posted, then, with answers.enabled on, it offers to take the answers here and carry on into /omni:ultra-yolo-fix. Never merges into any repository's default branch. Triggers on "ultra-yolo this PRD", "build it across the repositories", "/omni:ultra-yolo".
---

# Ultra-yolo: every repository, every wave, one gate

A **plan repository** (its config has a `plan` section) holds the PRD; its **target repositories**
hold the code. This skill builds a PRD whose plan names, for every slice, the repository it lands
in: each slice as a sub-PR into a feature branch **in its target**, one **target feature PR** per
target, every decision relayed into the plan repository's outbox, and **one gate** there. The plan
repository's feature PR, the one that closes the PRD, is marked ready last.

It follows `/omni:yolo` **step for step**, and never copies it: each step below either says "as
`/omni:yolo` step N" and adds only what differs, or is new. Read `/omni:yolo` alongside it; where
the two say the same thing, that skill's words are the rule.

`omni` below is `node .omni-loop/bin/omni.mjs`, always run in the plan repository. Never import the
kit, and never name a path, label, branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing. In a target, the same lines are printed from the plan repository.

**It asks nothing along the way,** as `/omni:yolo`: every decision a slice meets, in any
repository, becomes an item in the plan repository's outbox; a person reads them all once, at the
end. Only `stopped` and `blocked` hold a slice, and only that one; a target that cannot be read,
cloned or pushed to holds only its own slices and what they block.

**Code runs only from a target's own config.** In a target, the one command ever run beyond `git`
and `gh` is its own committed preflight (`commands.preflightFull`, else `commands.preflight`, read
from its `.omni-loop/config.yml` on its default branch, as `/omni:do-work`'s
**Under `--target <name>`** reads it). A target without one runs nothing locally: its target feature
PR's CI is the check. Never an install, a script, or a command from an imported copy's playbook.

**Flow points,** as `/omni:yolo` follows them: its one point, `yolo.ready`, fires before each
`gh pr ready` this skill runs, with `flow show yolo.ready` and `flow verdict yolo.ready`. For the plan
PR it reads the plan repository's flow. For a target PR it reads **that target's own committed
flow**, as `/omni:ultra-wave`'s **A target's flow** reads it:
`(cd <clone> && node <plan repository root>/.omni-loop/bin/omni.mjs flow show yolo.ready)`, the
plan repository's `omni` reading the target's config and hook files in its clone. A target's hooks
are followed only in its worktree (the clone), never from the imported copy; a target without a
committed `.omni-loop/config.yml` has no flow, and the kit's step runs alone.

## Input

A PRD number, in a plan repository. Re-running is safe: the board is rebuilt from GitHub every time,
the clones are fetched, the branches and pull requests are reused, and every step checks before it
acts.

## Step 0

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the
   JSON, as `/omni:yolo` step 0 keeps it. It must have a `plan` section; otherwise stop in one line:
   `not a plan repository: /omni:yolo <n> builds a PRD of this repository`.
2. **An ordinary PRD stops here.** Run `node .omni-loop/bin/omni.mjs prd <n>`. When it prints no
   `repos:` line, stop with exactly one line, before any branch, clone or pull request:

   ```text
   PRD <n> is an ordinary PRD: /omni:yolo <n>
   ```

   Read the same way the `omni prd <n>` of step 1, which reads the plan on the feature branch.
   A PRD with no plan yet (its folder holds no `plan.md`, on the feature branch or, with none yet,
   on the default branch) has no `repos:` line either: it is not stopped here, but planned in step
   1, which runs this check again once the plan is written.
3. The briefing (`node .omni-loop/bin/omni.mjs kb show briefing`), then
   `node .omni-loop/bin/omni.mjs kb status` once, as `/omni:yolo` step 0 runs them.

## 1. The plan repository

As `/omni:yolo` steps 1 and 2, on the plan repository: find the draft **plan PR** (the feature PR
`/omni:mega-brainstorm` opened), switch the clean checkout detached to its feature branch, read
`omni prd <n>` there (state `inbox`; `shipped` with the plan PR still a draft resumes at step 5,
green path, item 4). One difference: a PRD with no `plan.md` or no plan PR is planned first (**A
PRD with no plan**, below). Add `labels.inProgress` to the plan PR and rewrite its status comment, as
there.

**A PRD with no plan** (a roadmap writes every spec up front and each plan just in time, so a PRD can
reach this skill with its spec merged and no plan) is planned here, before its first wave, the way
`/omni:mega-brainstorm` plans one, with nothing asked:

1. Read the spec's `## Repositories` (for a PRD of a roadmap without one, the repositories its row
   of `roadmap.md` names): the target repositories the PRD lands in. Then, as
   `/omni:mega-brainstorm` step 3, a shallow read-only clone of each in a scratch folder
   (`mktemp -d`), its head the `read at` of that repository's row; **nothing runs in it**. A target
   that cannot be cloned stops the run in one line naming it: a plan is never written on a
   repository it could not read.
2. As `/omni:mega-brainstorm` step 8: follow `/omni:plan <n>`, its paragraph **In a plan
   repository** filling the `repo` column and the `## Repositories` table, and point `plan.slice`
   read per repository (`flow show plan.slice --repo <name>`), its hooks followed as planning
   guidance only. It cuts the feature branch, commits `plan.md` there, signed, and opens the draft
   plan PR, its **Slices** checklist grouped by repository.
3. `node .omni-loop/bin/omni.mjs plan check <n>` must be green; fix the plan until it is, every
   rule it names included (a slice in a read-only target, a consumer blocked by its provider). It
   prints each wave with the repository beside each slice.
4. Delete the scratch folder, then run `node .omni-loop/bin/omni.mjs prd <n>` again on the feature
   branch. No `repos:` line now means the plan lands in this repository alone: stop with exactly
   one line,

   ```text
   PRD <n> is an ordinary PRD: /omni:yolo <n>
   ```

`/omni:plan` may return `needs clarification`: the run stops there, with its question posted on the
PRD's issue, and nothing is built. Otherwise carry on below with the plan PR it opened.

Then read what moved since the plan was written:

```bash
node .omni-loop/bin/omni.mjs plan moved <n> --json
```

Each `moved` target becomes one **medium** outbox item, raised in the plan repository with
`omni item new --prd <n> --slice <the target's first slice> --file <file> --json` (slug
`<target>-moved`, no flag set, so the kit ranks it medium): the question is whether the plan still
holds, the decision is that the build goes on on the target's default branch today, and `gaps`
lists the changed files it printed. A moved target is never a stop. Adopt it
(`node .omni-loop/bin/omni.mjs adopt <file>`), commit it on the plan feature branch as
`chore(delivery): PRD <n> — <k> targets moved since the plan was read`, and push. An `unreachable`
target is held (step 2). A re-run that finds the item already there raises none again.

**A target whose flow moved** is reported as one that moved. Run
`node .omni-loop/bin/omni.mjs targets --json`: each imported target whose `state` is `stale` and whose
`detail` starts with `flow moved since read at` gets the same medium item, slug
`<target>-flow-moved`: the question is whether the plan still meets that target's rules, the
decision is that the build goes on under the target's committed flow (which every point in that
target reads), and `gaps` holds the detail. It is adopted and committed with the moved targets'
items, and is never a stop.

## 2. The targets

Read `## Repositories` from the plan, and each target's `owner/name` from the board
(`node .omni-loop/bin/omni.mjs board <n> --json` gives every slice its `repo` and `slug`). For
each target row, the plan repository's own row excepted:

1. **The clone.** A full clone at `<worktrees>/targets/<name>@<prd>` of the plan repository, one
   per PRD, so two PRDs built at once never share a clone's HEAD (`<worktrees>` is
   `omni config worktrees`, taken from the plan repository's main checkout: the folder holding
   `git rev-parse --path-format=absolute --git-common-dir`, so a run in a worktree finds the same
   clones): `gh repo clone <slug> <path>` when it is missing, `git -C <path> fetch --prune` on every
   run. When `git check-ignore -q <path>` fails, append the path to `info/exclude` under that
   common git folder, never to a committed file.
2. **The default branch** is the target's own:
   `gh repo view <slug> --json defaultBranchRef --jq .defaultBranchRef.name`. Never
   `repo.defaultBranch`.
3. **The feature branch** is the plan repository's `branches.feature`, filled with the PRD's topic.
   Reuse it when the clone's remote has it. Otherwise cut it from the target's default branch in a
   detached worktree of the clone, make one empty commit so a pull request can open
   (`git commit --allow-empty -m "chore(<topic>): open the feature branch of <plan slug>#<n>"`,
   signed as above), push it, and remove the worktree.
4. **The target feature PR.** Reuse the open one
   (`gh pr list --repo <slug> --head <feature branch> --state open --json number,isDraft,body`).
   Otherwise open it as a draft, through `/omni:pr --repo <slug>` (the feature kind), with
   `gh pr create --repo <slug> --draft --base <target default branch> --head <feature branch> --body-file <file>`.
   Its body starts with `Part of <plan slug>#<n>` (the plan repository's `repo.slug`), lists that
   target's slices as a **Slices** checklist, and ends with the `omni sign footer` line. Labels
   follow `/omni:pr --repo`: one missing there is a human step, never created. That `Part of` line
   is what makes the omni-loop App pass the target's outbox check, linking the plan PR, rather
   than grade the PRD there: the one gate is the plan PR's (`/omni:pr --repo`).

**A plan of more than one landing** (`node .omni-loop/bin/omni.mjs plan landings <n> --json` lists
more than one) is delivered per target as that target's own chain of landings, each built as
`/omni:yolo`'s **Landings** says. For each target, read its chain:

```bash
node .omni-loop/bin/omni.mjs plan landings <n> --repo <name> --json
```

It keeps only the landings with a slice in that target, numbered within it: a target with slices in
one landing has one feature branch, `branches.feature`, and one target feature PR with no suffix, as
above; a landing with no slice in a target gets no branch and no pull request there. With more than
one landing there, item 3 cuts each landing's `branch` (landing 1 from the target's default branch,
landing k from landing k-1's branch, each with its empty commit when new), and item 4 opens one draft
target feature PR per landing: base its `base`, title the PRD's title with its `titleSuffix`, body
`Part of <plan slug>#<n>`, then its `mergeAfterLine` when it has one, then the **Slices** of that
landing in that target, then the `## Landings` overview of that target's chain, then the
`omni sign footer` line. Each is opened through `/omni:pr --repo <slug>`, so the target's own
`pr.open` point (its flow, `pr.openWith` included), read in its clone, decides how it opens. A re-run reuses every branch and PR.

A target that cannot be cloned, fetched or pushed to, or whose pull request cannot open, is
**held**: name it and the reason, and carry on. Its slices are not claimed; they and what they block
wait for a re-run.

## 3. Loop the waves

As `/omni:yolo` step 3, with `/omni:ultra-wave <n>` in place of `/omni:wave <n>`, and the same stop
table. A slice `unreadable` on the board (its repository could not be read) holds like a `blocked`
one, naming its repository. Refresh the plan checkout, as `/omni:yolo` step 1 items 1–2, and fetch
each clone before every board read.

## 4. Finish each target

For each target with a slice merged into its feature branch, in a detached worktree of its clone at
`<clone remote>/<feature branch>`:

1. **Meet its default branch,** as `/omni:yolo` step 4 item 1: `git merge <clone remote>/<target
   default branch>` when it is not an ancestor. A conflict you cannot resolve with confidence:
   `git merge --abort`; the target is **stuck**, naming the files.
2. **Its preflight,** only when it has one (above). Red in the PRD's slices: fix it here, each fix
   counting toward `limits.attempts`; never edit code outside the PRD's slices. Red for want of an
   install or a tool: never install in a target; name it as a human step and let its CI decide.
   Still red after the attempts: the target is **stuck**.
3. `git push <clone remote> HEAD:<feature branch>`, then remove the worktree.
4. **The body:** tick its merged slices, fill **Summary**, **Verified** (its preflight and its
   result, or `none — CI is the check`), **Risk and rollback** and **Reviewer focus**, in the shape
   `/omni:pr` owns (`gh pr edit <n> --repo <slug> --body-file <file>`), keeping the
   `Part of` line first and the `omni sign footer` line last.
5. **Ready,** at point `yolo.ready` read in the target's clone (**Flow points**): every `before`
   hook, then `gh pr ready <n> --repo <slug>` as `/omni:pr`'s **Ready after a push waits for the
   push's run** says (item 3 just pushed), then every `after` hook; a `not ok` leaves the target
   PR in draft and the target **stuck**, naming the hook. Then follow `/omni:pr --repo <slug>`'s lifecycle until
   its CI is green or it is stuck. This is the only place a target feature PR is marked ready.

**Landings in a target.** Each landing of a target's chain is finished on its own branch, items 1
to 4 (item 1 meets its base: the previous landing's branch while that one is open, the target's
default branch once it has merged), and item 5 marks it ready only under `/omni:yolo`'s ready rule,
**within that target**: its slices merged into its branch, its CI green, and the previous landing's
PR **in that target** merged (`gh pr view <previous> --repo <slug> --json state --jq .state` prints
`MERGED`), never another target's. A landing whose previous one is still open stays in draft, its
status comment saying which merge it waits for, and the run carries on with the next landing and
the other targets. The plan PR then waits, below, until every target landing PR is ready or merged.

A stuck target keeps its target PR in draft with `/omni:pr`'s stuck comment, and holds the plan PR
in draft. The plan repository's own slices, when it has any, finish as `/omni:yolo` step 4 items
1–5 in a detached worktree of the plan feature branch.

## 5. One gate

In a detached worktree of the plan feature branch:

1. **The plan PR's body,** as `/omni:yolo` step 4 item 6, with one more section: **Target pull
   requests, in merge order**, one line per target PR, `<slug>#<n> — <state>, CI <green | red |
   running>`. Merge order is the earliest wave among each target's slices, then the order of
   `## Repositories`; for a plan of several landings, the plan's landing order first, each target's
   landing PRs in their own order, each line naming its landing (`landing <k>/<K> <name>`). Tick
   every merged slice in the grouped **Slices** checklist as `<slug>#<sub-PR> <title>`: grouped by
   target, then, for a plan of several landings, by landing within each target.
2. The outbox on the plan PR, then the gate, as `/omni:yolo` steps 4 item 7 and 5:

   ```bash
   node .omni-loop/bin/omni.mjs comment --prd <n> --pr <plan PR>
   node .omni-loop/bin/omni.mjs status <n>     # exit 0 green, 1 red
   ```

- **Green, and every target PR ready with green CI** (for a plan of several landings: every
  target landing PR ready with green CI, or already merged): `/omni:yolo` step 5's green path, as written:
  the release note, `omni ship`, commit, push, then `gh pr ready <plan PR>` at point `yolo.ready`,
  the plan repository's, as `/omni:yolo` step 5 item 4 runs it. **This is the only
  place the plan PR is marked ready,** and always after every target PR.
- **Green, but a target PR is not ready or its CI is not green:** the plan PR stays draft; do not
  ship. The run is **held** by that target.
- **Red:** `/omni:yolo` step 5's red path: the plan PR stays draft with the questions posted.

Then release as `/omni:yolo` step 6 does, on the plan PR, with `slices: <merged> / <total> merged`
across every repository.

**Answer here, when the gate ends red.** `/omni:yolo` step 6's last part, as written, with one
difference: **Carry on** follows `/omni:ultra-yolo-fix` steps 2 to 7 in this same run, and ends with
its step 8's hand-off. A re-run of `/omni:ultra-yolo <n>` that reaches a red gate while the plan PR
already carries a person's answers below its outbox comment carries on the same way, without the
opening question.

## 6. Hand off

As `/omni:yolo` step 7: the report, then its three blocks. The report opens with the PRD's page:
run `node .omni-loop/bin/omni.mjs dossier link <n>`; exit `0` prints `PRD <n>: <link>`, anything
else `PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>` (the plan repository's).
It adds, per target: its target PR, its state and CI, its slices merged out of total, and any target
held or stuck with its reason.

**What is next?** differs in its steps and its last lines; the folder and **Where it is** blocks are
`/omni:yolo`'s, read in the plan repository.

**Green:**

```markdown
**What is next?**

1. Merge the target pull requests first, in this order, each once its CI is green (a landing PR
   only once the landing before it in its target is merged and deployed):
   <slug>#<n> (https://github.com/<slug>/pull/<n>), then <slug>#<n> (…)
2. Then merge the plan PR last: https://github.com/<owner>/<repo>/pull/<plan PR>
   → PRD <n> is shipped: it closes the PRD.
3. If the omni-loop app is installed, it then opens a retro PR and a knowledge PR in the plan
   repository: review and merge each.

Merging the target PRs, then #<plan PR>, is yours. Until then, to keep every one of them green,
conflict-free and its review comments handled while you do other things, type /clear (or open a
new terminal), then run:

/omni:mega-pr-care <n>
```

**Red:** `/omni:yolo` step 7's red ending on the plan PR, its last line `/omni:ultra-yolo-fix <n>`.

**Held:** `/omni:yolo` step 7's held ending, the PR that holds it being the stuck sub-PR or target
PR when there is one, the plan PR otherwise; its last line `/omni:ultra-yolo <n>`.

The reply's last line is the ending's own, alone on it: `/omni:mega-pr-care <n>`,
`/omni:ultra-yolo-fix <n>` or `/omni:ultra-yolo <n>`. A run that stops before step 1 picks up the
plan PR keeps its one line and prints no hand-off.

## Guardrails

- **Never merge into any repository's default branch,** the plan repository's or a target's.
  Sub-PRs merge into a target's feature branch through `/omni:ultra-wave`; a person merges every
  target PR, then the plan PR.
- **Never add `labels.outboxGo`,** in any repository.
- **Never create a label in a target,** whatever `labels.autoCreate` says: a missing one is a human
  step.
- **Never run a command in a target other than its own committed preflight** (beyond `git` and
  `gh`, the plan repository's own `omni` reading its flow, and its own hooks, followed only in its
  worktree), and never one from an imported copy's playbook.
- **Never mark the plan PR ready** while the gate is red, before `omni ship` is committed and pushed,
  or before every target PR is ready with green CI.
- **Never ask along the way.** One outbox, in the plan repository; the one question is step 5's last
  part, as in `/omni:yolo`.
