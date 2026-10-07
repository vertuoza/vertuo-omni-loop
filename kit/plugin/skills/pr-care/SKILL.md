---
name: pr-care
description: Looks after one PRD's feature PR until it is merged or closed, or the person stops it — round by round, when a CI run finishes and otherwise every 5 minutes, it merges the base on a conflict, runs /omni:pr's fix loop on red CI, then judges each unhandled review thread against the review playbook form and fixes it, pushes back with a reason, or asks the PM, replying through omni care reply with the marker the PRD page reads. With --once it runs one round and returns, for a loop that calls it each tick (/omni:drive). Pushes nothing while a wave holds claims, keeps the care line of the status comment current, never merges and never marks ready. Triggers on "look after the feature PR", "handle the review comments", "keep my PR green", "watch PRD 790's PR", "/omni:pr-care".
---

# PR care: keep the feature PR green, conflict-free and review-handled

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`. `<remote>` is `repo.remote`.

This skill looks after the **feature PR** only: the one pull request PRD n sends to the default
branch. For a PRD of several landings, that is the first **landing PR** still open (the one
`care state` names), and the chain of landing PRs behind it, kept stacked as each one merges. Phase-0 PRs, sub-PRs, retro, knowledge and fix PRs are out of its scope; a sub-PR's review threads are judged by `/omni:wave` before it merges the sub-PR, with **3. Review threads** below. A person runs it in
a terminal and leaves it running: it watches on this machine, needs no new secret or runner, and
stops when the terminal does, which the PRD page's watcher line makes visible.

**Signing.** Every commit this skill makes (a resolved conflict, a CI fix, a review fix) ends with
the co-author trailer your session requires, then the line `omni sign trailer` prints as the
message's last line, with no blank line between them. It opens no pull request or issue, and a body
it never rewrites; comments and review replies are never signed. A command that prints nothing means
signing is off here: add nothing.

## Input

| input | example | what it is |
|---|---|---|
| a PRD number | `/omni:pr-care 790` | the PRD whose feature PR to look after |
| `--once` | `/omni:pr-care 790 --once` | run one round, then return: no wait, no next round |

Without a number, say that this skill takes the PRD number and stop.

**`--once`** is for a loop that calls this skill each tick (`/omni:drive`), which already decides
when to look again. Everything below holds, round for round, with three differences: step 1 keeps
the `watching since` the status comment's care line already carries, when it has one; after the
round's `status` action the run **returns**, skipping **5. Wait for the next round**; and the
worktree stays for the next call, which reuses it, unless the round was a `stop`. Say in one line
what the round did, as its status line does, and return.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON:
later steps read `repo.*`, `branches.feature`, `worktrees`, `commands.*`, `labels.*`,
`limits.attempts` and `markers.prefix` from it.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`.
Its rules bind every step below. Then read the rubric every review thread is judged against:
`node .omni-loop/bin/omni.mjs kb show review`, the `fix`, `push-back` and `ask` sections, the
repository's own lines or the kit default. Read it again at the start of every round, so a line a
tech lead moved takes effect on the next one. Read `node .omni-loop/bin/omni.mjs kb show ci` and
`node .omni-loop/bin/omni.mjs kb show verification` once, as `/omni:pr` does.

## 1. Start the watch

1. `node .omni-loop/bin/omni.mjs care state <n>`. Exit 1 means the PRD has no feature PR yet: say so
   in one line and stop. Its JSON names the feature PR (`pr.number`, `pr.url`, `pr.head`, `pr.base`).
   A `round.mode` of `stop` means it is already merged or closed: say so and stop.
2. Work in a worktree of the feature branch of its own, never in the person's checkout:
   `git fetch <remote>`, then `git worktree add <worktrees>/pr-care-<n> <remote>/<pr.head>` and
   `git -C <worktrees>/pr-care-<n> switch -C <pr.head> <remote>/<pr.head>` (reuse the worktree when
   it already exists, after the same fetch and switch). Every git command and every fix below runs
   there.
3. Note the time the watch starts, in ISO 8601 UTC (`date -u +%Y-%m-%dT%H:%M:%SZ`): it is the
   `watching since` of every status comment this run writes. Under `--once`, keep the one the care
   line already carries, when there is one.
4. Say, in one line, `Looking after #<pr.number> (PRD <n>) until it is merged or closed. Stop me any time.`,
   then run the first round.

## 2. A round

Each round starts with a fresh read, and acts on nothing else:

```bash
git -C <worktrees>/pr-care-<n> fetch <remote>
git -C <worktrees>/pr-care-<n> reset --hard <remote>/<pr.head>   # the worktree is this skill's own
node .omni-loop/bin/omni.mjs care state <n>
```

When `pr.number` is not the one the last round looked after (a landing merged, and the next landing
is now the one to watch), switch the worktree to its head first, as step 1 item 2 does.

Its `round` is the pure decision the kit drew from the state: a `mode`, and the ordered `actions`.
Carry them out in that order and do nothing it does not list.

| `round.mode` | what the round does |
|---|---|
| `stop` | the PR is merged or closed: go to **6. Stop**. For a PRD of several landings, `care state` names the next landing's PR once one merges, so `stop` comes only after the last |
| `report-only` | a wave holds claims on the feature branch (`wave.claimed` names the slices), or the board could not be read (`wave.holdsClaims` is `null`): push nothing, reply to nothing, resolve nothing; rewrite the status comment alone, saying so |
| `act` | carry out every action below, in the order listed |

The actions, in the order the decision always gives them:

1. **`restack`**, only for a PRD of several landings: landing `after.landing`'s PR has merged, and
   landing `landing`'s PR (`pr`, branch `branch`) is the next one. **The landing chain** (below) says
   what to do. It comes first: it moves the base every later action reads. A PRD of one landing never
   lists it.
2. **`merge-base`**, the PR conflicts with its base: `/omni:pr`'s conflict step. Merge
   `<remote>/<base>` into the feature branch, resolve, run the preflight (`commands.preflightFull`,
   or `commands.preflight` when it is null), commit, push. This is not an attempt. A preflight that
   stays red after the merge is a red check: the next round's CI takes it, as below.
3. **`fix-ci`**, CI is red on something the branch can fix (`checks.failed` names each failed run
   and its link): `/omni:pr`'s fix loop, **On red** step for step: read the failing job, decide
   whether the branch caused it, re-run only when the `ci` form allows it, otherwise fix the cause,
   run the preflight, push, and bump the attempt in the status comment. The attempts are
   `limits.attempts`, counted in the status comment's `attempt` line across rounds. Once they are
   spent, take `/omni:pr`'s **Stuck** path: add `labels.needsFix`, post its "Stuck after N attempts"
   comment, set the state to `stuck`. The kit then reads the PR as `checks.stuck`, so later rounds no
   longer list `fix-ci`, and **the watch goes on** for conflicts and reviews. A person removing the
   label hands CI back to care. CI red only on the outbox or inbox gate is the gate doing its job:
   the kit does not list `fix-ci` for it.
4. **`judge`**, one per review thread without a care reply: **3. Review threads**.
5. **`mark-asked`**, one per thread a person wrote in after a care reply, or reopened after care
   resolved it: **3. Review threads**, *The reviewer keeps the last word*.
6. **`status`**, always last: **4. The status comment**.

Running CI (`checks.state` `running`) lists no CI action: the round handles the rest and the next
round reads it again.

### The landing chain

A `restack` action carries `landing`, `pr`, `branch`, `base` (what its PR targets now), `retarget`,
`after` (the landing that merged: its `landing`, `pr` and `branch`) and `later` (every open landing
after it, in order). Landing n is `after`, landing n+1 is the action's own.

1. **The base.** GitHub retargets landing n+1's PR onto the default branch only when landing n's
   branch was deleted with the merge. `retarget` false: it did, say so in the round line. `retarget`
   true: do it, `gh pr edit <pr> --base <repo.defaultBranch>`, and read it again with
   `gh pr view <pr> --json baseRefName`.
2. **The branch.** Landing n's own commits are already in the default branch, squashed, so landing
   n+1's branch drops them and keeps only its own:

   ```bash
   OLD=$(gh pr view <after.pr> --json headRefOid --jq .headRefOid)   # landing n's last commit
   git -C <worktrees>/pr-care-<n> fetch <remote>
   git -C <worktrees>/pr-care-<n> merge-base --is-ancestor "$OLD" <remote>/<branch>   # 0: still to rebase
   git -C <worktrees>/pr-care-<n> switch -C <branch> <remote>/<branch>
   git -C <worktrees>/pr-care-<n> rebase --onto <remote>/<repo.defaultBranch> "$OLD"
   ```

   When `merge-base --is-ancestor` exits non-zero, the branch was rebased already: skip to item 4.
   Run the preflight, then `git push --force-with-lease <remote> <branch>`.
3. **Down the chain.** For each landing of `later`, in order: its old base is the previous landing's
   branch as it was before item 2 (keep `git rev-parse <remote>/<previous branch>` from before that
   push), its new base the rebased previous branch. `git switch -C <its branch> <remote>/<its branch>`,
   `git rebase --onto <rebased previous branch> <old previous tip>`, the preflight, then
   `git push --force-with-lease <remote> <its branch>`. Its PR keeps the previous landing's branch as
   its base: GitHub reads the new diff by itself.
4. **A conflict** in any rebase: `git rebase --abort`, and stop the chain at that landing, never
   resolving it blindly. It is a care finding: the round line says
   `restack stopped at landing <k> (#<its pr>): <the conflicting files>`, and the status comment's
   `human steps` names the landing and the files. The landings after it stay as they are.
5. Then switch the worktree back to the PR care looks after (`pr.head`) before the next action.

## 3. Review threads

Each `judge` action names a thread id; its comments are in the state's `threads` entry with that id
(`path`, `line`, and each comment's `author`, `body` and `url`). Read the comments and the code they
point at, then judge the thread against the `review` form you read this round
(`node .omni-loop/bin/omni.mjs kb show review`). It gets exactly one
of three verdicts, and the reply names the rubric line it rests on:

- **fixed**: the comment falls under a `fix` line. Make the change in the worktree, test-first when
  it changes behaviour, run the preflight, and commit it alone (one commit per thread). Push. Reply
  `Fixed in <sha>: <one line>`, with the commit's short sha and what changed. The reply resolves the
  thread.
- **pushed-back**: the comment falls under a `push-back` line. Change nothing. Reply with a short,
  polite reason that names the line it rests on, for example
  `Low value for this PR: naming preference, no linter rule. Happy to take it as a follow-up.`
  The reply resolves the thread: a thread resolved without a code change always carries its reason.
- **asked**: the comment needs a product decision, or following it would contradict the spec (read
  the PRD's spec with `omni prd <n>`). Change nothing. Reply that the PM will decide, and why, in one
  line. The thread **stays open**, and the PRD page lists it first.

In doubt between fix and push-back, the rubric decides, never taste: a comment that names no defect
and matches no `fix` line is pushed back. A fix that cannot go green (its preflight stays red after
`limits.attempts` tries) is not pushed: revert it, and the thread becomes **asked**, the reply saying
what was tried.

Post every reply through the kit, never with a raw `gh` call, so it ends with the marker the next
round and the PRD page read, `<!-- omni-care: fixed|pushed-back|asked -->`. Write the reply's text
to a scratch file (never in the repository), then:

```bash
node .omni-loop/bin/omni.mjs care reply --verdict <verdict> --file <file> --thread <thread id>
```

`<verdict>` is `fixed`, `pushed-back` or `asked`. It posts the reply on the thread and, for `fixed`
and `pushed-back`, resolves the thread; an `asked` thread stays open. Exit 1 means GitHub refused it:
say so in the status comment and carry on with the next thread.

**The reviewer keeps the last word.** When a person writes in a thread after a care reply, or
reopens a thread care resolved, the state lists it as `mark-asked`. Never argue again, change
nothing, and never re-judge it: reply once with `--verdict asked` (`Over to the PM: <reviewer> and
I read this differently.`), which leaves it open for the PM. An asked thread stays with the PM for
good: later rounds skip it, whatever is said after.

## 4. The status comment

Each round rewrites `/omni:pr`'s status comment on the feature PR, found by its marker
(`<!-- <markers.prefix>-status -->`, with `markers.prefix` read from the config) and rewritten in
place with `/omni:pr`'s recipe. **Never** use `gh pr comment --edit-last`. When the PR has none yet,
post it with that recipe. Keep `/omni:pr`'s lines as they are (the state, the attempt, the slices,
the human steps), update `updated`, and add or replace one line, always in exactly this form, both
times in ISO 8601 UTC:

```markdown
- PR care: watching since <ISO 8601> · last round <ISO 8601>
```

`watching since` is the time this watch started (step 1); `last round` is this round's time
(`date -u +%Y-%m-%dT%H:%M:%SZ`). The PRD page reads this line: a last round under 15 minutes old
reads `Claude is watching`, an older one `Nobody is watching`. Under it, one line says what the
round did: `report only: a wave holds s3, s4`, `merged main`, `fixing <check> (attempt k)`, `3
threads: 1 fixed, 1 pushed back, 1 asked`, or `nothing to do`.

## 5. Wait for the next round

Under `--once`, there is no next round here: the round is done, so return (the caller wakes it
again). Without it:

A round runs when a CI run on the feature PR finishes, and otherwise every 5 minutes. A foreground
command is killed after at most 10 minutes, so wait in the background, with Bash
`run_in_background: true` and a `timeout` of 300000 ms, and run the next round when it wakes you:

```bash
gh pr checks <pr.number> --watch --interval 30   # while checks run: wakes when the run finishes
```

When no check is running, wait out the 5 minutes the same way (a background `sleep 300`). Either
way, the next round starts at **2. A round**.

## 6. Stop

The watch ends when the feature PR is **merged** or **closed** (`round.mode` is `stop`), or when
**the person stops it**. On a stop, rewrite the status comment one last time (its care line keeps
the last round's time, so the page soon reads `Nobody is watching`), remove the worktree
(`git worktree remove <worktrees>/pr-care-<n>`), and say in one line why it stopped and what each
thread ended as: `#<pr.number>: merged. 4 fixed, 2 pushed back, 1 asked.`

## Guardrails

- **Never push while a wave holds claims.** `report-only` pushes, replies and resolves nothing; it
  rewrites the status comment alone.
- **Never merge,** and never mark the feature PR ready or back to draft: merging is a person's, ready
  is `/omni:yolo`'s. A landing PR is no different, whatever its base.
- **Never force-push a landing branch** but through **The landing chain**, with
  `--force-with-lease`, and never while a wave holds claims.
- **Never add `labels.outboxGo`,** and never touch a PR other than PRD n's feature PR.
- **Never resolve a thread without a reply** that says why, and never resolve an asked one.
- **Never argue twice:** a person's word after a care reply sends the thread to the PM.
- **Never push a fix whose preflight is red,** and never lower a check to turn it green.
