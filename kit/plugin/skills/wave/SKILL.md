---
name: wave
description: Build ONE wave of a PRD in parallel — read the board, claim every takeable slice, dispatch one worktree subagent per slice following /omni:do-work --in-wave, then merge their sub-PRs into the feature branch one at a time, check the wave together, adopt its medium decisions and report. Followed by /omni:yolo for each wave; a person may run it on a PRD. Never merges into the default branch. Triggers on "run the next wave", "build wave 3", "/omni:wave".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-parallel-wave/SKILL.md (and the board and wave-loop parts of vertuo-deliver) — changes in kit/porting/plugin--wave.md -->

# Wave: the takeable slices, in parallel, merged one at a time

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

Each slice is built by its own subagent in its own worktree and ends in its own sub-PR into the
feature branch. You, the orchestrator, only ever hold each slice's short result; that is what keeps
this conversation small. You merge; subagents never do.

**Flow points.** A repository may hook the loop at named points (the `flow` of its config). At the
point this skill names, run `node .omni-loop/bin/omni.mjs flow show <point> --prd <prd> --slice <id>`
and follow what it prints: every `before` hook, then the kit's step (or, when it prints
`kitStep: replaced`, the `replace` hook in its place), then every `after` hook. A hook is Markdown
to follow; an input it leaves as `{name}` is filled from this step. Following a hook ends on its
verdict line (`omni-hook <point>: pass`, or `omni-hook <point>: fail <why>`): write what it produced,
that line last, to a scratch file and run
`node .omni-loop/bin/omni.mjs flow verdict <point> --from <file>`. `ok` carries on; `not ok` stops the
point as a failing kit step would, and so does `flow show` exiting 1 (a hook file missing). A
`replace` swaps the act, never the guard: signing, labels, link lines, the base check (never into
the default branch), the territory check, the merge gate and `omni plan check` run whatever a hook
says. With no `flow`, `flow show` prints `hooks none` and `kitStep: run`: the step runs as written.

## Input

A PRD number. Re-running on the same PRD picks up where the last run stopped: the board is rebuilt
from GitHub every time, never remembered.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` below is `repo.remote`. The feature branch is `branches.feature` with `{topic}` filled by
the PRD folder's topic (`node .omni-loop/bin/omni.mjs board <prd> --json` prints it as `prd.topic`).

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

**A PRD that spans repositories.** Run `node .omni-loop/bin/omni.mjs prd <prd>`. When it prints a
`repos:` line, the PRD's plan lands slices in other repositories: stop with the one line
`PRD <prd> spans repositories: /omni:ultra-yolo <prd> builds it`, before any branch, claim or
dispatch.

Find the feature PR by its head, whatever its base (it may be stacked on another PR's branch, as
`/omni:pr` says): `gh pr list --head <feature branch> --state open --json number,body,baseRefName`.
No feature branch or no feature PR: stop, and say to follow `/omni:plan` first.

**A PRD of several landings.** When `node .omni-loop/bin/omni.mjs board <prd> --json` carries a
`landings` array, the wave builds the **current landing** only, the one its `currentLanding` names:
the lowest-numbered landing whose slices are not all merged. Throughout this skill, "the feature
branch" is that landing's `branch`, and "the feature PR" is that landing's PR (its `pr.number`; find
it with `gh pr list --head <landing branch> --state open --json number,body`, whatever its base).
The board's frontier already holds that landing's slices and no other: a slice of a later landing
is never claimed early, even when it reads `runnable`. `currentLanding` null means every landing's
slices are merged: print the board and stop.

## 1. The board

```bash
node .omni-loop/bin/omni.mjs board <prd>          # print it, once, before acting
node .omni-loop/bin/omni.mjs board <prd> --json   # what you act on
```

The wave is `frontier.takeable`: the ids of the lowest wave's `runnable` and `claimed-stale`
slices, with any same-wave territory collision already deferred by the kit (`frontier.excluded`).
Read each id's state, `title`, `territory` and `pr` from its row in `slices[]`. Take it as given;
do not re-derive blockers, staleness or collisions.

**Awaiting merge.** An `in-flight` row whose `pr` is not a draft (`pr.isDraft` false) and no longer
carries `labels.inProgress` is finished work a previous run never merged. Nobody is on it: it skips
steps 2 and 3 and joins step 4 as `done`. Every other `in-flight` slice is someone else's; leave it.

`takeable` empty and nothing awaiting merge: print the board and stop.

## 2. Claim every slice first

Before any subagent starts, `git fetch <remote>`, then, for each takeable slice, in board order:

- **`runnable`:** follow `/omni:pr`'s **Claim** mode with the slice id and its board `title`. It cuts
  the slice branch from the feature branch, makes the claim commit, pushes, opens the draft sub-PR
  and posts the `claimed` status comment.
- **`claimed-stale`:** its branch and draft sub-PR (the row's `pr.number`) already exist. Take it
  over: add `labels.inProgress` (subject to `/omni:pr`'s **Labels**) and rewrite its status comment,
  through `/omni:pr`'s marker recipe, with state `claimed` and the line "taken over from a stale
  claim".

Claim mode leaves your checkout on the last slice branch it cut, and git refuses to check a branch
out in a second worktree. Once every claim is made, run `git switch --detach`, so each subagent's
worktree can take its own slice branch.

## 3. Dispatch, one subagent per slice, in a single message

Launch every claimed slice concurrently (one message, several Agent calls), each with
`isolation: "worktree"`. Keep the prompt this small:

> Build slice `<id>` of PRD <prd>, on feature branch `<feature branch>`: follow `/omni:do-work
> --in-wave`. Its slice branch is already claimed. Do not spawn subagents. Return only do-work's
> result JSON: no diffs, no logs.

Nesting is at most three levels (`/omni:yolo` → this skill → do-work), so a slice subagent never
dispatches its own. Wait for every result. Each is
`{ slice, status: done | red | stopped | blocked, branch, prUrl, preflight, summary, risks, items }`.
A subagent that returns nothing usable counts as `red`, with "no result" as its summary.

## 4. Merge, one at a time

Run `node .omni-loop/bin/omni.mjs plan check <prd>` once. Red means a slice broke the plan; say so in
the report, and carry on.

Before the first merge, `git fetch <remote>` and keep `git rev-parse <remote>/<feature branch>`:
**the feature branch before the wave**, which step 5 rebuilds from.

Then take each `done` slice, and each slice awaiting merge, in board order. Each merge moves the feature branch, so read every
sub-PR afresh; never trust an earlier look.

1. **Base.** `gh pr view <n> --json baseRefName,isDraft,mergeable,labels`. The base must be the
   feature branch. Anything else: `gh pr edit <n> --base <feature branch>` (add `labels.sub` if it
   is missing), then read it again. **Never merge a PR whose base is `repo.defaultBranch`.**
2. **Territory.** `gh pr diff <n> --name-only`, against the slice's `territory` in the board JSON.
   A path is inside when it starts with a territory entry, or sits under the PRD's outbox dir
   (`node .omni-loop/bin/omni.mjs prd <prd>` prints it). A path under a generated entry's `path`
   (`node .omni-loop/bin/omni.mjs config generated`) is never a breach: step 5 rebuilds it. Any
   other path is a **breach**: name it in
   the report and merge anyway. It is never fatal; it says the plan was wrong about the ground,
   and it is the first thing to read when a later sub-PR conflicts.
3. **Mergeable.** `UNKNOWN`: look again in a minute. `CONFLICTING`: work in a detached worktree,
   never on the slice branch itself. Run `git fetch <remote>`, then `git worktree add --detach <path>
   <remote>/<slice branch>` (`<path>` under `worktrees`). In it, `git merge <remote>/<feature branch>`,
   resolve, run the preflight (`commands.preflightFull`, or `commands.preflight` when null),
   `git push <remote> HEAD:<slice branch>`, then `git worktree remove <path>`. Count one attempt. A conflict you cannot resolve
   with confidence goes to one fresh subagent, given both slices' intent.
4. **Ready.** Still a draft: follow `/omni:pr`'s **sub-PR lifecycle** for it; that skill owns
   `gh pr ready` and runs it once the preflight is green. It never becomes ready: do not merge it.
5. **Review threads.** A reviewer, a bot or a person, may have reviewed the sub-PR. Read them:
   `node .omni-loop/bin/omni.mjs care state <prd> --pr <n>`. Its `round` is the sub-PR's own (the
   JSON names its `slice`): the wave's claims, CI and the conflict never change it.

   | `round.mode` | what you do |
   |---|---|
   | `act` | carry out each `judge` and `mark-asked` action exactly as `/omni:pr-care`'s **3. Review threads** says (the `review` form's `fix`, `push-back` and `ask` lines, read once this run with `node .omni-loop/bin/omni.mjs kb show review`; every reply through `omni care reply`; one commit per fix, the preflight green), working in a detached worktree as item 3 does and pushing with `HEAD:<slice branch>`. Then read `care state` again, and act on its new round. |
   | `hold` | a thread was left asked (`round.held`): do not merge. The sub-PR is **held** (**Not merged**). |
   | `clear` | every thread is handled, or there is none: go on to the gate. |
   | `stop` | the sub-PR is no longer open: report it and take the next one. |

   A fix commit moved the slice branch, so a fix that conflicts goes back to item 3. Only the
   threads on GitHub when you read count: the wave waits for no review that has not been posted.
6. **Merge, through the gate.** First the gate, the repository's `rules.subPr` for the slice's
   areas (merge method, required checks, a person's approval, territory, open sub-PRs):

   ```bash
   node .omni-loop/bin/omni.mjs flow check merge --pr <n>
   ```

   - `ok`: its second line is the merge command. Each `report` line under it goes in the report.
   - `not ok`: do not merge. Each `not ok` line is a reason (`<area>: <rule> — <why>`); the sub-PR
     is left open as it is, with its reason, and the wave carries on (**Not merged**).

   Then **point `wave.merge`:** run
   `node .omni-loop/bin/omni.mjs flow show wave.merge --prd <prd> --slice <id>` and follow it
   (**Flow points**). The kit's step is the merge command the gate printed, run as printed, never
   one written from memory. A `replace` hook merges its own way, only after an `ok` gate, and its
   verdict carries the merged PR's number. A `not ok` from a hook leaves the sub-PR open, as a
   `not ok` gate does.

**A red slice** gets one look first. Read `omni kb show ci` once: which checks exist and gate, the
known reds, and when a re-run is allowed. When a `red` slice's failing step matches a known red
there, its diff changes nothing that red names, and the form allows a re-run, take it through
items 1 to 6 like a `done` slice: the preflight in item 4 is its one re-run, counted as an attempt.
Any other `red` slice is not merged.

**Not merged:**

| result | what you do |
|---|---|
| `red`, or `done` but never ready or still conflicting after `limits.attempts` attempts | stuck. Make sure it carries `labels.needsFix` in place of `labels.inProgress` and `/omni:pr`'s stuck comment. |
| `stopped` | leave the draft. Report the law or principles it named. Its siblings still merge. |
| `blocked` | leave the draft. Report its human-action item. |
| held: a review thread left asked (item 5) | leave it open, ready as it is. Report each asked thread's link and its one-line reason. A later run takes it as awaiting merge and reads its threads again. |
| `omni flow check merge` prints `not ok`, or a `wave.merge` hook does | leave it open, ready as it is. Report each reason. A later run takes it as awaiting merge and asks the gate again. |

For every slice not merged, you do this, not the subagent, which has already returned: remove
`labels.inProgress` and rewrite its status comment through `/omni:pr`'s marker recipe with state
`stuck` and the reason (the red step, the law or principles, the human-action item, or the asked
threads). A stuck slice keeps `labels.needsFix`. A stopped, blocked or held one, or one the merge
gate refused, waits for a person and gets no label.

A slice that is not merged holds only what depends on it; the rest of the wave goes on.

## 5. Check the wave together

Slices that each passed alone can fail together. Work in a detached worktree of the feature branch:
run `git fetch <remote>`, then `git worktree add --detach <path> <remote>/<feature branch>`.

1. **Adopt.** Under `--in-wave`, do-work leaves medium items open so parallel slices do not race on
   the ledger. For every item a merged slice returned with rank `medium`, run the command below. A slice that was
   awaiting merge returned nothing this run, so use the open medium item files for that slice
   listed by `node .omni-loop/bin/omni.mjs prd <prd>`. The command is
   `node .omni-loop/bin/omni.mjs adopt <file>`. Exit 1 (the ledger refused it): leave that item
   open and name the refusal in the report. Commit the ledger and the removed files together:
   `chore(delivery): wave <n> of PRD <prd> — adopt <k> medium decisions`, with your session's
   co-author trailer, then the `omni sign trailer` line. High items stay open for a person.
2. **Rebuild, then check.** The slices committed no generated file, so the wave rebuilds them once.
   Run `node .omni-loop/bin/omni.mjs generated <feature branch before the wave>..HEAD`: one line per
   generated entry, `<path>: stale|fresh — <build>`, or `no generated files`. Run the build of every
   `stale` line from the worktree's root. Then run the preflight, every command in
   `commands.checks`, then `node .omni-loop/bin/omni.mjs check all`. Red: fix it on the feature
   branch itself; each fix counts toward `limits.attempts`, and a fix that changes a generated
   entry's sources reruns its build. Still red after that: the wave is stuck; say which step. Green:
   commit the rebuilt paths alone, `git add -- <path>` for each `stale` line and nothing else, as
   `chore(build): rebuild generated files — wave <n> of PRD <prd>`, with your session's co-author
   trailer, then the `omni sign trailer` line. Nothing stale, or a build that changed nothing: no
   commit.
3. `git push <remote> HEAD:<feature branch>`, then `git worktree remove <path>`.
4. **The feature PR.** Tick each merged slice in its **Slices** checklist (`#<sub-PR> <title>`), in
   the body shape `/omni:pr` owns (`gh pr edit <feature PR> --body-file <file>`), which keeps its
   `omni sign footer` line. Rewrite its status
   comment through `/omni:pr`'s marker recipe: state `merging slices` (or `stuck`, naming the red
   step), `slices: <merged> / <total> merged`. Never mark the feature PR ready.

## 6. Report

The PRD's page beside its number, then one table, then the items still open. This is what
`/omni:yolo` reads.

The first line is the PRD's page. Run `node .omni-loop/bin/omni.mjs dossier link <n>`: exit `0`
prints the page's link on one line, so the line is `PRD <n>: <link>`. Anything else (`none`, `off`,
`no sign-in (omni signin)`, `unreachable`, `refused (<status>)`, or exit `2` from a kit without the
verb) means it has no page to show: the line is
`PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>`. It never stops the report.

| slice | sub-PR | outcome | territory | items | summary | risks |
|---|---|---|---|---|---|---|
| s1 | #12 | merged | inside | — | … | … |
| s6 | #13 | merged | breach: `<path>` | `s6-01-…` (medium, adopted) | … | … |
| s7 | #14 | stopped: `<law>` | — | — | … | … |
| s8 | #15 | stuck (`labels.needsFix`) | — | — | … | … |

Below it: the wave's check (green, or the red step), the checks that ran and did not, the high items
left open, and the slices the board still holds (`blocked` or `in-flight`). A breach or an item
sits beside a merged slice, never instead of it.

## Guardrails

- Merge only into the feature branch (the current landing's branch, for a PRD of several
  landings), never into `repo.defaultBranch`, and never a landing PR. Check the base before every
  merge.
- Merge only with the command `omni flow check merge` prints, after its `ok`, or through a
  `wave.merge` `replace` hook after that same `ok`. Never a merge command written by hand.
- Subagents never merge. One slice per worktree, branch and sub-PR.
- Claim before you dispatch; take the board's frontier as it is.
- A question never takes the wave down: only `stopped`, `blocked` and a review thread left asked hold
  a slice, and only that one.
- Never merge a sub-PR before its review threads are read (step 4 item 5), and never one whose
  `care state` round is `act` or `hold`.
- A territory breach is reported, never fatal.
- Never mark a sub-PR ready yourself (`/omni:pr` does), and never a feature PR at all.
