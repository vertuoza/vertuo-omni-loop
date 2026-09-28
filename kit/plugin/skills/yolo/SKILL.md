---
name: yolo
description: Build a whole PRD with nothing asked along the way — plan it if needed, run /omni:wave until every slice is merged or nothing more can move, then finish the feature branch, run the outbox gate, and ship before ready. Green gate — omni ship, commit, push, then the feature PR is marked ready. Red gate — the feature PR stays draft with the outbox questions posted on it. Never merges into the default branch. Triggers on "yolo this PRD", "build it, I'll review the outbox after", "/omni:yolo".
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
2. `node .omni-loop/bin/omni.mjs ship <prd>`. It stages the move and prints what moved.
   - Exit 1 names each reason it refused (with the switch on, a missing or failing release note is
     one): the feature PR stays draft; name them in step 6 as `stuck`.
   - Exit 2 means the delivery folder holds uncommitted changes. Commit them if they are this run's
     own (the body file never lives there), then rerun once; otherwise stop, as for exit 1.
3. Commit the move as `chore(delivery): ship PRD <prd>`, with your session's co-author trailer, then
   the `omni sign trailer` line, and `git push <remote> HEAD:<feature branch>`.
4. Only now, `gh pr ready <feature PR>`. **This is the only place in this skill a feature PR is
   marked ready**; `/omni:yolo-fix` follows this same green path after its own ship. CI runs on it
   once: follow `/omni:pr`'s lifecycle for the feature PR until its checks are green or it is stuck.

The **omni-loop** GitHub App, when installed on the repository, posts this same gate on the feature
PR as the check named `ci.outboxContext`; this skill never posts it and never waits on it.

**Gate red.** Leave the feature PR in **draft**; do not ship. The comment above holds every open
question in plain words, each under a number.

Then `git worktree remove <path>`.

## 6. Release

Remove `labels.inProgress` from the feature PR (unless the Stuck path already swapped it for
`labels.needsFix`), and write its final status comment through `/omni:pr`'s marker recipe, with
`slices: <merged> / <total> merged` and one of `/omni:pr`'s states:

- `done`: shipped and ready, or every slice merged with the gate red. For the red gate, the
  `human steps` line says "answer the outbox questions on this PR, then `/omni:yolo-fix <prd>`".
- `stuck`: held (a stuck, stopped, blocked or in-flight slice, a red wave check) or a stuck finish,
  with the reason; `human steps` names what a person must do.

## 7. Hand off

Report, in one block: the PRD's page beside its number, then the feature PR link and its state
(ready, draft with the gate red, or held); slices merged out of total, each held slice with its
reason; the checks that ran and did not; and every open outbox item with its rank and file
(`omni status <prd>` lists them).

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

**2. Where it is,** in a code block: the six stages of the loop on one line, a marker under outbox
and one under shipped, then the brainstorm's six stage lines, word for word.

```text
Where it is

  idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro
                               ▲           ▲
                               │           └─ merging the feature PR moves it here
                               └─ you are here

  idea     talked through, nothing written
  PRD      spec, plan and before/after written, in the phase-0 PR
  inbox    phase-0 PR merged: approved, ready to build
  outbox   being built: what the agents decided alone waits for you
  shipped  feature PR merged: the change is on <repo.defaultBranch>
  retro    a retro PR tells how the delivery went
```

The markers are the same on every ending: "you are here" is always under outbox, and
"merging the feature PR moves it here" always under shipped, because whatever the gate read, the
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

Nothing to run: merging #<feature PR> is yours.
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
`Nothing to run: merging #<feature PR> is yours.`, `/omni:yolo-fix <n>` or `/omni:yolo <n>`.
Everything the next session needs is in the repository and on GitHub, so clearing the session loses
nothing.

**Before step 2, no hand-off.** A run that stops before it picks up the feature PR (the config does
not read, the checkout is not clean, the PRD is in another state, `/omni:plan` needs clarification)
keeps its one line: nothing was built, so there is nothing to hand off.

## Guardrails

- **Never ask.** A decision is an outbox item; nothing here waits on a person.
- **Never merge into `repo.defaultBranch`.** Sub-PRs merge into the feature branch through
  `/omni:wave`; a person merges the feature PR.
- **Never add `labels.outboxGo`.** It is a person's override, not this skill's way out.
- **Never mark the feature PR ready while the gate is red**, and never before `omni ship` is
  committed and pushed.
- One PRD per run, no issues filed; slices live in the plan.
