---
name: yolo-fix
description: Bring a PRD back in line with what a person answered — read the replies on the feature PR, settle them in one sub-PR, rework every drifted decision as its own slice (one sub-PR each into the feature branch, inside the bound the item stated), check the whole feature, then ship before ready when the gate is green. Raises no question of its own and never merges into the default branch. Triggers on "yolo-fix this PRD", "fix the drift", "rework what I disagreed with", "/omni:yolo-fix".
---

<!-- Ported from vertuo-ai-domain@2af3d72f7:.claude/skills/vertuo-yolo-fix/SKILL.md — changes in kit/porting/plugin--yolo-fix.md -->

# Yolo fix: replies, settle, rework, ship

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

A settled item whose answer **contradicts the choice the agent recorded** is **drifted**: the build
and the decision disagree, and no check can see it. This skill is what closes that gap.

It **reworks; it does not re-decide.** Every question it acts on has already been answered by a
person. It raises no item of its own, asks nothing, and merges nothing into the default branch.
With nothing answered, nothing drifted and nothing unclear, it says so and opens nothing at all.

## Input

A PRD number, whose feature PR carries replies to its outbox comment, or whose ledger (`settled.md`
in the outbox dir `omni prd` prints) holds drifted entries. Re-running is safe: a reply already
settled is not read again, and an item a rework already closed is not drifted work a second time.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` below is `repo.remote`, and `<feature branch>` is `branches.feature` with `{topic}`
filled by the PRD folder's topic (the folder `omni prd` names is `<n>-<topic>`).

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

## 1. Find the feature PR

`git fetch <remote>`, then
`gh pr list --head <feature branch> --state open --json number,isDraft,labels,baseRefName`: the
feature PR is found by its head, whatever its base. A base other than `repo.defaultBranch` is a
stacked feature PR, read as `/omni:yolo` reads one.

The ledger and the plan live on the feature branch, so read them there. Every step below that edits
works in a detached worktree (`git worktree add --detach <path> <remote>/<feature branch>`, `<path>`
under `worktrees`), because git refuses a branch another worktree holds. Refresh it (`git fetch`,
then a fresh worktree) after every merge: each one moves the feature branch.

**After the feature PR has merged.** An objection can arrive once the feature is already on
`repo.defaultBranch`: the outbox comment stays on the merged PR and still takes replies. Find it
with `--state merged`; the ledger now lives on the default branch. With the feature branch gone, cut
it afresh from `<remote>/<repo.defaultBranch>`, push it, and open a new draft feature PR from it
through `/omni:pr` (the feature kind), its body ending with the `omni sign footer` line. Read replies from the merged PR (step 3), and settle and
rework into the new branch exactly as below. Nothing is ever committed to the default branch
directly; a person merges the new feature PR.

No feature PR, open or merged: stop, and say to run `/omni:yolo <prd>` first.

Add `labels.inProgress` to the feature PR (subject to `/omni:pr`'s **Labels**) and rewrite its
status comment through `/omni:pr`'s marker recipe with state `merging slices` and the line "settling
replies and reworking drift".

## 2. Adopt what's left, first

In the worktree, `node .omni-loop/bin/omni.mjs prd <prd>` lists the open items. For each one whose
front matter says `rank: medium` (a leftover a wave never adopted), run
`node .omni-loop/bin/omni.mjs adopt <file>`. Exit 1: leave it open and name the refusal in the
report. This lands in the settle sub-PR below, or, when step 3 settles nothing, is that sub-PR on
its own (`chore(delivery): adopt <k> leftover medium decisions`).

## 3. Read the replies and settle them

```bash
node .omni-loop/bin/omni.mjs replies --prd <prd> --pr <feature PR> --post
```

It reads the PR's comments, keeps the writers' replies, and settles each open question a numbered
line or `approve all` answers: it appends to the ledger and deletes the item files it settled. The
reply grammar and its precedence live there; never re-implement them in prose. `--post` posts the
next **Outbox round** comment when an answer came back undetermined. Exit 1 names replies it could
not settle: they stay open, and the round asks again.

Option A is always the one built. `2: A` or `approve all` settle **agreed**; any other letter the
question offers (`2: B because …`) settles **drifted**, recording that option's text and the reason.
An objection to an adopted item is read the same way and appends a `drifted` entry for its id; the
ledger only grows, and the latest entry wins.

**Write back what was just settled.** For every entry this run added as `agreed` or `drifted`
(never one adopted before this run: nobody answered it), read the answer. When `laws.source` is
`knowledge` and it states something true about the product, write or amend the entry under
`paths.knowledge` (an amended entry keeps its id; `omni knowledge <id>` explains one), or an ADR under
`paths.adr` when it is about how the repository builds, written as `omni kb show decisions` says
(where records live, their format, the next free number). When it is a lesson about how to work
here (how to test, verify or open a pull request…), write it into the playbook section it answers,
with `by: human` in that slot's marker (`omni kb init` first writes a missing form); its id is
`playbook/<form>#<slot>`. A section `omni kb show <form>` prints from another page (`[→ <path>]`)
takes the lesson in that page instead. Then add one line to that settled entry:
`- Became: <id>[, <id>…]`. Otherwise, or when the answer states nothing lasting, add
`- Stays here: <one-line reason>`; a lesson for a form that points elsewhere as a whole goes in that
page, and has no section to name, so its reason says where it went. A drifted answer files what the
person decided, not what the build did; the rework is what brings the code in line. When unsure,
write the rule anyway: a reviewer deletes a wrong one in a minute.

**Anything settled or adopted is one sub-PR** into the feature branch. In the worktree, run
`git switch -c <settle branch>`, where `<settle branch>` is `branches.slice` with `{topic}` and
`{slice}` = `settle`. Commit the ledger, the removed item files and any write-back together
(`chore(delivery): settle <n> answers from the feature PR`, with your session's co-author trailer,
then the `omni sign trailer` line), push, and open it with
`gh pr create --draft --base <feature branch> --body-file <file>`, the body starting with
`prLinks.sub` filled and ending with the `omni sign footer` line, labels `labels.sub` and
`labels.inProgress`. Follow `/omni:pr`'s **sub-PR
lifecycle** until it is ready, then merge it the way `/omni:wave` §4 merges a slice (the base must be
the feature branch; merge only with the command `omni flow check merge --pr <n>` prints after its
`ok`, and leave a `not ok` open with its reasons). Never into the default branch.
Merge it before step 4: the drift is read off the feature branch.

## 4. Derive the reworks

In a fresh worktree on the feature branch's tip:

```bash
node .omni-loop/bin/omni.mjs rework plan <prd> --json
```

This is the whole derivation; never re-parse the ledger by hand. `opensPullRequest: false`: print
its `report` and go to step 7. That is the *nothing drifted* case, and the common one.

Otherwise `reworks[]` holds one rework slice per drifted item, each with its `id`, `wave`, `itemId`,
`branch`, `base`, and:

- `answer`: what the person said instead, verbatim;
- `chosenOption` (with `reason`): the option the answer picked. **Rework towards its text.** `null`
  for an answer in prose: then the answer itself is the target;
- `choice`: what was built meanwhile (option A), which the answer contradicts;
- `bound`: the item's own *What it costs to change later*. **This is how wide the rework may go.** A
  rework that needs more than it says is one the item never authorised: stop it and say which
  sentence it outgrew. Never widen it, and never write an item to ask;
- `territory`: the originating slice's ground plus every path the bound names. `territoryKnown:
  false` means neither named any ground: say so in the report rather than inventing a lane, and do
  not build that rework.

## 5. Run each wave of reworks

Reworks run by `wave`, lowest first; the kit already put two reworks that share ground in different
waves. `/omni:wave` reads the plan's board, which does not hold reworks, so drive each wave with its
steps over the rework rows instead:

1. **Claim** each rework through `/omni:pr`'s **Claim** mode, with the rework `id` as the slice and
   `rework <itemId>` as the title: its claim commit and its sub-PR's body are signed there. Then
   `git switch --detach`.
2. **Dispatch** one worktree subagent per rework, all in one message, each with
   `isolation: "worktree"`:

   > Rework `<id>` of PRD <prd>, on feature branch `<feature branch>`: follow `/omni:do-work
   > --in-wave`. Its slice branch is already claimed. Its territory is `<territory>`, not a plan
   > row. The question: <question>. What was built: <choice>. The person's answer, verbatim:
   > <answer>. Build towards: <chosenOption text, or "the answer itself">. The bound, the item's own
   > words: <bound>. Record no item and ask nothing: the decision is made. A change the bound does
   > not cover returns `stopped`, naming the sentence it outgrew. Do not spawn subagents. Return only
   > do-work's result JSON.

3. **Merge**, one at a time, exactly as `/omni:wave` §4 does, grading territory against the
   rework's `territory`. Its "not merged" table applies as written.
4. **Check the wave together** as `/omni:wave` §5 does, without its adopt step: reworks raise no
   item.

## 6. Close each reworked item

For each rework merged, in a fresh worktree on the feature branch:

```bash
node .omni-loop/bin/omni.mjs rework close <itemId> --prd <prd> --pr <sub-PR>
```

It amends exactly one line of the ledger, that entry's `Closed:` line, and nothing else. Commit the
amendment naming the items it closed (`chore(delivery): close <k> reworked decisions`, with your
session's co-author trailer, then the `omni sign trailer` line) and
`git push <remote> HEAD:<feature branch>`. A rework not merged
stays open, and so does the gate.

## 7. Finish, gate, ship before ready

After the last rework merges (or straight from step 4 when nothing drifted), work in a detached
worktree of the feature branch and follow `/omni:yolo` §4 (meet the default branch, install, check
the whole feature, acceptance, push, the body, the gate), then `/omni:yolo` §5 as written:

- the outbox comment is rewritten in place on both paths (`omni comment --prd <prd> --pr <feature
  PR>`), even when nothing changed: it costs no commit;
- **gate green:** the release note, then the ship step, commit, push, and only then ready:
  - **The release note,** only when `node .omni-loop/bin/omni.mjs config releaseNotes.enabled`
    prints `true`: `/omni:yolo` §5's item 1, with one addition. A note already in the PRD's folder
    is read against what the feature branch builds now. When a merged rework changed what the PRD
    does for the people who use it, rewrite the note: in the voice of the **Release notes** section
    of `node .omni-loop/bin/omni.mjs kb show releasing`, from the spec and the branch as it now
    stands, then `node .omni-loop/bin/omni.mjs check releases` until it is green, and commit it as
    `docs(release): PRD <prd> release note`, with your session's co-author trailer, then the
    `omni sign trailer` line. A rework that changed nothing the note says leaves it as it is.
  - **Ship,** commit and push as `/omni:yolo` §5's items 2 and 3, then `gh pr ready`. When
    `omni prd` already says `shipped` (the after-merge path), there is nothing to ship: the note is
    written or rewritten all the same, in the folder `omni prd` prints; push its commit, if there is
    one (`git push <remote> HEAD:<feature branch>`), and go straight to ready;
- **gate red:** the feature PR stays draft, and the report says who answers what.

Then release as `/omni:yolo` §6 does: remove `labels.inProgress` (unless the Stuck path swapped it
for `labels.needsFix`) and write the final status comment, `done` or `stuck`.

## 8. Hand off

Report, in one block: the PRD's page beside its number, as `/omni:yolo` §7 prints it (run
`node .omni-loop/bin/omni.mjs dossier link <n>`; on exit `0` print `PRD <n>: <link>`, and on
anything else `PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>`, never stopping
the hand-off); what step 3 settled (agreed or drifted, by question number) and whether a
round was posted; the leftovers adopted; every drifted item, the rework sub-PR that closed it, the
bound it stayed inside, any territory breach; each rework not merged, with its reason; the checks
that ran and did not; the gate verdict and the feature PR's state.

**With nothing answered, nothing drifted and nothing unclear,** say so plainly: no settle sub-PR,
no rework sub-PR, no round comment. Step 7 still refreshes the outbox comment.

Then end the reply with `/omni:yolo` §7's hand-off, as written: the PRD's folder, where it is, and
the **What is next?** of the ending this run reached, its last line alone as the reply's last line.
One difference: the held ending's command is `/omni:yolo-fix <n>`, since a held rework resumes with
this skill. The red ending already runs `/omni:yolo-fix <n>`, and the green one runs nothing. As
there, a run that stops before it picks up the feature PR (step 1) keeps its one line and prints no
hand-off.

## Guardrails

- **Never merge into `repo.defaultBranch`.** The settle sub-PR and every rework merge into the
  feature branch, one at a time; a person merges the feature PR. Check the base before every merge.
- **Raise no item.** A question met while reworking means the rework is going wider than its bound:
  stop it and say so.
- **One rework slice per drifted item.** Never one sub-PR for two items, and never a rework of an
  item that settled `agreed`.
- **The bound is the item's own sentence,** not your reading of the answer.
- **The ledger grows only.** Settling appends entries (and their `Became:` or `Stays here:` line);
  after that, only `omni rework close` touches it, and only an entry's `Closed:` line.
- **Never mark the feature PR ready while the gate is red,** never before the ship step is committed
  and pushed, and never add `labels.outboxGo`.
- **Nothing to do is a normal ending.** Say it plainly, open no sub-PR, commit nothing.
