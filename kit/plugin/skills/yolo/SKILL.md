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

## 1. Find the PRD, the plan and the feature PR

1. `git fetch <remote>`, then
   `gh pr list --head <feature branch> --base <repo.defaultBranch> --state open --json number,isDraft,labels`.
2. The plan and the PRD's outbox live on the feature branch, so read them there: when the branch
   exists, `git switch --detach <remote>/<feature branch>`. First the checkout must be clean: no
   tracked changes (`git status --porcelain --untracked-files=no` prints nothing). Otherwise stop in
   one line naming it; never stash, clean or reset. **Do this again before every board read**: each
   wave moves the feature branch. The run leaves the checkout detached; say so in the report.
3. `node .omni-loop/bin/omni.mjs prd <n>`. A `repos:` line stops the run (Step 0, **A PRD that
   spans repositories**). It must be in state `inbox`. `shipped`, with the feature
   PR still a draft, means a previous run shipped and stopped before ready: go to step 5, green path,
   item 4. Anything else: stop and say where it is.
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
     (`git diff <remote>/<repo.defaultBranch>...HEAD`), never from the plan: a slice that was not
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
4. Only now, `gh pr ready <feature PR>`. **This is the only place in this skill a feature PR is
   marked ready**; `/omni:yolo-fix` follows this same green path after its own ship. CI runs on it
   once: follow `/omni:pr`'s lifecycle for the feature PR until its checks are green or it is stuck.

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
feature PR is not merged.

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
- One PRD per run, no issues filed; slices live in the plan.
