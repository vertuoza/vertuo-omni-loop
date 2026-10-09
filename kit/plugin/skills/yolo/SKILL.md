---
name: yolo
description: Build a whole PRD with nothing asked along the way — plan it if needed, run /omni:wave until every slice is merged or nothing more can move, then finish the feature branch, run the outbox gate, and ship before ready. Green gate — omni ship, commit, push, then the feature PR is marked ready. Red gate — the feature PR stays draft with the outbox questions posted on it, then, with answers.enabled on, it offers to take the answers here and carry on into the yolo-fix steps. Never merges into the default branch. Triggers on "yolo this PRD", "build it, I'll review the outbox after", "/omni:yolo".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-yolo/SKILL.md (and vertuo-deliver §1–3, with the ask-nothing policy) — changes in kit/porting/plugin--yolo.md -->

# Yolo: every wave, the gate, ship before ready

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

**It asks nothing along the way.** Every decision a slice meets becomes an outbox item
(`/omni:do-work` records it and carries on); a person reads them all once, at the end: on the
feature PR, on the Omni page, or, when the gate ends red and `answers.enabled` is on, here in the
terminal (the end of step 6). Only `stopped` and `blocked` hold a slice, and only that one.

**Flow points.** A repository may hook the loop at named points (the `flow` of its config). This
skill has one, `yolo.ready` (step 5, item 4). At it, run
`node .omni-loop/bin/omni.mjs flow show yolo.ready` and follow what it prints: every `before` hook,
then the kit's step, then every `after` hook (`yolo.ready` takes no `replace`). A hook is Markdown to
follow; an input it leaves as `{name}` is filled from this step. Following a hook ends on its verdict
line (`omni-hook yolo.ready: pass`, or `omni-hook yolo.ready: fail <why>`): write what it produced,
that line last, to a scratch file and run
`node .omni-loop/bin/omni.mjs flow verdict yolo.ready --from <file>`. `ok` carries on; `not ok` stops
the point as a failing kit step would, and so does `flow show` exiting 1 (a hook file missing). A
hook never loosens a guard: the gate, `omni ship` and the stacked base's check run whatever it says.
With no `flow`, `flow show` prints `hooks none` and `kitStep: run`: the step runs as written.

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

**A PRD that spans repositories.** Run `node .omni-loop/bin/omni.mjs prd <n>`. When it prints a
`repos:` line, the PRD's plan lands slices in other repositories: stop with the one line
`PRD <n> spans repositories: /omni:ultra-yolo <n> builds it`, before any branch, claim or dispatch.
Read the same way every later `omni prd <n>` of this run (step 1, item 3, reads it on the feature
branch, where the plan lives): a `repos:` line there stops the run with the same line, before any
plan, claim or wave.

## Landings

A PRD whose plan has more than one landing (`node .omni-loop/bin/omni.mjs plan landings <n> --json`
lists more than one, read on landing 1's branch, where the plan lives) reaches the default branch in
one pull request per landing, stacked, and this run builds them **in order**. For each landing, the
steps below run as written, with "the feature branch" meaning that landing's `branch` and "the
feature PR" that landing's PR. A PRD of one landing runs every step exactly as it always has, and
this section does not apply.

1. **The current landing** is the board's `currentLanding` (`omni board <prd> --json`): the first
   whose slices are not all merged. Build it through step 3. Before its first wave, when the landing
   before it is still open, bring that landing's finished work in: in a detached worktree of this
   landing's branch, `git merge <remote>/<previous landing branch>`, push it to this landing's
   branch, and remove the worktree. A conflict there takes the **Stuck** path of step 4, item 1.
2. **Finish it** (step 4) on its branch. Item 1 meets **its base**, not always the default branch:
   landing n-1's branch while that landing's PR is open, the default branch once it is merged
   (`gh pr view <previous PR> --json state --jq .state` prints `MERGED`).
3. **The gate runs per landing**: `omni status <prd>` on that landing's branch, with that landing's
   outbox comment on that landing's PR. A red gate ends the run as it does today (steps 5 and 6),
   on this landing: a later landing is built on this one's code, so it waits for the answers.
4. **`omni ship` runs on the last landing only.** It moves the PRD's folder to the shipped folder,
   which can happen once: an earlier landing goes from a green gate straight to the ready rule, and
   the last one ships first, as step 5 says.
5. **The ready rule.** Mark landing n's PR ready (`gh pr ready`, step 5 item 4) only when every
   slice of landing n is merged into its branch, its gate is green (and, for the last landing,
   `omni ship` ran), its CI is green, **and** landing n-1's PR is merged, checked through GitHub
   (`gh pr view <previous PR> --json state --jq .state` prints `MERGED`), never assumed. Landing 1
   has no previous landing. Its CI runs once it leaves draft: for landing n > 1 whose previous
   landing is open, the PR stays in draft, its status comment says
   `waits for the merge of landing <n-1> (#<previous PR>)`, and the run **carries on** to the next
   landing without waiting for a person.
6. **The body.** Landing n's body carries, under the link line, its `mergeAfterLine`
   (`Merge after landing <n-1> (<name>) is deployed.`) and landing 1's carries none; its
   **Slices** are that landing's only, and its `## Landings` overview lists every landing PR with
   its state, rewritten each time a landing changes state (`/omni:pr`'s **Landing PR** shape).
7. **The end.** The run stops when every landing is finished, or at the first held or red landing.
   A landing finished while the one before it is not yet merged is left in draft, and the hand-off
   says which merge it waits for. Re-running resumes from GitHub: the board names the current
   landing, and a finished landing whose previous one has merged since is marked ready then.

The hand-off (step 7) lists every landing PR, in order, with its state (`ready`, `draft`, `merged`)
and the merge it waits for, and "the feature PR" there is the last landing's.

## 1. Find the PRD, the plan and the feature PR

1. `git fetch <remote>`, then
   `gh pr list --head <feature branch> --state open --json number,isDraft,labels,baseRefName`. The
   feature PR is found by its head, whatever its base: its `baseRefName` is **its base**, which is
   `repo.defaultBranch` unless the PR is stacked (**A stacked feature PR**, below).
2. The plan and the PRD's outbox live on the feature branch, so read them there: when the branch
   exists, `git switch --detach <remote>/<feature branch>`. First the checkout must be clean: no
   tracked changes (`git status --porcelain --untracked-files=no` prints nothing). Otherwise stop in
   one line naming it; never stash, clean or reset. **Do this again before every board read**: each
   wave moves the feature branch. The run leaves the checkout detached; say so in the report.
3. `node .omni-loop/bin/omni.mjs prd <n>`. A `repos:` line stops the run (Step 0, **A PRD that
   spans repositories**). It must be in state `inbox`. `shipped`, with the feature
   PR still a draft, means a previous run shipped and stopped before ready: go to step 5, green path,
   item 4. Anything else: stop and say where it is.
   It always exits 0: gate on its `state:` line, never on the exit code. A PRD born on the server
   (◆) also prints `birthplace: server` and its `approval:` lines, and reads `inbox` only once a
   workspace member approved it on its page and every approved file on the feature branch still
   matches.

   **Waiting for approval, it waits.** In state `prd`, the run does not stop: run
   `node .omni-loop/bin/omni.mjs wait approval <n>` and wait for it to end, printing each line it
   prints. It may run up to its `--timeout` (60 minutes by default): when your shell bounds a
   command's time below that, run it in the background and read its exit code once it ends. It
   asks the PRD's approvers (the product's members asked to approve, except the author, or the
   author when nobody else is) by the alerts each one turned on, prints the waiting line
   (`◌ PRD <n> · waiting for …`), then follows the approval until it lands; a voided approval prints
   the voided line, asks again and keeps waiting, and a cut stream is resumed on its own.
   - Exit `0` (`✓ PRD <n> approved by <login> · <time> · <k> files pinned`): run `omni prd <n>`
     again and gate on it as above. In `inbox`, go on (item 4, then wave 1) without being typed
     again.
   - Exit `1`: the run ends held, on the last line the wait printed (`no sign-in (omni signin) ·
     held`, or `held: still waiting for <names> after <minutes> min`). Nothing else runs.

   Pass `--timeout <minutes>` only when the person gave one. Never approve the PRD yourself: an
   approver does, on its page.

   In any other state but `inbox`, stop with the line its state gives, as `omni prd` prints it after
   `approval: `, and nothing else runs (no plan, no claim, no wave):

   | `state:` | the line the run stops on |
   |---|---|
   | `drifted` | each `≠ <file> · content` (or `· whitespace only`) `· ✗ refuse · restore it, or approve again: <link>` |
   | `unreachable` | `server unreachable · held, not failed`: the PRD is held, not failed; run this again once the server answers |
   | `refused` | `approver <login> is not a workspace member`, or `refused (<status>)` |

   A ◇ PRD (no `birthplace:` line) never reads any of the four, never waits and calls no server.
4. No feature branch, no feature PR, or no `plan.md` in the PRD's files: follow `/omni:plan` first.
   It may return `needs clarification`: stop, and say what the PRD must answer. Otherwise go back to
   item 1 with its feature PR.

### A stacked feature PR

A feature PR whose base is not `repo.defaultBranch` is **stacked** on another branch, usually the
head of another PRD's open PR. Landing n > 1 of a PRD of several landings is stacked on landing n-1
by **Landings**, which says how; this part is about a feature PR (or landing 1) stacked on a branch
outside its PRD. A PR whose base is `repo.defaultBranch` skips it: every step runs as written.

1. **The base PR** is the PR whose head is its base:
   `gh pr list --head <base> --state all --json number,state --limit 1`.
2. **Its base merged.** When the base PR's state is `MERGED`, the feature PR is no longer stacked:
   `gh pr edit <feature PR> --base <repo.defaultBranch>` (GitHub may have done it already), and its
   base is `repo.defaultBranch` from here on.
3. **Its base moved under it.** Otherwise run
   `git merge-base --is-ancestor <remote>/<base> <remote>/<feature branch>`. When it fails, stop with
   the one line `<feature branch> is not on <base>'s head: rebase it onto <remote>/<base>, then
   /omni:yolo <n>`, before any claim or wave: the base was rewritten or moved on, and which commits
   to keep is a person's call. When it passes, keep `<remote>/<base>`'s commit as **the base head**
   this run saw.
4. **Everywhere below, its base stands in for the default branch:** step 4 meets it, the release
   note is the diff against it, and step 5 never marks the feature PR ready while the base PR is
   open, or when no PR heads the base (a branch no PR brings to the default branch).

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

1. **Meet its base:** `repo.defaultBranch`, or the branch a stacked feature PR is based on. If
   `git merge-base --is-ancestor <remote>/<base> HEAD` fails, run `git merge <remote>/<base>`. For a
   stacked base, merge only when the base moved forward, that is when **the base head** step 1 kept
   is an ancestor of `<remote>/<base>`; when it is not, the base was rewritten: remove the worktree
   and stop with step 1's one line. A conflict on a path under a generated entry's `path`
   (`node .omni-loop/bin/omni.mjs config generated`) is never a reason to stop: take either side
   (`git checkout --theirs -- <path>`, then `git add -- <path>`), since item 3 rebuilds it. Any other
   conflict you cannot resolve with confidence: `git merge --abort`, and take `/omni:pr`'s **Stuck** path for the feature PR, naming
   the conflicting files as what a person should look at. Post the outbox (the `omni comment` line
   step 5 opens with), remove the worktree, and go to step 7.
2. **Install when the ground moved.** If the merge changed the lockfile or any package manifest,
   install the dependencies in the worktree with the repository's package manager before checking.
   It is not an attempt.
3. **Rebuild, then check the whole feature.** First the generated files, after the merge of item 1,
   as `/omni:wave` step 5 rebuilds them: run
   `node .omni-loop/bin/omni.mjs generated <remote>/<base>..HEAD` (one line per generated entry,
   `<path>: stale|fresh — <build>`, or `no generated files`) and run the build of every `stale` line
   from the worktree's root. Then the preflight (`commands.preflightFull`, or `commands.preflight`
   when null), every command in `commands.checks`, then `node .omni-loop/bin/omni.mjs check all`. Red
   because of the environment (a missing install, a tool, the network): fix the environment and rerun;
   that is not code to fix. Red in the PRD's own slices: fix it here; each fix counts toward
   `limits.attempts`, and a fix that changes a generated entry's sources reruns its build. **Never
   edit code outside the PRD's slices to turn the finish green.** Still red: the Stuck path, naming
   the red step; post the outbox (as above), remove the worktree, and go to step 7. Green: commit the
   rebuilt paths alone, `git add -- <path>` for each `stale` line and nothing else, as
   `chore(build): rebuild generated files — finish of PRD <prd>`, with your session's co-author
   trailer, then the `omni sign trailer` line. Nothing stale, or a build that changed nothing: no
   commit.
4. **Acceptance,** only when `acceptance.enabled`: run `acceptance.run` twice.
5. `git push <remote> HEAD:<feature branch>`.
6. **The body.** Tick every slice, and every passing scenario, and fill **Summary**, **Verified** (the
   commands that ran and their result), **Risk and rollback** and **Reviewer focus**, in the shape
   `/omni:pr` owns (`gh pr edit <feature PR> --body-file <file>`), still ending with the
   `omni sign footer` line.
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

1. **The release note,** only when `node .omni-loop/bin/omni.mjs config releaseNotes.enabled` prints
   `true`; otherwise go to item 2. The note is `release.md` in the PRD's folder (the one
   `omni prd <prd>` prints), beside its spec.
   - **None there:** write it. What it holds and how it reads are the **Release notes** section of
     `node .omni-loop/bin/omni.mjs kb show releasing`: follow it, and never restate it here. Write
     it from the spec and from what the feature branch actually built
     (`git diff <remote>/<base>...HEAD`, its base being `repo.defaultBranch` unless it is stacked), never from the plan: a slice that was not
     built, or a decision a person reversed, is not in the note.
   - **One there** (a person wrote or edited it on the branch, or an earlier run did): keep its
     words, and change only what the check below refuses.
   - `node .omni-loop/bin/omni.mjs check releases`, and fix the note until it is green. Still red
     after `limits.attempts` rewrites: do not ship; name the rule in step 6 as `stuck`.
   - Commit the note alone as `docs(release): PRD <prd> release note`, with your session's
     co-author trailer, then the `omni sign trailer` line; it is pushed with the move (item 3). A
     kept note that did not change needs no commit.
2. **The shipped round** first, only when the PRD's folder holds a `voice.json` and
   `node .omni-loop/bin/omni.mjs business show --json` lists personas; otherwise go straight to the
   ship below. The personas judge what actually shipped: the release note of item 1, when there is
   one, and the final before/after page. Append round `shipped` to `voice.json` as
   `/omni:brainstorm`'s **The voice** writes a round (today's date, each persona's score and cited
   reaction, the objection or none, the fit line), run `node .omni-loop/bin/omni.mjs check inbox`
   until it is green, and commit it alone as `docs(voice): PRD <prd> shipped round`, with your
   session's co-author trailer, then the `omni sign trailer` line; it is pushed with the move
   (item 3). A read that is not `ok` and lists no personas writes no round and stops nothing.
   Then `node .omni-loop/bin/omni.mjs ship <prd>`. It stages the move and prints what moved.
   - Exit 1 names each reason it refused (with the switch on, a missing or failing release note is
     one): the feature PR stays draft; name them in step 6 as `stuck`.
   - Exit 2 means the delivery folder holds uncommitted changes. Commit them if they are this run's
     own (the body file never lives there), then rerun once; otherwise stop, as for exit 1.
3. Commit the move as `chore(delivery): ship PRD <prd>`, with your session's co-author trailer, then
   the `omni sign trailer` line, and `git push <remote> HEAD:<feature branch>`. When item 2 wrote a
   shipped round, follow `/omni:dossier-push <prd>` from the worktree, so the PRD's User voice tab
   ends on what shipped; whatever it prints, carry on.
4. Only now, `gh pr ready <feature PR>`, once a stacked feature PR's base allows it, at **point
   `yolo.ready`**: once the base allows it, run `node .omni-loop/bin/omni.mjs flow show yolo.ready`
   and follow every `before` hook (`{prd}` the PRD, `{pr}` the feature PR), then `gh pr ready`, then
   every `after` hook (**Flow points**). Item 3 has just pushed: run `gh pr ready` as `/omni:pr`'s
   **Ready after a push waits for the push's run** says, waiting for the push's run first and
   rerunning a cancelled ready run after. A `not ok` from a `before` hook leaves the feature PR in
   draft: name the hook and its reason in step 6 as `stuck`, and skip the rest of this item. **A stacked
   feature PR waits for its base:** when its base is not `repo.defaultBranch`, first read the base
   PR again through GitHub, never from memory
   (`gh pr list --head <base> --state all --json number,state --limit 1`). `MERGED`: retarget it
   (**A stacked feature PR**, item 2) and carry on. Open, or no PR heads the base: leave the feature
   PR in draft, write its status comment with `waits for the merge of #<base PR>` (or `waits for
   <base> to reach <repo.defaultBranch>`), skip the rest of this item and item 5, and end the run
   **held** (step 6, then step 7's held ending, whose one thing to do is that merge): re-running
   `/omni:yolo <n>` once it merged resumes here. **This is the only place in this skill a feature PR is
   marked ready**; `/omni:yolo-fix` follows this same green path after its own ship. CI runs on it
   once: follow `/omni:pr`'s lifecycle for the feature PR until its checks are green or it is stuck.
5. **The proof,** only when the spec's front matter says `proof: video` (PRD 798): follow
   `/omni:prove <prd>`. Whatever it prints, a stop line included, this run goes on to step 6: a proof
   never changes the PR's state, its labels or its checks.

The **omni-loop** GitHub App, when installed on the repository, posts this same gate on the feature
PR as the check named `ci.outboxContext`; this skill never posts it and never waits on it.

**Gate red.** Leave the feature PR in **draft**; do not ship. The comment above holds every open
question in plain words, each under a number. The end of step 6 may yet answer them in this run.

Then `git worktree remove <path>`.

## 6. Release

Remove `labels.inProgress` from the feature PR (unless the Stuck path already swapped it for
`labels.needsFix`), and write its final status comment through `/omni:pr`'s marker recipe, with
`slices: <merged> / <total> merged` and one of `/omni:pr`'s states:

- `done`: shipped and ready, or every slice merged with the gate red. For the red gate, the
  `human steps` line says "answer the outbox questions on this PR, then `/omni:yolo-fix <prd>`".
- `stuck`: held (a stuck, stopped, blocked or in-flight slice, a red wave check) or a stuck finish,
  with the reason; `human steps` names what a person must do.

### Answer here, when the gate ends red

Only when every slice merged, the gate in step 4 read red, and
`node .omni-loop/bin/omni.mjs config answers.enabled` prints `true`. Held, stuck or green, go
straight to step 7. When `answers.enabled` is off, skip this part too: the hand-off in step 7 says
to answer on the pull request, as it always has.

By now the outbox comment, the draft feature PR and its final status comment are written, so
nothing is lost if the person walks away. Count the open `human-action` and `high` items
(`node .omni-loop/bin/omni.mjs status <prd>` lists them); mediums are never asked here: they are
already adopted, and whoever objects does so on the Omni page or on the pull request. Then ask
**one opening question** through `AskUserQuestion`: "<k> questions keep the outbox red." with three
choices:

| choice | then |
|---|---|
| **Answer here now** | answer them below, then carry on |
| **Answered on the Omni page or on the pull request — carry on** | carry on at once |
| **Later — stop here** | step 7, as without this part |

With ask mode on, this question and the ones below go to the ask page like any other.

**Answer here now.**

1. `node .omni-loop/bin/omni.mjs answers ask <prd> --pr <feature PR> --json`. Exit 1 says in one
   line that nothing is open to ask or the switch is off: print it and carry on. Exit 2: step 7,
   naming it.
2. For each of its `batches`, one `AskUserQuestion` call holding the batch's questions in the order
   given: each question's `header`, its `text` (with its `steps`, for a human action) as the
   question, and its `options` as the choices, label and text. Keep one pick per question,
   `{ "number": <its number>, "pick": <the chosen option's pick> }`. `Other` is the person's own
   words: words that start with an option's letter, or with `not done`, are that pick with the rest
   as its `reason`; any other words are `{ "number": <n>, "pick": "prose", "text": <the words> }`.
   `Not done` needs a reason: when it came without one, ask for it once more.
3. Write the picks as one JSON array to a scratch file (never in the repository), then:

   ```bash
   node .omni-loop/bin/omni.mjs answers post --prd <prd> --pr <feature PR> --answers <file>
   ```

   - Exit 0 prints the reply's link: keep it for the hand-off, and carry on.
   - Exit 1 with `refused` names the pick the reply writer refused; nothing was posted. Ask that
     question again, and rerun.
   - Exit 1 because the post failed: the reply is printed. Where the session has no `gh`, rerun with
     `--print` and post its output as one comment on the feature PR with the session's own GitHub
     tools, as the person, then carry on. Otherwise print the reply for the person to paste on the
     feature PR and go to step 7: the gate stays red.

**Carry on.** Follow `/omni:yolo-fix` steps 2 to 7 in this same run, on this feature PR: adopt the
leftovers, read the replies and settle them, derive and run the reworks, close them, then finish,
gate and ship before ready. Its step 1 is this run's: the feature PR is this one; put
`labels.inProgress` back on it and rewrite its status comment as that step says. Its guardrails
bind these steps. When a reply was not enough, the next outbox round is posted, the gate stays red
and the feature PR stays draft, exactly as `/omni:yolo-fix` ends; the opening question is not asked
again. Then hand off as `/omni:yolo-fix` step 8 does, naming what was answered here and the reply's
link, instead of step 7.

## 7. Hand off

Report, in one block: the PRD's page beside its number, then the feature PR link and its state
(ready, draft with the gate red, or held); slices merged out of total, each held slice with its
reason; the checks that ran and did not; every open outbox item with its rank and file
(`omni status <prd>` lists them); and, when step 6 asked the opening question, the choice made.

The PRD's page comes first on every ending, green, red or held. Run
`node .omni-loop/bin/omni.mjs dossier link <n>`: exit `0` prints the page's link on one line, so
print `PRD <n>: <link>`. Anything else (`none`, `off`, `no sign-in (omni signin)`, `unreachable`,
`refused (<status>)`, or exit `2` from a kit without the verb) means it has no page to show: print
`PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>` instead. It never stops the
hand-off.

Then always end the reply with three blocks, in this order, written for someone who knows nothing
about the loop and just does what it says, one step at a time. Fill every placeholder with a real
path, number or link: `<n>` is the PRD number, and the folder is read from
`node .omni-loop/bin/omni.mjs prd <n>` run on the feature branch as this run leaves it (refresh the
checkout first, as step 1's items 1–2 do).

**1. The PRD's folder,** in a code block so the tree lines up: its path, `<dir>/` (the `dir` that
`omni prd <n>` prints), then each file that command lists, with a few words each. `release.md`
appears only when it is listed. When the PRD shipped, its outbox sits inside the folder, as
`outbox/`:

```text
PRD <n>'s folder: on the feature PR now, on <repo.defaultBranch> once it merges

  <dir>/
  ├── spec.md            what changes, and why
  ├── plan.md            how it is built, slice by slice
  ├── before-after.html  today beside after
  ├── release.md         what ships, in plain words
  └── outbox/            every decision the agents took, and how each was settled
```

When it did not ship, the folder is still in the inbox, with no `outbox/` line, and its outbox is a
folder of its own: `<outbox>/`, the `outbox` path `omni prd <n>` prints. When that folder exists on
the branch, a second tree follows, with one line per open item file and `settled.md` when it is
there:

```text
  <outbox>/
  ├── s1-02-….md         open: a question waiting for you
  └── settled.md         the decisions already settled
```

**2. Where it is,** in a code block: the seven stages of the loop on one line, a marker under
where the PRD is and one under shipped, then the brainstorm's seven stage lines, word for word.
On the green ending the feature PR is ready, so "you are here" goes under outbox:

```text
Where it is

  idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro
                                             ▲          ▲
                                             │          └─ merging the feature PR moves it here
                                             └─ you are here

  idea      talked through, nothing written
  PRD       spec, plan and before/after written, in the phase-0 PR
  inbox     phase-0 PR merged: approved, ready to build
  building  a first sub-PR merged: the agents build it in waves
  outbox    feature PR ready: what the agents decided alone waits for you
  shipped   feature PR merged: the change is on <repo.defaultBranch>
  retro     a retro PR tells how the delivery went
```

On the red and the held endings the feature PR is still a draft, so "you are here" goes under
building instead, and the rest of the block is the same:

```text
  idea ──▶ PRD ──▶ inbox ──▶ building ──▶ outbox ──▶ shipped ──▶ retro
                                 ▲                      ▲
                                 │                      └─ merging the feature PR moves it here
                                 └─ you are here
```

"merging the feature PR moves it here" is always under shipped, because whatever the gate read, the
feature PR is not merged. For a ◆ PRD (`birthplace: server`), the PRD and inbox lines are the
brainstorm's ◆ ones: `PRD       spec, plan and before/after written, on its PRD page, waiting for
approval` and `inbox     approved on its PRD page: ready to build`.

A run stopped at step 1's approval gate, or held by its wait, builds nothing and ends on that line
alone, with no blocks. A wait that ended approved is no ending: the run went on into wave 1.

**3. What is next?** One of three, by how the run ended: three short numbered steps, then the
ending's last line.

**Green:** the gate was green, `omni ship` is committed and the feature PR is ready.

```markdown
**What is next?**

1. Review the change: https://github.com/<owner>/<repo>/pull/<feature PR>
   (the diff, and the outbox comment listing every decision the agents took)
2. Merge that PR. → PRD <n> is shipped: the change is on <repo.defaultBranch>.
3. If the omni-loop app is installed, it then opens a retro PR (how the delivery went)
   and a knowledge PR (the decisions, written back): review and merge each.

Merging #<feature PR> is yours. Until then, to keep it green, conflict-free and its review
comments handled while you do other things, type /clear (or open a new terminal), then run:

/omni:pr-care <n>
```

When `/omni:pr`'s lifecycle left the ready feature PR's CI stuck, the line in brackets under step 1
names the red check instead: `(its CI is red: <check>; it must be green before you merge)`.

**Red:** every slice merged, the gate red, the feature PR still a draft, the outbox comment posted.

```markdown
**What is next?**

1. Read the questions: https://github.com/<owner>/<repo>/pull/<feature PR>#issuecomment-<id>
2. Answer each one in a comment on that PR, as the questions explain: `2: A`,
   `2: B because …`, or `go with recommendation` for all of them. Nothing changes until step 3.
3. Once you've answered, type /clear (or open a new terminal), then run:

/omni:yolo-fix <n>
```

`<id>` is the comment's id the `omni comment` line printed (`pull request comment #<id>`); when it
printed none, step 1 links the feature PR alone.

**Held:** a slice stuck, stopped, blocked or in flight, a wave's check red, or a finish or a ship
that stayed red.

```markdown
**What is next?**

1. See what holds it: https://github.com/<owner>/<repo>/pull/<the PR that holds it>
2. <the one thing a person must do: the human steps of the final status comment>
3. Once that's done, type /clear (or open a new terminal), then run:

/omni:yolo <n>
```

The PR that holds it is the stuck sub-PR when there is one, the feature PR otherwise.

The last line of the reply is always the ending's own, alone on it:
`/omni:pr-care <n>`, `/omni:yolo-fix <n>` or `/omni:yolo <n>`.
Everything the next session needs is in the repository and on GitHub, so clearing the session loses
nothing.

**Before step 2, no hand-off.** A run that stops before it picks up the feature PR (the config does
not read, the checkout is not clean, the PRD is in another state, `/omni:plan` needs clarification)
keeps its one line: nothing was built, so there is nothing to hand off.

## Guardrails

- **Never ask along the way.** A decision is an outbox item; nothing waits on a person until the
  end. The one question is step 6's last part, on a red gate with `answers.enabled` on, and mediums
  are never asked there.
- **Never merge into `repo.defaultBranch`.** Sub-PRs merge into the feature branch through
  `/omni:wave`; a person merges the feature PR.
- **Never add `labels.outboxGo`.** It is a person's override, not this skill's way out.
- **Never mark the feature PR ready while the gate is red**, and never before `omni ship` is
  committed and pushed.
- **Never mark a stacked feature PR ready while the PR of its base is open**, and never meet a base
  that was rewritten: stop with the line that names it.
- One PRD per run, no issues filed; slices live in the plan.
