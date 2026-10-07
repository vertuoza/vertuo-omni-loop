---
name: mega-pr-care
description: Looks after every pull request of one multi-repository PRD from its plan repository until each is merged or closed, or the person stops it — the plan PR, every target and target landing PR, and every bug-fix and record PR linked to the PRD — round by round, in merge order, as /omni:pr-care does for one feature PR. Reads each target PR against the target's own default branch, landings and wave claims, holds a CI fix while a PR waits on another repository's PR, judges review threads against each target's own review form, may fix a comment in another open PR of the list and names the commit, keeps the plan PR's target table and every PR's care line current. With --once it runs one round and returns, for a loop that calls it each tick (/omni:mega-drive). Runs nothing in a target but its own committed preflight, never merges, never marks ready, never creates a label in a target. Triggers on "look after every PR of PRD 1200", "keep the target PRs green", "handle the review comments across the repositories", "/omni:mega-pr-care".
---

# Mega PR care: every pull request of a multi-repository PRD

A **plan repository** (its config has a `plan` section) holds the PRD; its **target repositories**
hold the code. `/omni:ultra-yolo` leaves one target PR per target (or one per landing of a target's
chain) and the plan PR. This skill looks after all of them, and the bug-fix PRs linked to the PRD,
in one run.

It follows `/omni:pr-care` **step for step**, and never copies it: each step below either says "as
`/omni:pr-care` step N" and adds only what differs, or is new. Read `/omni:pr-care` alongside it;
where the two say the same thing, that skill's words are the rule.

`omni` below is `node .omni-loop/bin/omni.mjs`, always run in the plan repository. Never import the
kit, and never name a path, label, branch shape or command you can read with `omni config <key>`.

**Signing,** as `/omni:pr-care`: every commit, in any repository, ends with the co-author trailer
your session requires, then the line `omni sign trailer` prints (run from the plan repository). It
rewrites the plan PR's body, which keeps its `omni sign footer` line; comments and review replies
are never signed.

**Code runs only from a target's own config.** In a target, the one command ever run beyond `git`
and `gh` is its own committed preflight (`commands.preflightFull`, else `commands.preflight`), read
from its `.omni-loop/config.yml` on its default branch, never from a branch:
`git -C <clone> show <clone remote>/<target default branch>:.omni-loop/config.yml`. A target
without one runs nothing locally: its PR's CI is the check. Never an install, a script, or a
command from an imported copy's playbook. Everywhere `/omni:pr-care` says "run the preflight", in a
target it means this one, or nothing.

## Input

| input | example | what it is |
|---|---|---|
| a PRD number | `/omni:mega-pr-care 1200` | the multi-repository PRD whose pull requests to look after |
| `--once` | `/omni:mega-pr-care 1200 --once` | run one round over the whole list, then return: no wait, no next round |

Without a number, say that this skill takes the PRD number and stop.

**`--once`** is for a loop that calls this skill each tick (`/omni:mega-drive`), which already
decides when to look again, as `/omni:pr-care`'s `--once` is for `/omni:drive`. Everything below
holds, with the same three differences: step 1 keeps the `watching since` each status comment's care
line already carries, when it has one; after the round has rewritten every status comment and the
plan PR's target table, the run **returns**, skipping **5. Wait for the next round**; and the
worktrees under `<worktrees>/mega-pr-care-<n>/` stay for the next call, which reuses them, unless
every pull request of the list is merged or closed (**6. Stop**). Say in one line what the round did
across the list, and return.

## Step 0

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the
   JSON, as `/omni:pr-care` step 0 keeps it, and its `plan` section. Without a `plan` section, stop
   with exactly one line:

   ```text
   not a plan repository: /omni:pr-care <n>
   ```

2. The briefing (`node .omni-loop/bin/omni.mjs kb show briefing`), then the `ci` and `verification`
   forms, as `/omni:pr-care` step 0. The `review` form is read per pull request, each round (**3.
   Review threads**).

## 1. Start the watch

1. **The list.** `node .omni-loop/bin/omni.mjs care list <n> --json`: every pull request this run
   looks after, in **merge order**: the target and target landing PRs (the plan's landing order,
   then the earliest wave among each target's slices, then `## Repositories`), then each bug linked
   to the PRD (an issue labelled `labels.bug` whose body carries `For PRD #<n>`), its fix PRs in the
   order of its `<!-- omni-bug:fix-plan -->` comment and then its record PR, and the plan PR last.
   Each entry carries its `repo`, `number`, `kind` (`plan`, `target`, `landing`, `bug-fix`,
   `bug-record`), `target`, `state` and `url`. An entry whose `state` is `unreadable` is named in the
   round line and skipped until a round reads it. Every entry already merged or closed: say so in
   one line and stop.
2. **The clones.** For each target the list names, its full clone at `<worktrees>/targets/<name>`
   (`<worktrees>` is `omni config worktrees`), cloned or fetched as `/omni:ultra-yolo` step 2 item 1
   does, its default branch the target's own
   (`gh repo view <slug> --json defaultBranchRef --jq .defaultBranchRef.name`). Then, as
   `/omni:pr-care` step 1 item 2, one worktree per pull request, never the person's checkout:
   `<worktrees>/mega-pr-care-<n>/<name>-<pr>` from the target's clone, and
   `<worktrees>/mega-pr-care-<n>/plan-<pr>` from the plan repository for the plan PR and a bug's
   record PR. A target that cannot be cloned or fetched is named in the round line and skipped,
   never a stop for the others.
3. Note the time the watch starts, as `/omni:pr-care` step 1 item 3 (under `--once`, keep the one
   each care line already carries).
4. Say, in one line,
   `Looking after <k> pull requests of PRD <n> until each is merged or closed. Stop me any time.`,
   then run the first round.

## 2. A round

As `/omni:pr-care` step 2, once per pull request, **in merge order**. Each round starts with a
fresh read of the list, `node .omni-loop/bin/omni.mjs care list <n> --json` (a bug linked since
the last round joins it), then, for each open entry: fetch and reset its worktree as there, and
read its state:

```bash
node .omni-loop/bin/omni.mjs care state <n> --repo <slug> --pr <pr>   # a target, landing or bug-fix PR
node .omni-loop/bin/omni.mjs care state <n>                           # the plan PR
```

Carry out that PR's `round` exactly as `/omni:pr-care` step 2 does, its modes and its actions in
the order given. What differs:

- **A target PR's base, landings and claims are the target's own.** `care state --repo` takes the
  target's default branch from GitHub, its landing chain from
  `omni plan landings <n> --repo <name>`, and counts wave claims only among the slices whose `repo`
  is that target. `report-only` on one target's PR holds that PR alone; the others go on. A
  `restack` follows `/omni:pr-care`'s **The landing chain** in the target's clone, with the target's
  default branch in place of `repo.defaultBranch` and `--repo <slug>` on every `gh` call.
- **`merge-base` and `fix-ci`** run in the PR's own worktree, with its own preflight (above). In a
  target without one, push and let the next round read its CI.
- **Waits on another repository.** Before a `fix-ci`, read the failing job's log. When the cause is
  a change in another pull request of the list that is still open (the front-end calls a field the
  back-end PR adds), fix nothing and spend no attempt: write the line `waits on <slug>#<pr>` in this
  PR's status comment (**4. The status comment**). From the next round on, `care state` reads it:
  while the named PR is open, its round lists no `fix-ci` and carries `round.waitsOn`, said in the
  round line as `waits on <slug>#<pr>`. Once the named PR merged, the round lists one **`rerun`**:
  re-run the failed checks once (`gh run rerun <run id> --failed --repo <slug>`) and drop the
  `waits on` line. Still red after that run, `fix-ci` comes back, as `/omni:pr-care` counts it. A
  red that is the branch's own is never written as waiting.
- **A bug-fix PR** goes into its target's default branch, not a feature branch: its round is the
  same, and a fix it makes stays inside the bug's fix plan.

## 3. Review threads

As `/omni:pr-care` step 3: one of three verdicts per thread, the reply through
`node .omni-loop/bin/omni.mjs care reply --verdict <verdict> --file <file> --thread <thread id> --repo <slug>`,
the reviewer keeps the last word. What differs:

- **The rubric is the target's own.** A target, landing or bug-fix PR's threads are judged against
  that target's own committed `review` form, read in its clone, each round:
  `(cd <clone> && node <plan repository root>/.omni-loop/bin/omni.mjs kb show review)`, as
  `/omni:ultra-wave` reads a target's flow. A target without one is judged against the kit default
  it prints. **Never the imported copy** in the plan repository. The plan PR and a record PR are
  judged against the plan repository's own form.
- **A cross-repository fix.** A comment whose fix belongs in another pull request of the list may
  be fixed there, only when that PR is still **open** and the change stays inside PRD n's slices for
  that target (or inside the bug's fix plan, for a bug-fix PR). Make it in that PR's worktree, its
  preflight green (above), one commit, pushed there. The reply on the thread is
  `Fixed in <slug>@<sha>: <one line>`, verdict `fixed`, with the commit's short sha and the
  repository it landed in. Otherwise, the other PR merged or closed, or the change outside those
  bounds, the thread is **asked**, the reply naming the repository the fix belongs in.

## 4. The status comment

As `/omni:pr-care` step 4, on **every** pull request of the list: its status comment found by its
marker and rewritten in place, never `gh pr comment --edit-last`, with the care line in exactly
`/omni:pr-care`'s form:

```markdown
- PR care: watching since <ISO 8601> · last round <ISO 8601>
```

The PRD page reads it from the plan PR, as it does today. A PR that waits on another keeps, under
the care line, the line `waits on <slug>#<pr>` (the exact form `care state` reads) until a `rerun`
drops it.

**The plan PR's target table.** Each round also rewrites the plan PR body's **Target pull requests,
in merge order** section from the list, one line per target, landing and bug-fix PR, in its order:

```markdown
- <slug>#<n> — <state>, CI <green | red | running | waits on <slug>#<pr>>
```

A landing's line names its landing, as `/omni:ultra-yolo` step 5 writes it. Everything else in the
body is kept as it is, the `omni sign footer` line last
(`gh pr edit <plan PR> --body-file <file>`).

## 5. Wait for the next round

Under `--once`, there is no next round here: the round is done, so return (the caller wakes it
again). Without it, as `/omni:pr-care` step 5, over the whole list: a round runs when a CI run on any open pull request
of the list finishes, and otherwise every 5 minutes. Watch one running PR at a time in the
background (`gh pr checks <pr> --repo <slug> --watch --interval 30`, `run_in_background: true`, a
`timeout` of 300000 ms), or a background `sleep 300` when none runs.

## 6. Stop

As `/omni:pr-care` step 6: the watch ends when **every** pull request of the list is merged or
closed, or when **the person stops it**. Rewrite every open PR's status comment one last time,
remove every worktree under `<worktrees>/mega-pr-care-<n>/` (`git worktree remove`, from the clone
or the plan repository it came from), and say one line per pull request, in merge order:
`<slug>#<pr>: merged. 2 fixed, 1 pushed back, 0 asked.`

## Guardrails

- **Never merge,** in any repository, and never mark a pull request ready or back to draft.
- **Never add `labels.outboxGo`,** in any repository.
- **Never create a label in a target,** whatever `labels.autoCreate` says: a missing one is a human
  step.
- **Never run a command in a target other than its own committed preflight** (beyond `git` and
  `gh`, and the plan repository's own `omni` reading its forms in its clone), and never one from an
  imported copy's playbook.
- **Never push to a PR whose round is `report-only`;** a wave in one target holds that target's PRs
  alone.
- **Never spend an attempt on a red that waits on another pull request,** and never fix in another
  repository outside PRD n's slices or the bug's fix plan, or in a PR that is no longer open.
- **Never touch a pull request the list does not name.**
