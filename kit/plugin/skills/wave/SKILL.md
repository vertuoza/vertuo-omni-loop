---
name: wave
description: Build ONE wave of a PRD in parallel — read the board, claim every takeable slice, start one agent per slice, each in its own worktree, following /omni:do-work --in-wave, then merge their sub-PRs into the feature branch one at a time, check the wave together, adopt its medium decisions and report. A PRD whose plan has fewer slices than wave.inlineBelow is built inline instead, one slice after the other and committed on the feature branch itself, with no claim and no sub-PR. Followed by /omni:yolo for each wave; a person may run it on a PRD. Never merges into the default branch. Triggers on "run the next wave", "build wave 3", "/omni:wave".
---

<!-- Ported from nimbus-brain@c4a210122:.claude/skills/nimbus-parallel-wave/SKILL.md (and the board and wave-loop parts of nimbus-deliver) — changes in kit/porting/plugin--wave.md -->

# Wave: the takeable slices, in parallel, merged one at a time

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. Every pull request or issue it
opens ends its body with the line `omni sign footer` prints, as a paragraph of its own just above
your session's own attribution lines, and a body it rewrites keeps that line. Comments are never
signed. A command that prints nothing means signing is off here: add nothing.

Each slice is built by its own agent in its own worktree and ends in its own sub-PR into the
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

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

**A PRD that spans repositories.** Run `node .omni-loop/bin/omni.mjs prd <prd>`. When it prints a
`repos:` line, the PRD's plan lands slices in other repositories: stop with the one line
`PRD <prd> spans repositories: /omni:ultra-yolo <prd> builds it`, before any branch, claim or
dispatch.

**A PRD born on the server.** The same `omni prd <prd>` always exits 0: gate on its `state:` line,
never on the exit code. When it prints `birthplace: server` (a ◆ PRD, approved on its page rather
than by a phase-0 PR), its `state:` must be `inbox`. Otherwise stop, before any claim or dispatch,
with the line its state gives, as printed after `approval: `:

| `state:` | the line the wave stops on |
|---|---|
| `prd` | `PRD <prd> waits for approval: <link>`: a member approves it on its page first |
| `drifted` | each `≠ <file> · content` (or `· whitespace only`) `· ✗ refuse · restore it, or approve again: <link>` |
| `unreachable` | `server unreachable · held, not failed`: held, not failed; run the wave again once the server answers |
| `refused` | `approver <login> is not a workspace member`, or `refused (<status>)` |

A ◇ PRD (no `birthplace:` line) never reads any of the four, and the wave runs as written.

**A read the loop cannot make.** `omni board` and `omni flow check merge` read the loop's state
through the Omni page (`ask.url`), never through `gh`. When one cannot read, it exits `1` with one
line alone on stderr:

| line | what holds |
|---|---|
| `no sign-in (omni signin)` | every read: a person signs in on this machine, or sets `OMNI_TOKEN` |
| `unreachable` | every read: the Omni page did not answer within 15 seconds |
| `refused (403): <owner/repo> is not in your workspace` | that repository: it is not in the person's workspace |
| `refused (424): the Omni app cannot read <owner/repo>: <install link>` | that repository: the Omni app is not installed on it |
| `refused (429): GitHub's budget for <owner/repo> is spent until <time>` | that repository, until that time |
| `refused (404): this Omni page cannot read the loop yet` | every read: the Omni page does not serve the loop |

Each is **held, not failed**, as an unreachable approval is. Before any claim, stop with
`<the line> · held, not failed: run the wave again once it reads`, and claim nothing. Later in the
wave (the merge gate, a board read after a merge), merge nothing more, leave every sub-PR as it is,
and end the wave on that line: no slice is marked failed or stuck for it, no attempt is spent, and
nothing is read through `gh` instead. The next wave reads again.

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

**Behind the default branch.** When the board's `base.behind` is `true`, the feature branch (or the
current landing's branch, the one `base.branch` names) does not carry what the default branch
merged since it was cut: most often the phase-0 PR, reviewed after the plan was written, whose spec
and plan are the approved ones. Never claim or dispatch on it: first follow `/omni:yolo`'s **Meet
the default branch** (its step 1) — merge `base.onto` into it in a detached worktree, the PRD's
folder taking the default branch's side, any other conflict the **Stuck** path — then read the
board again, from a checkout refreshed onto the pushed branch, and act on that board. `base` `null`
(the current landing is stacked on the one before) or `behind` `false` or `null`: carry on.

`takeable` empty and nothing awaiting merge: print the board and stop.

**An inline wave.** The board's `inline` (`omni board <prd> --json`) is `true` when
`node .omni-loop/bin/omni.mjs config wave.inlineBelow` is set (above `0`) and the plan has fewer
slices than it, the current landing's for a PRD of several landings. Then this wave is **inline**:
skip steps 2, 3 and 4, follow **Inline wave** below, then steps 5 and 6. `inline` `false` (or
`wave.inlineBelow` at its default `0`): every step runs as written, and **Inline wave** does not
apply.

## Inline wave

A plan this small has its feature PR for the record of every slice, so no slice is claimed, none
opens a sub-PR, and nobody merges one. Each slice is built by `/omni:do-work --inline` on the feature
branch itself and ends in commits there. `omni board` reads a slice as merged once a commit on the
feature branch carries its `Omni-Slice: <id>` trailer line, so a later wave never builds it twice.
The territory, the outbox items and their accounts, the wave's check (step 5) and the feature PR
as the one pull request into the default branch all stay.

Before the first slice, `git fetch <remote>` and keep `git rev-parse <remote>/<feature branch>`:
**the feature branch before the wave**, which step 5 rebuilds from.

Take `frontier.takeable` **one slice at a time**, in board order: slices share one branch, so they
never run side by side. Each takes the next from the feature branch as the last one left it.

1. **Dispatch** one agent, in its own worktree (in Claude: an Agent call with
   `isolation: "worktree"`). Keep the prompt this small:

   > Build slice `<id>` of PRD <prd>, inline on feature branch `<feature branch>`: follow
   > `/omni:do-work --inline`. Do not spawn subagents. Run each command alone, from your worktree,
   > never chained with `cd … &&` or `;`, and git as `git -C <your worktree> …`. Return only
   > do-work's result JSON: no diffs, no logs.

   The inline path stays on the terminal's model: start the agent with no model and no effort, and
   resolve no tier; do-work stamps `inherited (inline)`. Nesting is at most three levels, as in
   step 3, so the subagent never dispatches its own. Its result is the shape step 3 names, with `branch` the feature branch and `prUrl` `null`. A subagent
   that returns nothing usable counts as `red`, with "no result" as its summary.
2. **Territory.** `git fetch <remote>`, then
   `git diff --name-only <the feature branch before the slice>..<remote>/<feature branch>` against
   the slice's `territory`, as step 4 item 2 reads it (the outbox dir and a generated entry's `path`
   are never a breach). A path outside is a **breach**: name it in the report and carry on, never
   fatal.
3. **The result.** `done`: the slice is built; run `node .omni-loop/bin/omni.mjs worktrees remove <worktree>`
   (its detached worktree, by the path its agent call returned), put its line in the report, and go on to the next. `red`, `stopped` or `blocked`: it
   is **not built**, and its commits carry no `Omni-Slice` line, so the board still holds it. Report
   what it names (the red step, the law or principles, the human-action item); the feature PR's
   status comment (step 5 item 4) says `stuck` and names it; the slices that wait on it stay
   blocked, and its siblings still run.

A slice does not wait for the board to catch up: after every `done`, `omni board <prd> --json`
shows it `merged` and frees what depended on it. Run `omni plan check <prd>` once, after the last
slice (as step 4 does before its merges); red means a slice broke the plan: say so in the report
and carry on.

## 2. Claim every slice first

Before any subagent starts, `git fetch <remote>`, then, for each takeable slice, in board order:

- **`runnable`:** follow `/omni:pr`'s **Claim** mode with the slice id and its board `title`. It cuts
  the slice branch from the feature branch, makes the claim commit, pushes, opens the draft sub-PR
  and posts the `claimed` status comment.
- **`claimed-stale`:** its branch and draft sub-PR (the row's `pr.number`) already exist, holding
  work nobody is on: a runner job that died released it (it carries the released label,
  `omni:released` unless `labels.released` sets another), it sat quiet past
  `limits.claimDeadMinutes`, or it holds nothing beyond its claim. Before taking it over, ask
  whether that work is still this slice's:

  ```bash
  node .omni-loop/bin/omni.mjs claim check <prd> <slice>
  ```

  - **`reuse`** (exit 0): the plan row and the territory still match. Take the branch over: add
    `labels.inProgress` and remove the released label (subject to `/omni:pr`'s **Labels**), and
    rewrite its status comment, through `/omni:pr`'s marker recipe, with state `claimed` and the
    line "taken over from job `<id>`", the job its old status comment's `job:` line named, or
    "taken over from a quiet claim" when it named none. Its dispatch (step 3) says the branch is
    reused, so its subagent re-verifies it before building.
  - **`rebuild: <reason>`** (exit 1): the work is not this slice's any more. Close the sub-PR
    unmerged with the comment `Closed to rebuild: <the rebuild line>`
    (`gh pr close <n> --comment "…"`), delete its remote branch
    (`git push <remote> --delete <slice branch>`, and the local branch when there is one), then
    claim the slice afresh, as a `runnable` one, through `/omni:pr`'s **Claim** mode. Its subagent
    builds from that fresh claim like any other.
  - **Exit 2** (the feature branch could not be read): `git fetch <remote>` and run it once more.
    Still 2: leave the slice unclaimed this wave and name it in the report.

Claim mode leaves your checkout on the last slice branch it cut, and git refuses to check a branch
out in a second worktree. Once every claim is made, run `git switch --detach`, so each subagent's
worktree can take its own slice branch.

## 3. Dispatch, one agent per slice, all at once

**The tier.** Before any launch, resolve each claimed slice's model, once per wave: the config as it
reads now holds for the whole wave, and a change to it takes effect at the next one. For each slice,
read its `tier` from its board row and run, `<agent>` being your own agent as `agents` names it (in
Claude: `claude`):

```bash
node .omni-loop/bin/omni.mjs tier <tier> --agent <agent>
```

It prints `model: <model>` and `effort: <effort>` (each line only when set), or `inherit`, and exits
0. A `tier` of `null`, `inherit`, or an exit 2 (an agent or tier it does not know): the slice
**inherits**, and its agent is started with no model and no effort, exactly as without tiers. Its
`Tier:` line, the one do-work stamps on its sub-PR, is
`Tier: <tier> · <agent> <model> · <effort>` (the effort part only when set), or
`Tier: <tier> · inherited (no mapping)` (`inherited (no advice)`, `<tier>` being `—`, when the plan
advises none).

Start one agent per claimed slice, each in its own worktree, all at once (in Claude: one message
with several Agent calls, each `isolation: "worktree"`, in the background, each with the `model`
and `effort` its tier resolved to, or neither when it inherits). Keep the prompt this small:

> Build slice `<id>` of PRD <prd>, on feature branch `<feature branch>`: follow `/omni:do-work
> --in-wave`. Its slice branch is already claimed. `<its Tier: line>`. Do not spawn subagents.
> Run each command alone, from your worktree, never chained with `cd … &&` or `;`, and git as
> `git -C <your worktree> …`. Return only do-work's result JSON: no diffs, no logs.

A slice taken over on `reuse` (step 2) adds one sentence after the claim's: "Its branch is reused:
re-verify it before building."

**One command at a time.** An agent started in its own worktree may refuse a command it cannot
prove stays inside that worktree (in Claude: a `cd … && …` chain that runs git), and the slice
loses a turn on each refusal. So every prompt that starts one, here, in **Inline wave** and in
`/omni:yolo-fix`, says to run each command alone and git as `git -C <its worktree>`.

**A refused launch.** The agent refuses to start a slice on its model (it does not know the model,
or cannot set one per subagent): start that slice again, once, on the terminal's model (no model,
no effort), its `Tier:` line now `Tier: <tier> · inherited (<agent> refused <model>)`. It is never a
red slice, never an attempt and never a question. An agent that cannot set a model per subagent at
all starts every slice that way, and the briefing's **Any agent** says so.

Nesting is at most three levels (`/omni:yolo` → this skill → do-work), so a slice subagent never
dispatches its own. Wait for every result. Each is `{ slice, status: done | red | stopped | blocked,
branch, prUrl, preflight, summary, risks, items, tier }`.
A subagent that returns nothing usable counts as `red`, with "no result" as its summary. Its `tier`
is what do-work reports; a result without one takes the `Tier:` line its prompt carried.

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

7. **Remove its worktree.** Once the sub-PR is merged, run
   `node .omni-loop/bin/omni.mjs worktrees remove <worktree>`, `<worktree>` being the path its agent
   call returned. It keeps a worktree that is uncommitted, unpushed or in use, and exits 0 either way:
   the `removed <path> · <size>` or `kept <path> · <reason>` line it prints goes in the wave's report
   (step 6), and a kept worktree is never forced.

**A red slice** gets one look first. Read `omni kb show ci` once: which checks exist and gate, the
known reds, and when a re-run is allowed. When a `red` slice's failing step matches a known red
there, its diff changes nothing that red names, and the form allows a re-run, take it through
items 1 to 7 like a `done` slice: the preflight in item 4 is its one re-run, counted as an attempt.
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

1. **Adopt.** Under `--in-wave` (and `--inline`), do-work leaves medium items open so the slices do
   not race on the ledger. For every item a merged (or, inline, built) slice returned with rank
   `medium`, run the command below. A slice that was awaiting merge returned nothing this run, so
   use the open medium item files for that slice
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
4. **The feature PR.** Tick each merged slice in its **Slices** checklist (`#<sub-PR> <title>`; an
   inline slice, `<title> — built inline`, its commit's short sha after it), in
   the body shape `/omni:pr` owns (`gh pr edit <feature PR> --body-file <file>`), which keeps its
   `omni sign footer` line. Rewrite its status
   comment through `/omni:pr`'s marker recipe: state `merging slices` (or `stuck`, naming the red
   step, or the inline slice that is not built), `slices: <merged> / <total> merged`. Never mark the
   feature PR ready.

## 6. Report

The PRD's page beside its number, then one table, then the items still open. This is what
`/omni:yolo` reads.

The first line is the PRD's page. Run `node .omni-loop/bin/omni.mjs dossier link <n>`: exit `0`
prints the page's link on one line, so the line is `PRD <n>: <link>`. Anything else (`none`, `off`,
`no sign-in (omni signin)`, `unreachable`, `refused (<status>)`, or exit `2` from a kit without the
verb) means it has no page to show: the line is
`PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>`. It never stops the report.

| slice | sub-PR | outcome | tier | territory | items | summary | risks |
|---|---|---|---|---|---|---|---|
| s1 | #12 | merged, green first try | build · sonnet | inside | — | … | … |
| s6 | #13 | merged, 2 attempts | light · haiku | breach: `<path>` | `s6-01-…` (medium, adopted) | … | … |
| s7 | #14 | stopped: `<law>` | deep · inherited (no mapping) | — | — | … | … |
| s8 | #15 | stuck (`labels.needsFix`) | light · inherited (claude refused haiku) | — | — | … | … |

The outcome says whether a merged slice went green on its first try or after how many attempts;
the tier column is each slice's tier and the model it ran on, from its `tier`.

Each merged slice's report line carries what `omni worktrees remove` printed for its worktree,
`removed <path> · <size>` or `kept <path> · <reason>`.

An inline wave has no sub-PR: its column reads `inline`, its outcome `built` (or, for a slice not
built, `red`, `stopped` or `blocked`, with what it named).

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
- Inline only when the board says `inline`: never claim, open a sub-PR or build side by side then,
  and never inline a PRD that already has a sub-PR (the board says `inline` `false` for it).
- Never claim on a branch behind the default branch (the board's `base.behind` `true`): meet it
  first, then read the board again.
- A question never takes the wave down: only `stopped`, `blocked` and a review thread left asked hold
  a slice, and only that one.
- Never merge a sub-PR before its review threads are read (step 4 item 5), and never one whose
  `care state` round is `act` or `hold`.
- A territory breach is reported, never fatal.
- Never mark a sub-PR ready yourself (`/omni:pr` does), and never a feature PR at all.
